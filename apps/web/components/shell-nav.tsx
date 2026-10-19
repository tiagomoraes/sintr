"use client";

import { cn } from "@sintr/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export const SECTIONS = [
  { href: "/talk", label: "Talk" },
  { href: "/entries", label: "Entries" },
  { href: "/checkins", label: "Check-ins" },
  { href: "/therapy", label: "Therapy" },
  { href: "/reports", label: "Reports" },
  { href: "/sharing", label: "Sharing" },
  { href: "/connect", label: "Connect" },
  { href: "/settings", label: "Settings" },
] as const;

const PRACTICE = { href: "/practice", label: "Practice" } as const;

function NavLink({
  href,
  label,
  current,
  dot,
  className,
}: {
  href: string;
  label: string;
  current: boolean;
  dot: boolean;
  className?: string;
}) {
  return (
    <li className={cn("relative shrink-0", className)}>
      <Link
        href={href}
        aria-current={current ? "page" : undefined}
        className={cn(
          "relative flex items-center gap-2 whitespace-nowrap pb-3.5 pt-2.5 text-label font-medium no-underline transition-colors duration-300",
          "min-[900px]:py-1.5 min-[900px]:pl-4 min-[900px]:text-[0.9375rem]",
          current ? "text-ink" : "text-ink-3 hover:text-ink",
          // tab underline under 900px, dot on the hairline above
          current &&
            "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-ink min-[900px]:after:hidden",
          current &&
            "min-[900px]:before:absolute min-[900px]:before:left-[-4px] min-[900px]:before:top-1/2 min-[900px]:before:size-[7px] min-[900px]:before:-translate-y-1/2 min-[900px]:before:rounded-full min-[900px]:before:bg-ink",
        )}
      >
        {label}
        {dot ? (
          <>
            <span
              aria-hidden="true"
              className="size-[6px] rounded-full bg-draft shadow-[0_0_0_2px_#fbe6da]"
            />
            <span className="sr-only">, something new</span>
          </>
        ) : null}
      </Link>
    </li>
  );
}

/**
 * The contents list of the diary: links on one left hairline, the current
 * one in ink with a dot on the line. Under 900px it becomes a row of tabs
 * on a hairline baseline. An account that opened a practice gets a second
 * group for it; anything new shows as a small dot beside the section.
 */
export function ShellNav({
  practice = false,
  dots = { sharing: false, practice: false },
}: {
  practice?: boolean;
  dots?: { sharing: boolean; practice: boolean };
}) {
  const pathname = usePathname();
  const isCurrent = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const tabs = useRef<HTMLUListElement>(null);
  // Under 900px the sections are one scrolling row of tabs: keep the current one in view.
  useEffect(() => {
    const row = tabs.current;
    const current = row?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!row || !current || row.scrollWidth <= row.clientWidth) return;
    row.scrollLeft = current.offsetLeft - row.offsetLeft - 16;
  }, [pathname]);
  return (
    <nav aria-label="Your diary">
      <p className="hidden text-caption text-ink-3 min-[900px]:block">Your diary</p>
      <ul
        ref={tabs}
        className="flex gap-[26px] overflow-x-auto border-b border-rule min-[900px]:mt-3 min-[900px]:block min-[900px]:overflow-visible min-[900px]:border-b-0 min-[900px]:border-l"
      >
        {SECTIONS.map((section) => (
          <NavLink
            key={section.href}
            href={section.href}
            label={section.label}
            current={isCurrent(section.href)}
            dot={section.href === "/sharing" && dots.sharing}
            className={section.href === "/settings" ? "min-[900px]:mt-5" : undefined}
          />
        ))}
        {practice ? (
          <NavLink
            href={PRACTICE.href}
            label={PRACTICE.label}
            current={isCurrent(PRACTICE.href)}
            dot={dots.practice}
            className="min-[900px]:hidden"
          />
        ) : null}
      </ul>
      {practice ? (
        <div className="hidden min-[900px]:block">
          <p className="mt-9 text-caption text-ink-3">Your practice</p>
          <ul className="mt-3 border-l border-rule">
            <NavLink
              href={PRACTICE.href}
              label="Dashboard"
              current={isCurrent(PRACTICE.href)}
              dot={dots.practice}
            />
          </ul>
        </div>
      ) : null}
    </nav>
  );
}
