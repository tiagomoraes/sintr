import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/empty-state";
import { EntryEditForm } from "@/components/ledger/entry-edit-form";
import { getMessages } from "@/lib/server/language";
import { requireScope } from "@/lib/server/runtime";
import { correctEntry } from "../../actions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).entry.edit.title };
}

export default async function EditEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { scope } = await requireScope();
  const entry = await scope.entries.get(id);
  if (!entry) notFound();
  const profile = await scope.profile.get();
  const E = (await getMessages()).entry.edit;

  return (
    <>
      <PageHeading title={E.heading} lede={E.lede} />
      <EntryEditForm
        action={correctEntry.bind(null, id)}
        defaults={entry}
        timezone={profile.timezone}
        cancelHref={`/entries/${id}`}
      />
    </>
  );
}
