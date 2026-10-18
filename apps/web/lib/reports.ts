import type { ProblemCode, ReportSection, ReportStatus } from "@sintr/core";

/** The lifecycle, in the person's words. */
export const STATUS: Record<ReportStatus, string> = {
  draft: "Draft, waiting for you",
  reviewed: "Approved by you, not sent",
  sent: "Sent with your approval",
};

/** The sections, as the app names them inside a sentence. */
export const SECTION_NAMES: Record<ReportSection, string> = {
  week: "how the week went",
  session: "the topics for the session",
  mood: "mood, energy and sleep",
  moments: "the moments",
  patterns: "what repeated",
  helped: "what helped",
};

export function sectionsInWords(sections: readonly string[]): string {
  const names = sections.map((s) => SECTION_NAMES[s as ReportSection] ?? s);
  if (names.length === 0) return "nothing in its words";
  if (names.length === 1) return names[0]!;
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** What a check problem means, for the person. `detail` is their own words. */
export function problemInWords(code: ProblemCode, detail: string | null): string {
  const quoted = detail ? `“${detail}”` : "";
  switch (code) {
    case "quote_not_found":
      return `${quoted} is not in your diary word for word, so it is shown without the highlight that marks your own words.`;
    case "states_a_cause":
      return `${quoted} reads as a cause. The report describes what happened together, not why.`;
    case "clinical_label":
      return `${quoted} reads as a clinical label. The report keeps to your own words.`;
    case "undated_observation":
      return `An observation under what repeated has no date: ${quoted}.`;
    case "moment_entry_changed":
      return `The entry ${quoted} changed after this report was prepared. Prepare it again to take the change.`;
    case "moment_entry_missing":
      return `The entry ${quoted} is no longer in your diary. Remove the moment or prepare the report again.`;
    case "note_changed":
      return `A check-in note changed after this report was prepared: ${quoted}.`;
    case "too_many_topics":
      return "There are more than six topics for the session; two to four read best.";
    case "too_many_moments":
      return "There are more than six moments; three to five read best.";
    case "long_summary":
      return "How the week went is long for the first page; three to six lines read best.";
  }
}

/** Why sintr, not the assistant, prepared a draft. */
export function authorInWords(problem: string | null): string {
  switch (problem) {
    case "not_configured":
      return "There is no assistant set up, so sintr prepared what it can on its own: the moments, your notes and your topics, in your own words. How the week went and the reading of the numbers are yours to write.";
    case "no_report":
      return "Your assistant answered without writing the report, so sintr prepared what it can on its own. You can write the rest, or prepare it again.";
    case null:
      return "sintr prepared what it can on its own.";
    default:
      return "Your assistant could not be reached to write this draft, so sintr prepared what it can on its own. You can write the rest, or prepare it again when the assistant answers.";
  }
}
