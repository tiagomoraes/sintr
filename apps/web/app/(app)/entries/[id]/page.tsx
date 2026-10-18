import { NotebookCard, NotebookHead, buttonVariants, linkStyles } from "@sintr/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Corrections } from "@/components/ledger/corrections";
import { EntryRows } from "@/components/ledger/entry-rows";
import { formatMoment } from "@/lib/format";
import { ENTRY_LABELS } from "@/lib/labels";
import { requireScope } from "@/lib/server/runtime";

export const metadata: Metadata = { title: "Entry" };

export default async function EntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { scope } = await requireScope();
  const entry = await scope.entries.get(id);
  if (!entry) notFound();
  const [profile, corrections] = await Promise.all([scope.profile.get(), scope.entries.corrections(id)]);
  const locale = { language: profile.language, timezone: profile.timezone };

  return (
    <>
      <p className="mb-6">
        <Link href="/entries" className={linkStyles}>
          All entries
        </Link>
      </p>
      <h1 className="sr-only">Entry of {formatMoment(entry.occurredAt, locale)}</h1>
      <NotebookCard className="max-w-[46rem] shadow-lift">
        <NotebookHead
          time={formatMoment(entry.occurredAt, locale)}
          tag={corrections.length > 0 ? "Entry, changed later" : "Entry"}
        />
        <EntryRows entry={entry} />
      </NotebookCard>
      <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3">
        <Link href={`/entries/${id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          Change this entry
        </Link>
        <p className="text-[0.9375rem] text-ink-3">Changes are dated, and what it said before is kept.</p>
      </div>
      <Corrections corrections={corrections} locale={locale} labels={ENTRY_LABELS} />
    </>
  );
}
