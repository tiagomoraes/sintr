import { NotebookCard, NotebookHead, buttonVariants, linkStyles } from "@sintr/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckinValues } from "@/components/ledger/checkin-values";
import { Corrections } from "@/components/ledger/corrections";
import { formatMoment } from "@/lib/format";
import { requireScope } from "@/lib/server/runtime";
import { currentLanguage, getMessages } from "@/lib/server/language";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).checkin.record.title };
}

export default async function CheckinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { scope } = await requireScope();
  const checkin = await scope.checkins.get(id);
  if (!checkin) notFound();
  const [profile, corrections] = await Promise.all([scope.profile.get(), scope.checkins.corrections(id)]);
  const locale = { language: (await currentLanguage()).code, timezone: profile.timezone };
  const R = (await getMessages()).checkin.record;

  return (
    <>
      <p className="mb-6">
        <Link href="/checkins" className={linkStyles}>
          {R.all}
        </Link>
      </p>
      <h1 className="sr-only">{R.heading(formatMoment(checkin.occurredAt, locale))}</h1>
      <NotebookCard className="max-w-[40rem] shadow-lift">
        <NotebookHead
          time={formatMoment(checkin.occurredAt, locale)}
          tag={corrections.length > 0 ? R.tagChanged : R.tag}
        />
        <CheckinValues checkin={checkin} />
      </NotebookCard>
      <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3">
        <Link href={`/checkins/${id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          {R.change}
        </Link>
      </div>
      <Corrections corrections={corrections} locale={locale} kind="checkin" />
    </>
  );
}
