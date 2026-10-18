import type { Metadata } from "next";
import { EmptyState, PageHeading } from "@/components/empty-state";
import { formatMoment } from "@/lib/format";
import { requireScope } from "@/lib/server/runtime";

export const metadata: Metadata = { title: "Entries" };

export default async function EntriesPage() {
  const { scope } = await requireScope();
  const [entries, profile] = await Promise.all([scope.entries.list({ limit: 50 }), scope.profile.get()]);

  return (
    <>
      <PageHeading
        title="Entries"
        lede="The moments you choose to write down: what happened, what went through your mind, how strong it felt."
      />
      {entries.length === 0 ? (
        <EmptyState title="Nothing written yet.">
          <p>
            When something happens, it can be kept here in your own words, as much or as little as you want. A
            partial entry is a real entry; it can grow later.
          </p>
        </EmptyState>
      ) : (
        <ol className="border-t border-rule">
          {entries.map((entry) => {
            const words = entry.title ?? entry.situation;
            return (
              <li key={entry.id} className="border-b border-rule py-5">
                <p className="font-serif italic text-ink-2">{formatMoment(entry.occurredAt, profile)}</p>
                {words ? (
                  <p className="mt-1 line-clamp-2 font-serif text-title-small text-ink">{words}</p>
                ) : (
                  <p className="mt-1 text-[0.9375rem] text-ink-3">An entry without words yet.</p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
