"use client";

import dynamic from "next/dynamic";
import { Poppins } from "next/font/google";
import { SparkleIcon } from "lucide-react";
import { FaGithub } from "react-icons/fa";
import { useEffect, useMemo, useState } from "react";
import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { useRequireAuth } from "@/features/auth/hooks/use-require-auth";

import { ProjectsList } from "./projects-list";
import { ProjectsCommandDialog } from "./projects-command-dialog";
import { ImportGithubDialog } from "./import-github-dialog";
import { NewProjectDialog } from "./new-project-dialog";

// WebGL-only, so keep it off the server render and out of the initial bundle.
const Strands = dynamic(() => import("@/components/strands"), { ssr: false });

const font = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

export const ProjectsView = () => {
  const [commandDialogOpen, setCommandDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [newProjectDialogOpen, setNewProjectDialogOpen] = useState(false);

  const { isAuthenticated, isLoading, requireAuth } = useRequireAuth();

  const openCommandDialog = useMemo(
    () => requireAuth(() => setCommandDialogOpen(true)),
    [requireAuth],
  );
  const openImportDialog = useMemo(
    () => requireAuth(() => setImportDialogOpen(true)),
    [requireAuth],
  );
  const openNewProjectDialog = useMemo(
    () => requireAuth(() => setNewProjectDialogOpen(true)),
    [requireAuth],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "k") {
          e.preventDefault();
          openCommandDialog();
        }
        if (e.key === "i") {
          e.preventDefault();
          openImportDialog();
        }
        if (e.key === "j") {
          e.preventDefault();
          openNewProjectDialog();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [openCommandDialog, openImportDialog, openNewProjectDialog]);


  return (
    <>
      <ProjectsCommandDialog
        open={commandDialogOpen}
        onOpenChange={setCommandDialogOpen}
      />
      <ImportGithubDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
      />
      <NewProjectDialog
        open={newProjectDialogOpen}
        onOpenChange={setNewProjectDialogOpen}
      />
      <div className="relative min-h-screen overflow-hidden bg-sidebar flex flex-col items-center justify-center p-6 md:p-16">

        <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
          <Strands
            colors={["#F97316", "#7C3AED", "#06B6D4"]}
            count={3}
            speed={0.5}
            amplitude={1}
            waviness={1}
            thickness={0.7}
            glow={2.6}
            taper={3}
            spread={1}
            intensity={0.6}
            saturation={2}
            opacity={1}
            scale={1.5}
            glass={false}
            refraction={1}
            dispersion={1}
            glassSize={1}
            hueShift={0}
          />
        </div>

        {/* Scrim so the centered content stays legible over the glow. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 bg-sidebar/40"
        />

        <div className="absolute top-0 right-0 z-20 flex items-center gap-2 p-4 md:p-6">
          {!isLoading && (
            isAuthenticated ? (
              <UserButton />
            ) : (
              <>
                <SignInButton mode="modal">
                  <Button variant="ghost" size="sm">
                    Sign in
                  </Button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <Button size="sm">
                    Sign up
                  </Button>
                </SignUpButton>
              </>
            )
          )}
        </div>

        <div className="relative z-10 w-full max-w-sm mx-auto flex flex-col gap-4 items-center">

          <div className="flex justify-between gap-4 w-full items-center">

            <div className="flex items-center gap-2 w-full group/logo">
              <img src="/logo.svg" alt="CloudAIIDE" className="size-[32px] md:size-[46px]" />
              <h1 className={cn(
                "text-4xl md:text-5xl font-semibold",
                font.className,
              )}>
                CloudAIIDE
              </h1>
            </div>

          </div>

          <div className="flex flex-col gap-4 w-full">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={openNewProjectDialog}
                className="h-full items-start justify-start p-4 bg-background border flex flex-col gap-6 rounded-none"
              >
                <div className="flex items-center justify-between w-full">
                  <SparkleIcon className="size-4" />
                  <Kbd className="bg-accent border">
                    ⌘J
                  </Kbd>
                </div>
                <div>
                  <span className="text-sm">
                    New
                  </span>
                </div>
              </Button>
              <Button
                variant="outline"
                onClick={openImportDialog}
                className="h-full items-start justify-start p-4 bg-background border flex flex-col gap-6 rounded-none"
              >
                <div className="flex items-center justify-between w-full">
                  <FaGithub className="size-4" />
                  <Kbd className="bg-accent border">
                    ⌘I
                  </Kbd>
                </div>
                <div>
                  <span className="text-sm">
                    Import
                  </span>
                </div>
              </Button>
            </div>

            <ProjectsList onViewAll={openCommandDialog} />

          </div>

        </div>
      </div>
    </>
  );
};
