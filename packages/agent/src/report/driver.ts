import {
  checkReport,
  mapOutsideQuotes,
  momentFromEntry,
  type Digest,
  type Logger,
  type ReportContent,
  type ReportLanguage,
  type ReportLedger,
  type ReportProblem,
} from "@sintr/core";
import { APICallError, RetryError, generateText, isStepCount, tool, type LanguageModel } from "ai";
import { smoothDashText } from "../dashes";
import { describeProviderError } from "../providers";
import { reportInput, reportPrompt } from "./prompt";
import { ReportDraft } from "./shapes";

/** A first draft, and two chances to fix what the check refused. */
export const REPORT_ATTEMPTS = 3;

export interface WriteReport {
  model: LanguageModel;
  digest: Digest;
  language: ReportLanguage;
  /** The person's own "things to bring up", word for word. */
  toBring: readonly string[];
  /** Tasks agreed in the last session, word for word. */
  tasks: readonly string[];
  /** What the check knows of the diary. */
  ledger: ReportLedger;
  /** The redacting logger: codes and counts only. */
  log: Logger;
  abortSignal?: AbortSignal;
}

export type WrittenReport =
  | {
      ok: true;
      content: ReportContent;
      /** Empty when the check passed; otherwise the draft is kept, marked with them. */
      problems: ReportProblem[];
      attempts: number;
    }
  | { ok: false; problem: string };

/** Problems as the model can act on them. The details are words it already has. */
function forModel(problem: ReportProblem): string {
  const where = problem.section;
  switch (problem.code) {
    case "quote_not_found":
      return `${where}: "${problem.detail}" is not in the diary word for word. Copy the person's words exactly, or remove the quotation marks.`;
    case "states_a_cause":
      return `${where}: "${problem.detail}" states a cause. Describe what happened together instead.`;
    case "clinical_label":
      return `${where}: "${problem.detail}" is a clinical label. Use the person's own words.`;
    case "undated_observation":
      return `patterns: "${problem.detail}" needs its dates in "when".`;
    case "too_many_topics":
      return "topics: keep 2 to 4.";
    case "too_many_moments":
      return "moments: keep 3 to 5.";
    case "long_summary":
      return "week: keep it to 3 to 6 lines.";
    case "moment_entry_missing":
      return `moments: "${problem.detail}" does not name an entry of the digest. Use the entry ids given.`;
    default:
      return `${where}: ${problem.code}`;
  }
}

const smooth = (text: string) => mapOutsideQuotes(text, smoothDashText).trim();

/** The model's draft as report content: the moments copied from their entries. */
export function contentFromDraft(
  draft: ReportDraft,
  digest: Digest,
  language: ReportLanguage,
): { content: ReportContent; unknown: string[] } {
  const entries = new Map(digest.entries.map((entry) => [entry.id, entry]));
  const unknown: string[] = [];
  const seen = new Set<string>();
  const moments = draft.moments.flatMap((moment) => {
    const entry = entries.get(moment.entryId);
    if (!entry) {
      unknown.push(moment.entryId);
      return [];
    }
    if (seen.has(entry.id)) return [];
    seen.add(entry.id);
    return [
      momentFromEntry(entry, {
        title: smooth(moment.title),
        ...(moment.happened ? { happened: smooth(moment.happened) } : {}),
        ...(moment.did ? { did: smooth(moment.did) } : {}),
      }),
    ];
  });
  return {
    unknown,
    content: {
      v: 1,
      language,
      week: smooth(draft.week),
      topics: draft.topics
        .map((t) => ({ text: smooth(t.text), suggested: t.suggested }))
        .filter((t) => t.text),
      mood: smooth(draft.mood),
      notes: digest.notes.map((n) => ({ checkinId: n.checkinId, day: n.day, note: n.note })),
      momentsIntro: smooth(draft.momentsIntro),
      moments,
      patterns: draft.patterns
        .map((p) => ({ when: smooth(p.when), text: smooth(p.text) }))
        .filter((p) => p.text),
      helped: draft.helped.map(smooth).filter(Boolean),
      author: "assistant",
      problem: null,
      numbers: null,
    },
  };
}

/**
 * Write the six sections with the person's model. Every draft is checked
 * before it is kept: a quote that is not in the diary word for word, a
 * cause, a clinical label or an undated observation goes back to the model
 * to fix. If it is still wrong after the last attempt, the draft is kept
 * and marked with its problems (its unverified quotes lose the
 * highlighter), for the person to see before approving anything.
 */
export async function writeReport(input: WriteReport): Promise<WrittenReport> {
  const { digest, language, ledger, log } = input;
  const started = Date.now();
  let last: { content: ReportContent; problems: ReportProblem[] } | null = null;
  let accepted = false;
  let attempts = 0;

  const tools = {
    write_report: tool({
      description:
        "Write the weekly report: the prose of its six sections and the choice of moments. sintr checks it and adds the numbers and the moments' own words.",
      inputSchema: ReportDraft,
      execute: async (draft) => {
        attempts += 1;
        const { content, unknown } = contentFromDraft(draft, digest, language);
        const problems: ReportProblem[] = [
          ...unknown.map((id): ReportProblem => ({
            code: "moment_entry_missing",
            section: "moments",
            detail: id,
          })),
          ...checkReport(content, ledger).problems,
        ];
        last = { content, problems };
        if (problems.length === 0) {
          accepted = true;
          return { ok: true as const };
        }
        return { ok: false as const, problems: problems.map(forModel) };
      },
    }),
  };

  try {
    await generateText({
      model: input.model,
      instructions: reportPrompt(language),
      prompt: reportInput({ digest, toBring: input.toBring, tasks: input.tasks }),
      tools,
      toolChoice: "required",
      stopWhen: [isStepCount(REPORT_ATTEMPTS), () => accepted],
      maxRetries: 1,
      timeout: { totalMs: 300_000 },
      ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
      telemetry: { isEnabled: false },
    });
  } catch (error) {
    // A refused draft is not an error; a provider failure is. Keep a checked draft if there is one.
    if (!last) {
      // A model that answers in prose instead of calling the tool fails the required tool choice.
      const fromProvider =
        APICallError.isInstance(error) ||
        RetryError.isInstance(error) ||
        error instanceof TypeError ||
        (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError"));
      const problem = fromProvider ? describeProviderError(error) : "no_report";
      log.warn("report.write_failed", { code: problem, error });
      return { ok: false, problem };
    }
  }
  const result = last as { content: ReportContent; problems: ReportProblem[] } | null;
  if (!result) {
    log.warn("report.write_failed", { code: "no_report", durationMs: Date.now() - started });
    return { ok: false, problem: "no_report" };
  }
  log.info("report.written", {
    code: accepted ? "ok" : "marked",
    count: attempts,
    durationMs: Date.now() - started,
  });
  return { ok: true, content: result.content, problems: result.problems, attempts };
}
