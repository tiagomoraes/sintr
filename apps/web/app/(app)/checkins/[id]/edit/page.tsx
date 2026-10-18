import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/empty-state";
import { CheckinForm } from "@/components/ledger/checkin-form";
import { requireScope } from "@/lib/server/runtime";
import { correctCheckin } from "../../actions";

export const metadata: Metadata = { title: "Change a check-in" };

export default async function EditCheckinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { scope } = await requireScope();
  const checkin = await scope.checkins.get(id);
  if (!checkin) notFound();
  const profile = await scope.profile.get();
  return (
    <>
      <PageHeading
        title="Change this check-in"
        lede="It will show the new values. The old ones are kept with the date of the change."
      />
      <CheckinForm
        action={correctCheckin.bind(null, id)}
        defaults={checkin}
        timezone={profile.timezone}
        submitLabel="Save the change"
        cancelHref={`/checkins/${id}`}
        correctionNote
      />
    </>
  );
}
