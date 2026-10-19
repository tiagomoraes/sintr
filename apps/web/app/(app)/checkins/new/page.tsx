import type { Metadata } from "next";
import { PageHeading } from "@/components/empty-state";
import { CheckinSteps } from "@/components/ledger/checkin-steps";
import { requireScope } from "@/lib/server/runtime";
import { t } from "@/messages";
import { createCheckin } from "../actions";

export const metadata: Metadata = { title: "New check-in" };

export default async function NewCheckinPage() {
  await requireScope();
  return (
    <>
      <PageHeading title={t.checkin.title} lede={t.checkin.lede} />
      <CheckinSteps action={createCheckin} cancelHref="/checkins" />
    </>
  );
}
