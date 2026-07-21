import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { firecrawl } from "@/lib/firecrawl";
import { groqComplete, stripCodeFences } from "@/lib/groq";

const URL_REGEX = /https?:\/\/[^\s)>\]]+/g;

const QUICK_EDIT_PROMPT = `You are a code editing assistant. Edit the selected code based on the user's instruction.

<context>
<selected_code>
{selectedCode}
</selected_code>
<full_code_context>
{fullCode}
</full_code_context>
</context>

{documentation}

<instruction>
{instruction}
</instruction>

<instructions>
Return ONLY the edited version of the selected code.
Maintain the same indentation level as the original.
Do not wrap the output in markdown code fences.
Do not include any explanations or comments unless requested.
If the instruction is unclear or cannot be applied, return the original code unchanged.
</instructions>`;

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    const { selectedCode, fullCode, instruction } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 400 }
      );
    }

    if (!selectedCode) {
      return NextResponse.json(
        { error: "Selected code is required" },
        { status: 400 }
      );
    }

    if (!instruction) {
      return NextResponse.json(
        { error: "Instruction is required" },
        { status: 400 }
      );
    }

    const urls: string[] = instruction.match(URL_REGEX) || [];
    let documentationContext = "";

    if (urls.length > 0) {
      const scrapedResults = await Promise.all(
        urls.map(async (url) => {
          try {
            const result = await firecrawl.scrape(url, {
              formats: ["markdown"],
            });

            if (result.markdown) {
              return `<doc url="${url}">\n${result.markdown}\n</doc>`;
            }

            return null;
          } catch {
            return null;
          }
        })
      );

      const validResults = scrapedResults.filter(Boolean);

      if (validResults.length > 0) {
        documentationContext = `<documentation>\n${validResults.join("\n\n")}\n</documentation>`;
      }
    }

    const prompt = QUICK_EDIT_PROMPT
      .replace("{selectedCode}", selectedCode)
      .replace("{fullCode}", fullCode || "")
      .replace("{instruction}", instruction)
      .replace("{documentation}", documentationContext);

    const raw = await groqComplete({
      prompt,
      temperature: 0.2,
      // Kept well under Groq's 12k TPM free-tier limit so the full-file
      // context in the prompt still leaves room for the edited output.
      maxTokens: 2048,
    });

    const editedCode = stripCodeFences(raw);

    return NextResponse.json({ editedCode });
  } catch (error) {
    console.error("Edit error:", error);
    return NextResponse.json(
      { error: "Failed to generate edit" },
      { status: 500 }
    );
  }
};
