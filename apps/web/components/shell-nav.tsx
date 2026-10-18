"use client";

import { cn } from "@sintr/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const SECTIONS = [
  { href: "/entries", label: "Entries" },
  { href: "/checkins", label: "Check-ins" },
  { href: "/therapy", label: "Therapy" },
  { href: "/reports", label: "Reports" },
] as const;

/**
 * The contents list of the diary: links on one left hairline, the current
 * one in ink with a dot on the line. Under 900px it becomes a row of tabs
 * on a hairline baseline.
 */
export function ShellNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Your diary">
      <p className="hidden text-caption text-ink-3 min-[900px]:block">Your diary</p>
      <ul className="flex gap-[26px] overflow-x-auto border-b border-rule min-[900px]:mt-3 min-[900px]:block min-[900px]:overflow-visible min-[900px]:border-b-0 min-[900px]:border-l">
        {SECTIONS.map((section) => {
          const current = pathname === section.href || pathname.startsWith(`${section.href}/`);
          return (
            <li key={section.href} className="relative shrink-0">
              <Link
                href={section.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "relative block whitespace-nowrap pb-3.5 pt-2.5 text-label font-medium no-underline transition-colors duration-300",
                  "min-[900px]:py-1.5 min-[900px]:pl-4 min-[900px]:text-[0.9375rem]",
                  current ? "text-ink" : "text-ink-3 hover:text-ink",
                  // tab underline under 900px, dot on the hairline above
                  current &&
                    "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-ink min-[900px]:after:hidden",
                  current &&
                    "min-[900px]:before:absolute min-[900px]:before:left-[-4px] min-[900px]:before:top-1/2 min-[900px]:before:size-[7px] min-[900px]:before:-translate-y-1/2 min-[900px]:before:rounded-full min-[900px]:before:bg-ink",
                )}
              >
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
