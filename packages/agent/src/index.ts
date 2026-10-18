/**
 * The embedded agent: the capture conversation of the agent pack's SKILL.md,
 * inside the app. Provider-agnostic (bring your own key), streaming, and
 * held to the pack's rules in code, not only in the prompt:
 * - the person's words are kept verbatim, and drafts that paraphrase or
 *   invent a number are refused before they are stored;
 * - nothing becomes a record without the person's explicit yes;
 * - a message that signals acute risk stops the diary and points to human
 *   help (CVV 188, SAMU 192), before any model is called;
 * - no content reaches the logs.
 *
 * Client components import from `@sintr/agent/shapes`; this entry is for
 * the server.
 */
export { crisisLanguage, crisisMessage, screenForRisk, type CrisisLanguage, type Screening } from "./crisis";
export { smoothDashText } from "./dashes";
export { MAX_STEPS, runCaptureTurn, type CaptureTurn } from "./driver";
export {
  HISTORY_LIMIT,
  hasContent,
  isInCrisis,
  parseStoredMessage,
  personTexts,
  serializeMessage,
  textOf,
} from "./messages";
export { scopePorts, type CapturePorts } from "./ports";
export { capturePrompt, crisisPrompt } from "./prompt";
export {
  DEFAULT_BASE_URLS,
  ProviderSetupError,
  checkBaseUrl,
  createLanguageModel,
  describeProviderError,
  testConnection,
  unavailableModel,
  type BaseUrlProblem,
  type ConnectionProblem,
  type ModelOptions,
} from "./providers";
export * from "./shapes";
export { findVerbatim, isSaveCommand, wasStated } from "./words";
