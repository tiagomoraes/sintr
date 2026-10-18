import { buttonVariants, linkStyles } from "@sintr/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeading } from "@/components/empty-state";
import { formatMoment } from "@/lib/format";
import { requireScope } from "@/lib/server/runtime";

export const metadata: Metadata = { title: "Check-ins" };

const PAGE = 40;

function Value({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  if (value === null) return null;
  return (
    <span className="inline-flex items-baseline gap-2 whitespace-nowrap">
      <span className="text-caption text-ink-3">{label}</span>
      <span className="font-serif text-[1.375rem] tabular-nums text-ink">{value}</span>
      <span className="text-caption text-ink-3">{unit}</span>
    </span>
  );
}

export default async function CheckinsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { scope } = await requireScope();
  const before = (await searchParams).before;
  const to = typeof before === "string" && !Number.isNaN(Date.parse(before)) ? new Date(before) : undefined;
  const [checkins, profile] = await Promise.all([
    scope.checkins.list({ limit: PAGE + 1, ...(to ? { to } : {}) }),
    scope.profile.get(),
  ]);
  const shown = checkins.slice(0, PAGE);
  const more = checkins.length > PAGE ? shown.at(-1) : undefined;

  return (
    <>
      <PageHeading
        title="Check-ins"
        lede="One line about the day: mood, energy, anxiety, sleep. Only what you give."
      />
      <div className="-mt-4 mb-10 md:-mt-6">
        <Link href="/checkins/new" className={buttonVariants({ size: "sm" })}>
          New check-in
        </Link>
      </div>
      {shown.length === 0 ? (
        <EmptyState title={to ? "Nothing earlier than this." : "No check-ins yet."}>
          {to ? (
            <p>
              <Link href="/checkins" className={linkStyles}>
                Back to the latest check-ins
              </Link>
            </p>
          ) : (
            <p>
              A check-in takes a few seconds and nothing in it is required. Quiet days are fine, and nothing
              here is a score.
            </p>
          )}
        </EmptyState>
      ) : (
        <ol className="border-t border-rule">
          {shown.map((checkin) => (
            <li key={checkin.id} className="border-b border-rule">
              <Link href={`/checkins/${checkin.id}`} className="group block py-5 no-underline">
                <span className="block font-serif italic text-ink-2 group-hover:text-ink">
                  {formatMoment(checkin.occurredAt, profile)}
                </span>
                <span className="mt-2 flex flex-wrap gap-x-7 gap-y-2">
                  <Value label="Mood" value={checkin.mood} unit="of 5" />
                  <Value label="Energy" value={checkin.energy} unit="of 5" />
                  <Value label="Anxiety" value={checkin.anxiety} unit="of 5" />
                  <Value label="Sleep" value={checkin.sleepHours} unit="hours" />
                </span>
                {checkin.note ? (
                  <span className="mt-2 line-clamp-2 block font-serif text-ink-2">{checkin.note}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ol>
      )}
      {more ? (
        <p className="mt-8">
          <Link
            href={`/checkins?before=${encodeURIComponent(more.occurredAt.toISOString())}`}
            className={linkStyles}
          >
            Earlier check-ins
          </Link>
        </p>
      ) : null}
    </>
  );
}
