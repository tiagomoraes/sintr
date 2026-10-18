import { prepareReport, reportModel } from "@sintr/agent";
import {
  EmailError,
  InvalidStateError,
  NotFoundError,
  ValidationError,
  approveReport,
  editReport,
  periodAgain,
  sendReport,
} from "@sintr/core";
import { PdfRenderError } from "@sintr/core/pdf";
import { z } from "zod";
import { known, printPdf } from "@/lib/server/reports";
import { apiError, apiScope, runtime } from "@/lib/server/runtime";

export const dynamic = "force-dynamic";

const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("prepare_again") }),
  // `recipient`: the address the person saw when they said yes.
  z.object({ action: z.literal("send"), recipient: z.string().min(3).max(320), confirmed: z.literal(true) }),
]);

function failure(error: unknown, route: string): Response {
  if (error instanceof NotFoundError) return apiError(404, "not_found");
  if (error instanceof InvalidStateError) return apiError(409, "invalid_state");
  if (error instanceof ValidationError) return apiError(400, "invalid", { fields: error.fields });
  if (error instanceof EmailError) return apiError(503, error.code);
  if (error instanceof PdfRenderError) return apiError(503, "pdf_unavailable");
  runtime().log.error("api.report_failed", { route, error });
  return apiError(500, "failed");
}

/** The person's decisions on a report: approve it, prepare it again, send it. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await apiScope(request);
  if (guard instanceof Response) return guard;
  const { scope } = guard;
  const { id } = await params;
  const parsed = Action.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_request");
  const report = await scope.reports.get(id);
  if (!report) return apiError(404, "not_found");
  const { config, email, log } = runtime();

  try {
    switch (parsed.data.action) {
      case "approve":
        await approveReport(scope, id, printPdf);
        break;
      case "prepare_again": {
        if (report.status === "sent") return apiError(409, "invalid_state");
        const [settings, profile] = await Promise.all([scope.therapySettings.get(), scope.profile.get()]);
        const period = periodAgain(known([report])[0]!, settings, profile.timezone, new Date());
        const { model, problem } = await reportModel(scope, config);
        await prepareReport({
          scope,
          period,
          reportId: id,
          model,
          modelProblem: problem,
          log,
          abortSignal: request.signal,
        });
        break;
      }
      case "send":
        await sendReport({ scope, email, reportId: id, recipient: parsed.data.recipient, log });
        break;
    }
  } catch (error) {
    return failure(error, "/api/reports/[id]");
  }
  const updated = await scope.reports.get(id);
  return Response.json({ id, status: updated?.status ?? report.status });
}

const Edit = z.object({ content: z.unknown() });

/** The person's change to the words. What it said before is kept. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await apiScope(request);
  if (guard instanceof Response) return guard;
  const { scope } = guard;
  const { id } = await params;
  const parsed = Edit.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_request");
  try {
    const updated = await editReport(scope, id, parsed.data.content);
    return Response.json({ id, status: updated.status });
  } catch (error) {
    return failure(error, "/api/reports/[id]");
  }
}
