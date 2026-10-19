import { apiError, apiScope } from "@/lib/server/runtime";

export const dynamic = "force-dynamic";

/**
 * The approved PDF of a report a person shared with this practice, as an
 * attachment. Only through an active link of the account's own practice;
 * recorded in the audit of both accounts, like reading it.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await apiScope(request);
  if (guard instanceof Response) return guard;
  const { id } = await params;
  const found = await guard.scope.practice.reportPdf(id);
  if (!found) return apiError(404, "not_found");
  const name = `sintr-report-${found.label.replace(/[^0-9A-Za-z-]/gu, "")}.pdf`;
  return new Response(Buffer.from(found.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
