/**
 * The memory (F10): sintr remembers who the person is and what has been
 * going on, from their own diary, for their own assistant. Its route
 * follows who answers; its reading is held to the capture rules in code;
 * it reaches the conversation as a section after the instructions, never
 * before the crisis screen.
 */
export { embedTexts, rehearsalEmbedding, type Embedding, type EmbeddingProblem } from "./embed";
export { memoryReadingPrompt, memorySection, type MemoryNote } from "./prompt";
export {
  READING_ATTEMPTS,
  RememberInput,
  pagesOf,
  pageText,
  readPages,
  type Page,
  type Reading,
} from "./read";
export {
  GEMINI_EMBEDDING_MODEL,
  memoryRecipients,
  memoryRouteFor,
  providerName,
  type EmbeddingRoute,
  type EmbeddingService,
  type MemorySource,
  type MemoryUnavailable,
} from "./route";
export {
  HOUSE_DAILY_PAGES,
  PAGES_PER_READING,
  RECALL,
  agreedRecipients,
  embed,
  memoryState,
  recall,
  recipientRecord,
  rememberNow,
  type MemoryContext,
  type MemoryState,
  type Remembered,
} from "./service";
