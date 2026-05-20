const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

// Default model for the inline AI routes. Kept in sync with the chat agent
// (see process-message.ts). Groq is extremely fast, so even the 70B model
// returns well within the tight autocomplete timeouts.
export const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";

// Smaller/faster model for latency-sensitive, high-frequency calls
// (inline autocomplete suggestions). Cheaper on the free-tier rate limits.
export const FAST_GROQ_MODEL = "llama-3.1-8b-instant";

interface CompleteOptions {
  system?: string;
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Server-side timeout in ms. Prevents a slow model from hanging the route. */
  timeoutMs?: number;
}

/**
 * Minimal Groq chat-completion call returning plain text.
 *
 * Groq exposes an OpenAI-compatible API, so we hit /chat/completions directly
 * with the GROQ_API_KEY — no extra AI-SDK provider package needed.
 */
export async function groqComplete({
  system,
  prompt,
  model = DEFAULT_GROQ_MODEL,
  temperature = 0,
  maxTokens = 1024,
  timeoutMs = 30_000,
}: CompleteOptions): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  const messages: { role: "system" | "user"; content: string }[] = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature,
      max_completion_tokens: maxTokens,
      messages,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Groq request failed (${response.status}): ${detail}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim() ?? "";
}

/**
 * Strips a surrounding ```lang ... ``` markdown code fence if the model wrapped
 * its output in one. Returns the inner code (or the original string untouched).
 */
export function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```[^\n]*\n([\s\S]*?)\n```$/);
  return fenceMatch ? fenceMatch[1] : trimmed;
}
