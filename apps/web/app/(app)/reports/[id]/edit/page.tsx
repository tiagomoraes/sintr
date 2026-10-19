import { parseContent } from "@sintr/core";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeading } from "@/components/empty-state";
import { ReportEditor } from "@/components/reports/report-editor";
import { getMessages } from "@/lib/server/language";
import { requireScope } from "@/lib/server/runtime";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).reports.editor.title };
}

export default async function EditReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { scope } = await requireScope();
  const report = await scope.reports.get(id);
  if (!report) notFound();
  // A sent or shared report is final.
  if (report.status === "sent" || report.sharedAt) redirect(`/reports/${id}`);
  const content = parseContent(report.content);
  if (!content) notFound();
  const { editor } = (await getMessages()).reports;

  return (
    <>
      <PageHeading title={editor.title} lede={editor.lede} />
      <ReportEditor id={id} content={content} />
    </>
  );
}
