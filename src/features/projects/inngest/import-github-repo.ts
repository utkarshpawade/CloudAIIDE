import ky from "ky";
import { Octokit } from "octokit";
import { isBinaryFile } from "isbinaryfile";
import { NonRetriableError } from "inngest";

import { convex } from "@/lib/convex-client";
import { inngest } from "@/inngest/client";

import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

interface ImportGithubRepoEvent {
  owner: string;
  repo: string;
  projectId: Id<"projects">;
  githubToken: string;
}

// Minimal, serializable representation of a git tree entry. We only keep what
// the import needs so the Inngest step output stays small.
interface TreeEntry {
  path: string;
  type: "tree" | "blob";
  sha: string;
}

// Number of files created per Inngest step. Keeping this bounded means each
// step checkpoints its progress, so a transient failure only retries that
// batch instead of restarting the whole import from the first file.
const FILE_BATCH_SIZE = 20;

/**
 * Walks a git tree one level at a time, recursing into subtrees. Used as a
 * fallback when the recursive tree API truncates its response (GitHub caps it
 * at ~100k entries / 7 MB) — otherwise deep folders come back empty.
 */
async function walkTree(
  octokit: Octokit,
  owner: string,
  repo: string,
  treeSha: string,
  basePath: string
): Promise<TreeEntry[]> {
  const { data } = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: treeSha,
  });

  const entries: TreeEntry[] = [];

  for (const item of data.tree) {
    if (!item.path || !item.sha) {
      continue;
    }

    const path = basePath ? `${basePath}/${item.path}` : item.path;

    if (item.type === "tree") {
      entries.push({ path, type: "tree", sha: item.sha });
      entries.push(...(await walkTree(octokit, owner, repo, item.sha, path)));
    } else if (item.type === "blob") {
      entries.push({ path, type: "blob", sha: item.sha });
    }
  }

  return entries;
}

