import {
  DataAccessError,
  collectDigest,
  draftContent,
  reportLanguage,
  reportLedger,
  serializeContent,
  type Logger,
  type Report,
  type ReportContent,
  type ReportPeriod,
  type ReportProblem,
  type UserScope,
} from "@sintr/core";
import type { LanguageModel } from "ai";
import { metered, resolveAssistant, type AssistantConfig, type Metered } from "../assistant";
import { writeReport } from "./driver";

/**
 * The model that writes a person's report: their own key, or the house
 * assistant within their plan (with its meter), or the offline rehearsal
 * model when SINTR_FAKE_AGENT is on (tests). Null, with a code, when there
 * is none to use: the report is then prepared by sintr alone.
 */
export async function reportModel(
  scope: UserScope,
  config: AssistantConfig,
  options: { fetch?: typeof fetch } = {},
): Promise<{ model: LanguageModel | null; problem: string | null; metered: Metered | null }> {
  const assistant = await resolveAssistant(scope, config, options);
  if (!assistant.ok) return { model: null, problem: assistant.problem, metered: null };
  return {
    model: assistant.model,
    problem: null,
    metered: assistant.source === "house" ? metered(scope, "reports") : null,
  };
}

export interface PrepareReport {
  scope: UserScope;
  period: ReportPeriod;
  /** Prepare this report again, in place; otherwise a new report. */
  reportId?: string;
  /** The scheduler's preparation: leave the report alone if the person changed it meanwhile. */
  untouched?: boolean;
  /** The person's model; null prepares the parts sintr can make alone. */
  model: LanguageModel | null;
  /** Why there is no model, as a code. */
  modelProblem?: string | null;
  /** The house assistant's meter of reports; absent for a person's own key. */
  metered?: Metered | null;
  log: Logger;
  abortSignal?: AbortSignal;
}

export interface PreparedReport {
  report: Report;
  content: ReportContent;
  /** What the check found in the assistant's last draft, if any. */
  problems: ReportProblem[];
  created: boolean;
}

function isDuplicate(error: unknown): boolean {
  return error instanceof DataAccessError && error.code === "23505";
}

/**
 * Prepare one report: the digest of the period, the six sections (written
 * by the assistant and checked, or the parts sintr can make alone),
 * stored as a draft that waits for the person. Nothing is sent. Returns
 * null when another preparation of the same period got there first.
 */
export async function prepareReport(input: PrepareReport): Promise<PreparedReport | null> {
  const { scope, period, log } = input;
  const [profile, notes] = await Promise.all([scope.profile.get(), scope.therapyNotes.list()]);
  const timeZone = profile.timezone;
  const language = reportLanguage(profile.language);
  const digest = await collectDigest(scope, period, timeZone);
  const open = (kind: "to_bring" | "task") =>
    notes
      .filter((note) => note.kind === kind && note.doneAt === null)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((note) => note.body);
  const toBring = open("to_bring");

  let content: ReportContent;
  let problems: ReportProblem[] = [];
  // This month's reports on the person's plan are used: sintr prepares it alone, in their words.
  const taken = input.model && input.metered ? await input.metered.take() : null;
  if (taken && !taken.ok) {
    content = draftContent({ digest, language, toBring, problem: "limit_reached" });
  } else if (input.model) {
    const written = await writeReport({
      model: input.model,
      digest,
      language,
      toBring,
      tasks: open("task"),
      ledger: await reportLedger(scope, period, null),
      log,
      ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
    });
    if (written.ok) {
      content = written.content;
      problems = written.problems;
    } else {
      // A report the assistant could not write is not counted against the month.
      await input.metered?.giveBack();
      content = draftContent({ digest, language, toBring, problem: written.problem });
    }
  } else {
    content = draftContent({ digest, language, toBring, problem: input.modelProblem ?? "not_configured" });
  }

  // The person left (a reload, a closed tab): keep nothing half-made.
  if (input.abortSignal?.aborted) throw new DOMException("the preparation was abandoned", "AbortError");
  const stored = serializeContent(content);
  let report: Report;
  let created = false;
  if (input.reportId) {
    report = await scope.reports.prepareAgain(input.reportId, {
      content: stored,
      periodEnd: period.end,
      sessionAt: period.session,
      ...(input.untouched ? { untouched: true } : {}),
    });
  } else {
    try {
      report = await scope.reports.createDraft({
        periodStart: period.start,
        periodEnd: period.end,
        sessionAt: period.session,
        content: stored,
      });
      created = true;
    } catch (error) {
      if (isDuplicate(error)) return null;
      throw error;
    }
  }
  await scope.auditLog.record({
    action: "report.prepared",
    targetType: "report",
    targetId: report.id,
    metadata: { author: content.author, kind: period.kind, again: !created },
  });
  log.info("report.prepared", { reportId: report.id, code: content.problem ?? content.author });
  return { report, content, problems, created };
}
