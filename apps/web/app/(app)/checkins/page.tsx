import type { Metadata } from "next";
import { EmptyState, PageHeading } from "@/components/empty-state";
import { formatMoment } from "@/lib/format";
import { requireScope } from "@/lib/server/runtime";

export const metadata: Metadata = { title: "Check-ins" };

function Value({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  if (value === null) return null;
  return (
    <span className="inline-flex items-baseline gap-2">
      <span className="text-caption text-ink-3">{label}</span>
      <span className="font-serif text-[1.375rem] tabular-nums text-ink">{value}</span>
      <span className="text-caption text-ink-3">{unit}</span>
    </span>
  );
}

export default async function CheckinsPage() {
  const { scope } = await requireScope();
  const [checkins, profile] = await Promise.all([scope.checkins.list({ limit: 60 }), scope.profile.get()]);

  return (
    <>
      <PageHeading
        title="Check-ins"
        lede="One line about the day: mood, energy, anxiety, sleep. Only what you give."
      />
      {checkins.length === 0 ? (
        <EmptyState title="No check-ins yet.">
          <p>
            A check-in takes a few seconds and nothing in it is required. Quiet days are fine, and nothing
            here is a score.
          </p>
        </EmptyState>
      ) : (
        <ol className="border-t border-rule">
          {checkins.map((checkin) => (
            <li key={checkin.id} className="border-b border-rule py-5">
              <p className="font-serif italic text-ink-2">{formatMoment(checkin.occurredAt, profile)}</p>
              <div className="mt-2 flex flex-wrap gap-x-7 gap-y-2">
                <Value label="Mood" value={checkin.mood} unit="of 5" />
                <Value label="Energy" value={checkin.energy} unit="of 5" />
                <Value label="Anxiety" value={checkin.anxiety} unit="of 5" />
                <Value label="Sleep" value={checkin.sleepHours} unit="hours" />
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
