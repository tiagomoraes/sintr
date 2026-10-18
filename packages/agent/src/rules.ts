/**
 * The capture rules on their own, without the conversation: the checks that
 * keep a draft in the person's words, the crisis screen and its fixed
 * message. The MCP server holds what a connected agent asks to save to
 * exactly these, so a record made over MCP passes the same gate as one the
 * embedded assistant drafted. Nothing here loads the AI SDK at run time.
 */
export { checkCheckinDraft, checkEntryDraft, type CheckOptions, type Checked } from "./checks";
export {
  crisisLanguage,
  crisisMessage,
  screenForRisk,
  type CrisisLanguage,
  type RiskKind,
  type Screening,
} from "./crisis";
export { CRISIS_LINES, CheckinDraft, EntryDraft, checkinInputFromDraft, entryInputFromDraft } from "./shapes";
export { findVerbatim, wasStated } from "./words";
