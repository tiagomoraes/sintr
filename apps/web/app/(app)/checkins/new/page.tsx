import type { Metadata } from "next";
import { PageHeading } from "@/components/empty-state";
import { CheckinSteps } from "@/components/ledger/checkin-steps";
import { requireScope } from "@/lib/server/runtime";
import { getMessages } from "@/lib/server/language";
import { createCheckin } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).checkin.newTitle };
}

export default async function NewCheckinPage() {
  const t = await getMessages();
  await requireScope();
  return (
    <>
      <PageHeading title={t.checkin.title} lede={t.checkin.lede} />
      <CheckinSteps action={createCheckin} cancelHref="/checkins" />
    </>
  );
}
