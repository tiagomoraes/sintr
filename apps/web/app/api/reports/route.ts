import { prepareReport, reportModel } from "@sintr/agent";
import { planReportNow } from "@sintr/core";
import { apiError, apiScope, runtime } from "@/lib/server/runtime";

export const dynamic = "force-dynamic";

/**
 * "Prepare it now": the report for the next session, covering what exists
 * so far (or the calendar week, without a session). The person is waiting
 * for it, so it is prepared in the request; the scheduled ones are the
 * worker's. Opens the report instead when there already is one.
 */
export async function POST(request: Request) {
  const guard = await apiScope(request);
  if (guard instanceof Response) return guard;
  const { scope } = guard;
  const { config, log } = runtime();
  const [schedule, profile, reports] = await Promise.all([
    scope.sessions.schedule(),
    scope.profile.get(),
    scope.reports.recent(),
  ]);
  const plan = planReportNow({ schedule, timeZone: profile.timezone, reports, now: new Date() });
  if (plan.action === "open") return Response.json({ id: plan.reportId, created: false });
  try {
    const { model, problem, metered } = await reportModel(scope, config);
    const result = await prepareReport({
      scope,
      period: plan.period,
      model,
      modelProblem: problem,
      metered,
      installationLanguage: config.language,
      log,
      abortSignal: request.signal,
    });
    if (!result) {
      const again = planReportNow({
        schedule,
        timeZone: profile.timezone,
        reports: await scope.reports.recent(),
        now: new Date(),
      });
      return again.action === "open"
        ? Response.json({ id: again.reportId, created: false })
        : apiError(409, "busy");
    }
    return Response.json({ id: result.report.id, created: true }, { status: 201 });
  } catch (error) {
    log.error("api.report_prepare_failed", { route: "/api/reports", error });
    return apiError(500, "failed");
  }
}
