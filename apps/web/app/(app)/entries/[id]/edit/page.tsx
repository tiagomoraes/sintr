import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/empty-state";
import { EntryEditForm } from "@/components/ledger/entry-edit-form";
import { requireScope } from "@/lib/server/runtime";
import { correctEntry } from "../../actions";

export const metadata: Metadata = { title: "Change an entry" };

export default async function EditEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { scope } = await requireScope();
  const entry = await scope.entries.get(id);
  if (!entry) notFound();
  const profile = await scope.profile.get();

  return (
    <>
      <PageHeading
        title="Change this entry"
        lede="The entry will show your new words. What it said before is kept with the date of the change, so nothing is rewritten silently."
      />
      <EntryEditForm
        action={correctEntry.bind(null, id)}
        defaults={entry}
        timezone={profile.timezone}
        cancelHref={`/entries/${id}`}
      />
    </>
  );
}
