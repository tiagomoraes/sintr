/** A conversation with the assistant, beyond the home: what went wrong, and what to do while there is no assistant. */
export const talk = {
  /**
   * When the assistant cannot answer on the person's own key, by the code
   * the server sends (lib/chat.ts). Each says what to change, and where.
   */
  problems: {
    not_configured: "This sintr has no assistant of its own yet. You can use your own key, in Settings.",
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
  },
  /** Any other code, never the provider's own text. */
  fallback: "The assistant could not answer just now. Your message is kept, and you can try again.",
  /**
   * The house assistant's problems are the installation's, not the person's:
   * there is no key of theirs to check, so they are only told to try again.
   */
  house: {
    rate_limited: "The assistant is busy just now. Your message is kept; try again in a moment.",
    timeout: "The assistant took too long to answer. Your message is kept; try again in a moment.",
    fallback:
      "The assistant is not available just now. Your message is kept, and you can try again in a while.",
  },
  /** The home on a sintr with no assistant of its own, before the person brings a key. */
  setup: {
    title: "This sintr has no assistant of its own yet.",
    body: "To talk things through here, bring a key from a provider you choose, or point sintr at a model on your own machine. It takes a minute in Settings. What you write then goes to that provider only, and the key is encrypted before it is stored.",
    without: "Check-ins and your weekly report work without it.",
    ownKey: "Use your own key",
    checkin: "Write a check-in instead",
  },
} as const;
