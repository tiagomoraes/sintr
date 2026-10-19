import { NotebookCard, NotebookHead, buttonVariants, linkStyles } from "@sintr/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Corrections } from "@/components/ledger/corrections";
import { EntryRows } from "@/components/ledger/entry-rows";
import { formatMoment } from "@/lib/format";
import { requireScope } from "@/lib/server/runtime";
import { currentLanguage, getMessages } from "@/lib/server/language";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).entry.record.title };
}

export default async function EntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { scope } = await requireScope();
  const entry = await scope.entries.get(id);
  if (!entry) notFound();
  const [profile, corrections] = await Promise.all([scope.profile.get(), scope.entries.corrections(id)]);
  const locale = { language: (await currentLanguage()).code, timezone: profile.timezone };
  const R = (await getMessages()).entry.record;

  return (
    <>
      <p className="mb-6">
        <Link href="/entries" className={linkStyles}>
          {R.all}
        </Link>
      </p>
      <h1 className="sr-only">{R.heading(formatMoment(entry.occurredAt, locale))}</h1>
      <NotebookCard className="max-w-[46rem] shadow-lift">
        <NotebookHead
          time={formatMoment(entry.occurredAt, locale)}
          tag={corrections.length > 0 ? R.tagChanged : R.tag}
        />
        <EntryRows entry={entry} />
      </NotebookCard>
      <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3">
        <Link href={`/entries/${id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          {R.change}
        </Link>
        <p className="text-[0.9375rem] text-ink-3">{R.changeHint}</p>
      </div>
      <Corrections corrections={corrections} locale={locale} kind="entry" />
    </>
  );
}
