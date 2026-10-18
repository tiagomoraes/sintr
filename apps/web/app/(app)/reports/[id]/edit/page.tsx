import { parseContent } from "@sintr/core";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeading } from "@/components/empty-state";
import { ReportEditor } from "@/components/reports/report-editor";
import { requireScope } from "@/lib/server/runtime";

export const metadata: Metadata = { title: "Change the report" };

export default async function EditReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { scope } = await requireScope();
  const report = await scope.reports.get(id);
  if (!report) notFound();
  if (report.status === "sent") redirect(`/reports/${id}`);
  const content = parseContent(report.content);
  if (!content) notFound();

  return (
    <>
      <PageHeading
        title="Change the report"
        lede="Rewrite what you want, remove what you would rather not share. Your words in the entries stay as they are."
      />
      <ReportEditor id={id} content={content} />
    </>
  );
}
