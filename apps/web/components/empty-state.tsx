import type { ReactNode } from "react";

/** A calm empty state: quiet weeks are fine and nothing here nags. */
export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t border-rule pt-8">
      <h2 className="font-serif text-title-small font-normal text-ink">{title}</h2>
      <div className="mt-3 max-w-[36em] space-y-3 text-ink-2">{children}</div>
    </div>
  );
}

/** The page heading of the authenticated shell. Rank is carried by size alone. */
export function PageHeading({ title, lede }: { title: string; lede?: string }) {
  return (
    <header className="mb-10 md:mb-14">
      <h1 className="text-title">{title}</h1>
      {lede ? <p className="mt-4 max-w-[34em] text-lede text-ink-2">{lede}</p> : null}
    </header>
  );
}
