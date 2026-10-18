import type { Metadata } from "next";
import { PageHeading } from "@/components/empty-state";
import { CheckinForm } from "@/components/ledger/checkin-form";
import { requireScope } from "@/lib/server/runtime";
import { createCheckin } from "../actions";

export const metadata: Metadata = { title: "New check-in" };

export default async function NewCheckinPage() {
  const { scope } = await requireScope();
  const profile = await scope.profile.get();
  return (
    <>
      <PageHeading
        title="A quick check-in."
        lede="Only what you want to give. Nothing here is required, and nothing is a score."
      />
      <CheckinForm
        action={createCheckin}
        timezone={profile.timezone}
        submitLabel="Save check-in"
        cancelHref="/checkins"
      />
    </>
  );
}
