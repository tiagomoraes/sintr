import type { Messages } from "@/messages";

/** A diary message, not a document: generous, but bounded. */
export const MAX_MESSAGE_LENGTH = 8_000;

/** The code inside a chat error: bare, or in a JSON body. */
function codeOf(message: string): string {
  const code = message.trim();
  try {
    const parsed = JSON.parse(code) as { code?: unknown };
    if (typeof parsed.code === "string") return parsed.code;
  } catch {
    // A bare code.
  }
  return code;
}

/** Codes said the same way on any assistant: they are about the session or the conversation. */
const ANY_ASSISTANT = new Set(["signed_out", "not_found", "nothing_to_retry"]);

/**
 * What to tell the person when the assistant cannot answer, for the
 * person's own key or the house assistant. The server sends codes only;
 * the words are the page's (`t.talk`), and never the provider's own text.
 */
export function problemText(
  message: string | undefined,
  t: Pick<Messages, "talk">,
  source: "own" | "house" = "own",
): string {
  const { problems, fallback, house } = t.talk;
  if (!message) return fallback;
  const code = codeOf(message);
  const own = Object.hasOwn(problems, code) ? problems[code as keyof typeof problems] : null;
  if (source === "house") {
    if (ANY_ASSISTANT.has(code) && own) return own;
    if (code === "rate_limited" || code === "timeout") return house[code];
    return house.fallback;
  }
  return own ?? fallback;
}

/** Problems that a retry cannot fix: the person has to change something first. */
export function needsSetup(message: string | undefined): boolean {
  const text = message ?? "";
  return /"?(not_configured|key_required|base_url_required|invalid_url|credentials_in_url|https_required|private_address|nothing_to_retry)"?/.test(
    text,
  );
}
