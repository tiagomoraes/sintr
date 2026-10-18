import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn";

/**
 * The notebook card (DESIGN.md, Cards): white paper, a hairline edge, the
 * card shadow, one peach margin line 26px in, and sky-ruled rows. What the
 * system asks is in the small sans; what the person said is in the serif.
 * It is a size container: under 500px its rows stack label over value.
 */
export function NotebookCard({ className, children, ...props }: ComponentProps<"article">) {
  return (
    <article
      className={cn(
        "@container relative overflow-hidden rounded-file border border-rule bg-paper shadow-card",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-[26px] w-px bg-notebook-margin"
      />
      {children}
    </article>
  );
}

/** The head: the moment in serif italic, a small tag on the right, a hairline below. */
export function NotebookHead({
  time,
  tag,
  className,
}: {
  time: ReactNode;
  tag?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex items-baseline justify-between gap-4 border-b border-rule py-3 pl-11 pr-5",
        className,
      )}
    >
      <p className="font-serif text-[1rem] italic text-ink-2">{time}</p>
      {tag ? <p className="shrink-0 text-[0.75rem] text-ink-3">{tag}</p> : null}
    </header>
  );
}

/** A label and the person's words, on a notebook rule. Use inside a `<dl>`. */
export function NotebookRow({
  label,
  children,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-x-[18px] gap-y-1 border-b border-notebook-rule py-3 pl-11 pr-5 last:border-b-0",
        "@min-[500px]:grid-cols-[minmax(7rem,9.5rem)_minmax(0,1fr)]",
        className,
      )}
    >
      <dt className="pt-[0.18em] text-caption text-ink-3">{label}</dt>
      <dd className="m-0 font-serif text-[1.0625rem] leading-[1.45] text-ink">{children}</dd>
    </div>
  );
}

/** The small hairline pill of a scale value: "80 of 100". */
export function IntensityChip({
  value,
  of = 100,
  className,
}: {
  value: number;
  of?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "ml-2 inline-flex translate-y-[-0.08em] items-center whitespace-nowrap rounded-pill border border-rule px-2 py-px font-sans text-[0.75rem] tabular-nums leading-[1.5] text-ink-3",
        className,
      )}
    >
      {value} of {of}
    </span>
  );
}

/** A footer strip inside the card, for actions or a status line. */
export function NotebookFoot({ className, ...props }: ComponentProps<"footer">) {
  return (
    <footer
      className={cn(
        "flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-rule py-4 pl-11 pr-5",
        className,
      )}
      {...props}
    />
  );
}
