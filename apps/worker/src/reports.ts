import { prepareReport, reportModel, type Metered } from "@sintr/agent";
import { notifyReportReady, planScheduledReport, type UserScope } from "@sintr/core";
import type { BaseRuntime } from "@sintr/core/runtime/base";
import type { LanguageModel } from "ai";

/** What the report job needs from the runtime. */
export type ReportRuntime = Pick<BaseRuntime, "reportSchedules" | "repositories" | "email" | "log"> & {
  config: Pick<BaseRuntime["config"], "mode" | "fakeAgent" | "url" | "house" | "language">;
};

type ModelFor = (
  scope: UserScope,
) => Promise<{ model: LanguageModel | null; problem: string | null; metered?: Metered | null }>;

/**
 * Prepare every report that is due at `now`: for each person with a
 * session, one `report_lead` before it, in their time zone, written by their
 * own key or the house assistant within their plan. The draft waits
 * for the person (in the app, and by email when they asked for it); nothing
 * is sent to anyone else. One person's failure does not stop the others.
 */
export async function prepareDueReports(
  runtime: ReportRuntime,
  now: Date,
  options: { modelFor?: ModelFor } = {},
): Promise<{ prepared: number; failed: number }> {
  const { log } = runtime;
  let prepared = 0;
  let failed = 0;
  for (const person of await runtime.reportSchedules(now)) {
    try {
      const scope = await runtime.repositories.forUser(person.userId);
      const plan = planScheduledReport({
        schedule: person.schedule,
        timeZone: person.timeZone,
        reports: await scope.reports.recent(),
        now,
      });
      if (plan.action === "wait") continue;
      const { model, problem, metered } = await (options.modelFor ?? ((s) => reportModel(s, runtime.config)))(
        scope,
      );
      const result = await prepareReport({
        scope,
        period: plan.period,
        ...(plan.action === "retarget" ? { reportId: plan.reportId, untouched: true } : {}),
        model,
        modelProblem: problem,
        metered: metered ?? null,
        installationLanguage: runtime.config.language,
        log,
      });
      if (!result) continue;
      prepared += 1;
      await notifyReportReady({
        scope,
        email: runtime.email,
        report: result.report,
        origin: runtime.config.url.origin,
        language: runtime.config.language,
        log,
      });
    } catch (error) {
      failed += 1;
      log.error("report.prepare_failed", { userId: person.userId, error });
    }
  }
  return { prepared, failed };
}
