import type { ProblemCode, ReportSection } from "@sintr/core";
import type { Messages } from "@/messages";
import { formatDay, formatMoment } from "./format";

/** The words of the reports screens, in the page's language. */
type Words = Messages["reports"];

/** Several names as a sentence lists them: "a", "a and b", "a, b and c" (empty for none). */
export function namesInWords(names: readonly string[], words: Words): string {
  if (names.length <= 1) return names[0] ?? "";
  return words.and(names.slice(0, -1).join(", "), names.at(-1)!);
}

/** The sections a change touched, as the app names them inside a sentence; null for none. */
export function sectionsInWords(sections: readonly string[], words: Words): string | null {
  if (sections.length === 0) return null;
  return namesInWords(
    sections.map((s) => words.sectionNames[s as ReportSection] ?? s),
    words,
  );
}

/** What a check problem means, for the person. `detail` is their own words. */
export function problemInWords(code: ProblemCode, detail: string | null, words: Words): string {
  const quoted = detail ? `“${detail}”` : "";
  const problems = words.problems;
  switch (code) {
    case "quote_not_found":
      return problems.quoteNotFound(quoted);
    case "states_a_cause":
      return problems.statesACause(quoted);
    case "clinical_label":
      return problems.clinicalLabel(quoted);
    case "undated_observation":
      return problems.undatedObservation(quoted);
    case "moment_entry_changed":
      return problems.momentEntryChanged(quoted);
    case "moment_entry_missing":
      return problems.momentEntryMissing(quoted);
    case "note_changed":
      return problems.noteChanged(quoted);
    case "too_many_topics":
      return problems.tooManyTopics;
    case "too_many_moments":
      return problems.tooManyMoments;
    case "long_summary":
      return problems.longSummary;
  }
}

/** Why sintr, not the assistant, prepared a draft. */
export function authorInWords(problem: string | null, words: Words): string {
  switch (problem) {
    case "not_configured":
      return words.author.notConfigured;
    case "limit_reached":
      return words.author.limitReached;
    case "no_report":
      return words.author.noReport;
    case null:
      return words.author.none;
    default:
      return words.author.unreachable;
  }
}

/** "For the session of Tuesday 21 October at 18:00", or "Week of 13 October 2026", in the page's language. */
export function reportTitle(
  report: { sessionAt: Date | null; periodStart: Date },
  locale: { language: string; timezone: string },
  t: Messages,
): string {
  return report.sessionAt
    ? t.reports.titles.session(formatMoment(report.sessionAt, locale))
    : t.reports.titles.week(formatDay(report.periodStart, locale));
}
