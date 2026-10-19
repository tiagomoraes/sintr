import { NotebookCard, NotebookHead, buttonVariants, linkStyles } from "@sintr/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckinValues } from "@/components/ledger/checkin-values";
import { Corrections } from "@/components/ledger/corrections";
import { formatMoment } from "@/lib/format";
import { CHECKIN_LABELS } from "@/lib/labels";
import { requireScope } from "@/lib/server/runtime";
import { currentLanguage } from "@/lib/server/language";

export const metadata: Metadata = { title: "Check-in" };

export default async function CheckinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { scope } = await requireScope();
  const checkin = await scope.checkins.get(id);
  if (!checkin) notFound();
  const [profile, corrections] = await Promise.all([scope.profile.get(), scope.checkins.corrections(id)]);
  const locale = { language: (await currentLanguage()).code, timezone: profile.timezone };

  return (
    <>
      <p className="mb-6">
        <Link href="/checkins" className={linkStyles}>
          All check-ins
        </Link>
      </p>
      <h1 className="sr-only">Check-in of {formatMoment(checkin.occurredAt, locale)}</h1>
      <NotebookCard className="max-w-[40rem] shadow-lift">
        <NotebookHead
          time={formatMoment(checkin.occurredAt, locale)}
          tag={corrections.length > 0 ? "Check-in, changed later" : "Check-in"}
        />
        <CheckinValues checkin={checkin} />
      </NotebookCard>
      <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3">
        <Link href={`/checkins/${id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          Change this check-in
        </Link>
      </div>
      <Corrections corrections={corrections} locale={locale} labels={CHECKIN_LABELS} />
    </>
  );
}
