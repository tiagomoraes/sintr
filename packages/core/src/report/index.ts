/**
 * The weekly report: when it is prepared and what it covers (period), the
 * deterministic digest of that period, what a report says (content), its
 * checks, and the document the therapist receives. Printing to PDF lives
 * apart, in `@sintr/core/pdf`, so only the web app carries a browser driver.
 */
export { MOOD_COLOR, ANXIETY_COLOR, legendMark, onPaper, reportChart } from "./chart";
export {
  buildCorpus,
  checkReport,
  entryTexts,
  interpretationsIn,
  isVerbatim,
  isVerified,
  mapOutsideQuotes,
  normalizeWords,
  proseOf,
  quotesIn,
  splitQuotes,
  type CheckedEntry,
  type ProblemCode,
  type ReportCheck,
  type ReportLedger,
  type ReportProblem,
  type TextPart,
  type WordCorpus,
} from "./check";
export { QUOTE_WINDOW_DAYS, collectDigest, reportLedger } from "./collect";
export {
  MOMENT_PROSE,
  REPORT_LANGUAGES,
  REPORT_SECTIONS,
  ReportContent,
  ReportMoment,
  ReportNote,
  ReportPattern,
  ReportTopic,
  changedSections,
  parseContent,
  reportLanguage,
  serializeContent,
  type ReportLanguage,
  type ReportSection,
} from "./content";
export {
  CHART_WEEKS,
  buildDigest,
  digestNumbers,
  historyStart,
  periodDays,
  type Digest,
  type DigestDay,
  type DigestEntry,
  type DigestMeasure,
  type DigestNote,
  type DigestNumbers,
  type MeasureKey,
} from "./digest";
export { reportDocument, escapeHtml, type ReportDocumentInput } from "./document";
export { draftContent, momentFromEntry, strongestEntries } from "./draft";
export {
  formatDayMonth,
  formatHours,
  formatMomentTime,
  formatNumber,
  formatRange,
  formatScore,
  formatSession,
  formatShortDay,
  formatWeekdays,
} from "./format";
export {
  FIRST_PERIOD_DAYS,
  MAX_PERIOD_DAYS,
  calendarWeek,
  inSchedule,
  periodAgain,
  periodStart,
  planReportNow,
  planScheduledReport,
  preparationTime,
  sessionPeriod,
  upcomingSession,
  upcomingSessions,
  weekPeriod,
  type KnownReport,
  type ManualPlan,
  type ReportPeriod,
  type ScheduledPlan,
  type SessionSchedule,
} from "./period";
export { reportSchedules, type PersonSchedule } from "./schedules";
export {
  REPEAT_INTERVAL,
  SESSION_REPEATS,
  findSession,
  heldSessions,
  isSeriesDay,
  nextSeriesDay,
  normalizeSeries,
  seriesDays,
  sessionsOn,
  type Session,
  type SessionCalendar,
  type SessionChange,
  type SessionSeries,
} from "./sessions";
export { REPORT_STRINGS, type ReportStrings } from "./strings";
export {
  addDays,
  dayDiff,
  dayStart,
  daysBetween,
  isTimeZone,
  isoWeek,
  localDay,
  localParts,
  weekdayOf,
  zonedTime,
} from "./time";
export {
  approveAndShare,
  automaticLinks,
  shareReport,
  sharedPaper,
  snapshotOf,
  type PaperView,
} from "./share";
export {
  approveReport,
  editReport,
  notifyReportReady,
  periodOf,
  reportFilename,
  reportHtml,
  reportView,
  sendReport,
  sessionText,
  type ReportView,
} from "./service";
