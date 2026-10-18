import { reportFilename, reportHtml, reportView } from "@sintr/core";
import { PdfRenderError } from "@sintr/core/pdf";
import { printPdf } from "@/lib/server/reports";
import { apiError, apiScope, runtime } from "@/lib/server/runtime";

export const dynamic = "force-dynamic";

/**
 * A report's PDF. A draft is printed on demand from its current words,
 * marked as a draft; an approved or sent report returns the PDF stored when
 * the person approved it, which is exactly the one sent.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await apiScope(request);
  if (guard instanceof Response) return guard;
  const { scope } = guard;
  const { id } = await params;
  const report = await scope.reports.get(id);
  if (!report) return apiError(404, "not_found");
  const view = await reportView(scope, report);
  if (!view) return apiError(404, "not_found");

  let pdf: Uint8Array | null = report.status === "draft" ? null : await scope.reports.readPdf(id);
  try {
    pdf ??= await printPdf(reportHtml(view));
  } catch (error) {
    if (error instanceof PdfRenderError) return apiError(503, "pdf_unavailable");
    runtime().log.error("api.report_pdf_failed", { route: "/api/reports/[id]/pdf", error });
    return apiError(500, "failed");
  }
  const name =
    report.status === "draft"
      ? reportFilename(view.period).replace(".pdf", "-draft.pdf")
      : reportFilename(view.period);
  const download = new URL(request.url).searchParams.get("download") === "1";
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name}"`,
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'self'",
    },
  });
}
