import { buttonVariants, linkStyles } from "@sintr/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeading } from "@/components/empty-state";
import { formatMoment } from "@/lib/format";
import { requireScope } from "@/lib/server/runtime";
import { currentLanguage, getMessages } from "@/lib/server/language";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).entry.list.title };
}

const PAGE = 30;

export default async function EntriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { scope } = await requireScope();
  const before = (await searchParams).before;
  const to = typeof before === "string" && !Number.isNaN(Date.parse(before)) ? new Date(before) : undefined;
  const language = await currentLanguage();
  const E = (await getMessages()).entry;
  const L = E.list;
  const [entries, profile] = await Promise.all([
    scope.entries.list({ limit: PAGE + 1, ...(to ? { to } : {}) }),
    scope.profile.get(),
  ]);
  const shown = entries.slice(0, PAGE);
  const more = entries.length > PAGE ? shown.at(-1) : undefined;

  return (
    <>
      <PageHeading title={L.title} lede={L.lede} />
      <div className="-mt-4 mb-10 flex flex-wrap items-center gap-x-7 gap-y-3 md:-mt-6">
        <Link href="/home" className={buttonVariants({ size: "sm" })}>
          {L.talk}
        </Link>
        <p className="text-[0.9375rem] text-ink-3">{L.talkHint}</p>
      </div>
      {shown.length === 0 ? (
        to ? (
          <EmptyState title={L.earlierNone}>
            <p>
              <Link href="/entries" className={linkStyles}>
                {L.latest}
              </Link>
            </p>
          </EmptyState>
        ) : (
          <EmptyState title={L.empty}>
            <p>{L.emptyHint}</p>
          </EmptyState>
        )
      ) : (
        <ol className="border-t border-rule">
          {shown.map((entry) => {
            const words = entry.title ?? entry.situation ?? entry.notes ?? entry.thoughts?.[0] ?? null;
            return (
              <li key={entry.id} className="border-b border-rule">
                <Link href={`/entries/${entry.id}`} className="group block py-5 no-underline">
                  <span className="block font-serif italic text-ink-2">
                    {formatMoment(entry.occurredAt, { language: language.code, timezone: profile.timezone })}
                  </span>
                  {words ? (
                    <span className="mt-1 line-clamp-2 block font-serif text-title-small text-ink group-hover:underline group-hover:decoration-rule-strong group-hover:decoration-1 group-hover:underline-offset-[0.2em]">
                      {words}
                    </span>
                  ) : (
                    <span className="mt-1 block text-[0.9375rem] text-ink-3">{L.noWords}</span>
                  )}
                  {entry.emotions?.length ? (
                    <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-caption text-ink-3">
                      {entry.emotions.map((emotion, index) => (
                        <span key={index}>
                          {emotion.name}
                          {emotion.intensity !== null ? (
                            <span className="tabular-nums">, {E.intensity(emotion.intensity)}</span>
                          ) : null}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ol>
      )}
      {more ? (
        <p className="mt-8">
          <Link
            href={`/entries?before=${encodeURIComponent(more.occurredAt.toISOString())}`}
            className={linkStyles}
          >
            {L.earlier}
          </Link>
        </p>
      ) : null}
    </>
  );
}
