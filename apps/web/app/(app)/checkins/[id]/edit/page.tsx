import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/empty-state";
import { CheckinForm } from "@/components/ledger/checkin-form";
import { getMessages } from "@/lib/server/language";
import { requireScope } from "@/lib/server/runtime";
import { correctCheckin } from "../../actions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).checkin.edit.title };
}

export default async function EditCheckinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { scope } = await requireScope();
  const checkin = await scope.checkins.get(id);
  if (!checkin) notFound();
  const profile = await scope.profile.get();
  const E = (await getMessages()).checkin.edit;
  return (
    <>
      <PageHeading title={E.heading} lede={E.lede} />
      <CheckinForm
        action={correctCheckin.bind(null, id)}
        defaults={checkin}
        timezone={profile.timezone}
        submitLabel={E.save}
        cancelHref={`/checkins/${id}`}
        correctionNote
      />
    </>
  );
}
