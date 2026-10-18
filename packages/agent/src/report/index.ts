/**
 * The weekly report writer: the second driver of the embedded agent, next
 * to the capture conversation. It writes the six sections of the agent
 * pack's weekly report guide with the person's own model, held to the
 * pack's rules in code: every quote checked against the diary, the
 * moments' words copied from their entries, no diagnosis, nothing sent.
 */
export {
  REPORT_ATTEMPTS,
  contentFromDraft,
  writeReport,
  type WriteReport,
  type WrittenReport,
} from "./driver";
export { prepareReport, reportModel, type PrepareReport, type PreparedReport } from "./prepare";
export { reportInput, reportPrompt } from "./prompt";
export { ReportDraft } from "./shapes";
