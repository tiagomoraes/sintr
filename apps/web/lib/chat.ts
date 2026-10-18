/** A diary message, not a document: generous, but bounded. */
export const MAX_MESSAGE_LENGTH = 8_000;

/**
 * What to tell the person when the assistant cannot answer. The server
 * sends codes only; the words live here.
 */
const PROBLEMS: Record<string, string> = {
  not_configured: "The assistant needs a provider first. You can set one up in Settings.",
  key_required: "This provider needs an API key. You can add it in Settings.",
  base_url_required: "This provider needs its address. You can add it in Settings.",
  invalid_url: "The provider's address does not look right. You can check it in Settings.",
  credentials_in_url: "The provider's address must not contain a password. You can change it in Settings.",
  https_required: "The provider's address has to use https here. You can change it in Settings.",
  private_address: "The provider's address has to be a public one here. You can change it in Settings.",
  key_refused: "The provider refused the key. You can check it in Settings.",
  model_not_found: "The provider does not know this model. You can check its name in Settings.",
  rate_limited: "The provider is busy, or the key has reached its limit. Try again in a moment.",
  unreachable: "The provider could not be reached. Check its address in Settings, or try again.",
  timeout: "The provider took too long to answer. Try again in a moment.",
  signed_out: "Your session has ended. Sign in again to continue.",
  not_found: "This conversation is not available.",
  nothing_to_retry: "There is nothing to try again here. Write your message once more.",
};

const FALLBACK = "The assistant could not answer just now. Your message is kept, and you can try again.";

/** An error from the chat as plain words. Accepts a code or a JSON body with one. */
export function problemCopy(message: string | undefined): string {
  if (!message) return FALLBACK;
  let code = message.trim();
  try {
    const parsed = JSON.parse(code) as { code?: unknown };
    if (typeof parsed.code === "string") code = parsed.code;
  } catch {
    // A bare code.
  }
  return PROBLEMS[code] ?? FALLBACK;
}

/** Problems that a retry cannot fix: the person has to change something first. */
export function needsSetup(message: string | undefined): boolean {
  const text = message ?? "";
  return /"?(not_configured|key_required|base_url_required|invalid_url|credentials_in_url|https_required|private_address|nothing_to_retry)"?/.test(
    text,
  );
}
