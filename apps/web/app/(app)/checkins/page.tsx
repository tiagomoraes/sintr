import { buttonVariants, linkStyles } from "@sintr/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeading } from "@/components/empty-state";
import { formatMoment } from "@/lib/format";
import { requireScope } from "@/lib/server/runtime";
import { currentLanguage, getMessages } from "@/lib/server/language";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).checkin.list.title };
}

const PAGE = 40;

function Value({ label, value, unit }: { label: string; value: string | null; unit: string }) {
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
  const language = await currentLanguage();
  const C = (await getMessages()).checkin;
  const L = C.list;
  // Numbers as the page writes them: "7.5", "7,5".
  const number = (value: number | null) =>
    value === null ? null : new Intl.NumberFormat(language.intl).format(value);
  const [checkins, profile] = await Promise.all([
    scope.checkins.list({ limit: PAGE + 1, ...(to ? { to } : {}) }),
    scope.profile.get(),
  ]);
  const shown = checkins.slice(0, PAGE);
  const more = checkins.length > PAGE ? shown.at(-1) : undefined;

  return (
    <>
      <PageHeading title={L.title} lede={L.lede} />
      <div className="-mt-4 mb-10 md:-mt-6">
        <Link href="/checkins/new" className={buttonVariants({ size: "sm" })}>
          {L.new}
        </Link>
      </div>
      {shown.length === 0 ? (
        <EmptyState title={to ? L.earlierNone : L.empty}>
          {to ? (
            <p>
              <Link href="/checkins" className={linkStyles}>
                {L.latest}
              </Link>
            </p>
          ) : (
            <p>{L.emptyHint}</p>
          )}
        </EmptyState>
      ) : (
        <ol className="border-t border-rule">
          {shown.map((checkin) => (
            <li key={checkin.id} className="border-b border-rule">
              <Link href={`/checkins/${checkin.id}`} className="group block py-5 no-underline">
                <span className="block font-serif italic text-ink-2 group-hover:text-ink">
                  {formatMoment(checkin.occurredAt, { language: language.code, timezone: profile.timezone })}
                </span>
                <span className="mt-2 flex flex-wrap gap-x-7 gap-y-2">
                  <Value label={C.labels.mood} value={number(checkin.mood)} unit={C.of5} />
                  <Value label={C.labels.energy} value={number(checkin.energy)} unit={C.of5} />
                  <Value label={C.labels.anxiety} value={number(checkin.anxiety)} unit={C.of5} />
                  <Value
                    label={C.labels.sleepHours}
                    value={number(checkin.sleepHours)}
                    unit={C.hours(checkin.sleepHours ?? 0)}
                  />
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
            {L.earlier}
          </Link>
        </p>
      ) : null}
    </>
  );
}