export const importGithubRepo = inngest.createFunction(
  {
    id: "import-github-repo",
    onFailure: async ({ event, step }) => {
      const internalKey = process.env.CLOUDAIIDE_CONVEX_INTERNAL_KEY;
      if (!internalKey) return;

      const { projectId } = event.data.event.data as ImportGithubRepoEvent;

      await step.run("set-failed-status", async () => {
        await convex.mutation(api.system.updateImportStatus, {
          internalKey,
          projectId,
          status: "failed",
        });
      });
    },
  },
  { event: "github/import.repo" },
  async ({ event, step }) => {
    const { owner, repo, projectId, githubToken } =
      event.data as ImportGithubRepoEvent;

    const internalKey = process.env.CLOUDAIIDE_CONVEX_INTERNAL_KEY;
    if (!internalKey) {
      throw new NonRetriableError(
        "CLOUDAIIDE_CONVEX_INTERNAL_KEY is not configured"
      );
    }

    const octokit = new Octokit({ auth: githubToken });

    // Cleanup any existing files in the project
    await step.run("cleanup-project", async () => {
      await convex.mutation(api.system.cleanup, {
        internalKey,
        projectId,
      });
    });

    // Fetch the full repo tree. Returns a normalized, complete list of entries
    // even when the repo is large enough to truncate the recursive tree API.
    const entries = await step.run("fetch-repo-tree", async () => {
      // Resolve the repo's actual default branch instead of guessing.
      let defaultBranch: string | undefined;
      try {
        const { data } = await octokit.rest.repos.get({ owner, repo });
        defaultBranch = data.default_branch;
      } catch {
        // Fall back to the usual suspects below.
      }

      const branchCandidates = [defaultBranch, "main", "master"].filter(
        (b): b is string => Boolean(b)
      );

      let tree: Awaited<
        ReturnType<typeof octokit.rest.git.getTree>
      >["data"] | null = null;

      for (const branch of branchCandidates) {
        try {
          const { data } = await octokit.rest.git.getTree({
            owner,
            repo,
            tree_sha: branch,
            recursive: "1",
          });
          tree = data;
          break;
        } catch {
          // Try the next candidate branch.
        }
      }

      if (!tree) {
        throw new NonRetriableError(
          `Could not read repository tree for ${owner}/${repo}. Checked branches: ${branchCandidates.join(
            ", "
          )}`
        );
      }

      // If GitHub truncated the recursive response, rebuild the full tree by
      // walking subtrees individually so no folders/files are silently dropped.
      if (tree.truncated) {
        return await walkTree(octokit, owner, repo, tree.sha, "");
      }

      return tree.tree
        .filter(
          (item): item is typeof item & { path: string; sha: string } =>
            (item.type === "tree" || item.type === "blob") &&
            Boolean(item.path) &&
            Boolean(item.sha)
        )
        .map((item) => ({
          path: item.path,
          type: item.type as "tree" | "blob",
          sha: item.sha,
        }));
    });

    // Sort folders by depth so parents are created before children.
    // Input:  [{ path: "src/components" }, { path: "src" }, { path: "src/components/ui" }]
    // Output: [{ path: "src" }, { path: "src/components" }, { path: "src/components/ui" }]
    const folders = entries
      .filter((item) => item.type === "tree")
      .sort((a, b) => a.path.split("/").length - b.path.split("/").length);

    // Return the folder map from the step so it can be used in subsequent steps
    // (Inngest serializes step results, so we use a plain object instead of Map)
    const folderIdMap = await step.run("create-folders", async () => {
      const map: Record<string, Id<"files">> = {};

      for (const folder of folders) {
        const pathParts = folder.path.split("/");
        const name = pathParts.pop()!;
        const parentPath = pathParts.join("/");
        const parentId = parentPath ? map[parentPath] : undefined;

        const folderId = await convex.mutation(api.system.createFolder, {
          internalKey,
          projectId,
          name,
          parentId,
        });

        map[folder.path] = folderId;
      }

      return map;
    });

    // Get all files (blobs) from the tree
    const allFiles = entries.filter((item) => item.type === "blob");

    // Create files in bounded batches. Each batch is its own Inngest step, so
    // progress is checkpointed and a failure only retries that batch — deep
    // folders no longer get dropped when a big repo times out mid-import.
    const batchCount = Math.ceil(allFiles.length / FILE_BATCH_SIZE);

    for (let batchIndex = 0; batchIndex < batchCount; batchIndex++) {
      const batch = allFiles.slice(
        batchIndex * FILE_BATCH_SIZE,
        (batchIndex + 1) * FILE_BATCH_SIZE
      );

      await step.run(`create-files-batch-${batchIndex}`, async () => {
        for (const file of batch) {
          try {
            const { data: blob } = await octokit.rest.git.getBlob({
              owner,
              repo,
              file_sha: file.sha,
            });

            const buffer = Buffer.from(blob.content, "base64");
            const isBinary = await isBinaryFile(buffer);

            const pathParts = file.path.split("/");
            const name = pathParts.pop()!;
            const parentPath = pathParts.join("/");
            const parentId = parentPath ? folderIdMap[parentPath] : undefined;

            if (isBinary) {
              const uploadUrl = await convex.mutation(
                api.system.generateUploadUrl,
                { internalKey }
              );

              const { storageId } = await ky
                .post(uploadUrl, {
                  headers: { "Content-Type": "application/octet-stream" },
                  body: buffer,
                })
                .json<{ storageId: Id<"_storage"> }>();

              await convex.mutation(api.system.createBinaryFile, {
                internalKey,
                projectId,
                name,
                storageId,
                parentId,
              });
            } else {
              const content = buffer.toString("utf-8");

              await convex.mutation(api.system.createFile, {
                internalKey,
                projectId,
                name,
                content,
                parentId,
              });
            }
          } catch (error) {
            // A single bad blob (e.g. oversized, or a duplicate on retry)
            // shouldn't fail the whole batch — log and continue.
            console.error(`Failed to import file: ${file.path}`, error);
          }
        }
      });
    }

    await step.run("set-completed-status", async () => {
      await convex.mutation(api.system.updateImportStatus, {
        internalKey,
        projectId,
        status: "completed",
      });
    });

    return { success: true, projectId };
  }
);
