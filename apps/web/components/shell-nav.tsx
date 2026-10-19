"use client";

import { cn } from "@sintr/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { useMessages } from "@/components/language";
import type { Messages } from "@/messages";

type Section = keyof Messages["shell"]["about"];

export const SECTIONS: readonly { href: string; key: Section }[] = [
  { href: "/home", key: "home" },
  { href: "/entries", key: "entries" },
  { href: "/checkins", key: "checkins" },
  { href: "/therapy", key: "therapy" },
  { href: "/reports", key: "reports" },
  { href: "/sharing", key: "sharing" },
  { href: "/connect", key: "connect" },
  { href: "/settings", key: "settings" },
];

const PLAN = { href: "/plan", key: "plan" } as const;
const PRACTICE = { href: "/practice", key: "practice" } as const;

/** The home answers for Talk too: a conversation is the home, continued. */
function isCurrent(pathname: string, href: string): boolean {
  if (href === "/home") return pathname === "/home" || pathname === "/talk" || pathname.startsWith("/talk/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Dot() {
  const t = useMessages();
  return (
    <>
      <span aria-hidden="true" className="size-[6px] rounded-full bg-draft shadow-[0_0_0_2px_#fbe6da]" />
      <span className="sr-only">{t.shell.nav.something}</span>
    </>
  );
}

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
    <li className={cn("relative", className)}>
      <Link
        href={href}
        aria-current={current ? "page" : undefined}
        className={cn(
          "relative flex items-center gap-2 whitespace-nowrap py-1.5 pl-4 text-[0.9375rem] font-medium no-underline transition-colors duration-300",
          current ? "text-ink" : "text-ink-3 hover:text-ink",
          current &&
            "before:absolute before:left-[-4px] before:top-1/2 before:size-[7px] before:-translate-y-1/2 before:rounded-full before:bg-ink",
        )}
      >
        {label}
        {dot ? <Dot /> : null}
      </Link>
    </li>
  );
}

export interface ShellNavProps {
  practice?: boolean;
  plan?: boolean;
  dots?: { sharing: boolean; practice: boolean };
}

function sectionsFor(plan: boolean) {
  return plan ? [...SECTIONS, PLAN] : [...SECTIONS];
}

/**
 * The contents list of the diary, from 900px up: links on one left
 * hairline, the current one in ink with a dot on the line. An account that
 * opened a practice gets a second group for it; anything new shows as a
 * small dot beside the section. Plan follows Settings where there is a plan
 * to see (a house assistant, or payments). On a phone the same sections
 * live in the menu (`PhoneMenu`).
 */
export function ShellNav({
  practice = false,
  plan = false,
  dots = { sharing: false, practice: false },
}: ShellNavProps) {
  const t = useMessages();
  const pathname = usePathname();
  return (
    <nav aria-label={t.shell.nav.label} className="hidden min-[900px]:block">
      <p className="text-caption text-ink-3">{t.shell.nav.label}</p>
      <ul className="mt-3 border-l border-rule">
        {sectionsFor(plan).map((section) => (
          <NavLink
            key={section.href}
            href={section.href}
            label={t.shell.nav[section.key]}
            current={isCurrent(pathname, section.href)}
            dot={section.href === "/sharing" && dots.sharing}
            className={section.href === "/settings" ? "mt-5" : undefined}
          />
        ))}
      </ul>
      {practice ? (
        <>
          <p className="mt-9 text-caption text-ink-3">{t.shell.nav.practiceLabel}</p>
          <ul className="mt-3 border-l border-rule">
            <NavLink
              href={PRACTICE.href}
              label={t.shell.nav.dashboard}
              current={isCurrent(pathname, PRACTICE.href)}
              dot={dots.practice}
            />
          </ul>
        </>
      ) : null}
    </nav>
  );
}

/**
 * Under 900px: one Menu pill in the header that opens every section as a
 * sheet, each with a line saying what is there. A native dialog, so focus
 * stays inside while it is open and Escape closes it.
 */
export function PhoneMenu({
  practice = false,
  plan = false,
  dots = { sharing: false, practice: false },
  footer,
}: ShellNavProps & { footer?: ReactNode }) {
  const t = useMessages();
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  // Moving to another page closes the sheet.
  useEffect(() => {
    dialog.current?.close();
  }, [pathname]);
  const anyDot = dots.sharing || (practice && dots.practice);
  const items: { href: string; key: Section; dot: boolean }[] = [
    ...sectionsFor(plan).map((section) => ({ ...section, dot: section.href === "/sharing" && dots.sharing })),
    ...(practice ? [{ ...PRACTICE, dot: dots.practice }] : []),
  ];
  return (
    <div className="min-[900px]:hidden">
      {/* Without JavaScript the sheet cannot open: the sections are plain links instead. */}
      <noscript>
        <style>{".sintr-menu-button { display: none; }"}</style>
        <nav
          aria-label={t.shell.nav.label}
          className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-[0.9375rem]"
        >
          {items.map((item) => (
            <a key={item.href} href={item.href} className="text-ink-2 underline decoration-rule-strong">
              {t.shell.nav[item.key]}
            </a>
          ))}
        </nav>
      </noscript>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        aria-haspopup="dialog"
        className="sintr-menu-button inline-flex min-h-10 items-center gap-2 rounded-pill border border-rule bg-paper px-4 text-label font-medium text-ink-2 transition-colors duration-300 hover:border-rule-strong hover:text-ink"
      >
        <span aria-hidden="true" className="flex w-4 flex-col gap-[4px]">
          <span className="h-[1.5px] w-full rounded-pill bg-current" />
          <span className="h-[1.5px] w-3/4 rounded-pill bg-current" />
        </span>
        {t.shell.menu.open}
        {anyDot ? <Dot /> : null}
      </button>
      <dialog
        ref={dialog}
        aria-label={t.shell.menu.title}
        onClick={(event) => {
          // A tap on the backdrop (outside the sheet) closes it.
          if (event.target === dialog.current) dialog.current.close();
        }}
        className="sintr-sheet m-0 ml-auto h-dvh max-h-dvh w-[min(100vw,420px)] max-w-none bg-paper p-0 text-ink backdrop:bg-ink/20"
      >
        <div className="flex min-h-full flex-col px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-4">
          <div className="flex items-center justify-between">
            <p className="font-serif text-title-small text-ink">{t.shell.menu.title}</p>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className="inline-flex min-h-10 items-center rounded-pill border border-rule px-4 text-label font-medium text-ink-2 hover:text-ink"
            >
              {t.shell.menu.close}
            </button>
          </div>
          <nav aria-label={t.shell.nav.label} className="mt-6">
            <ul className="border-t border-rule">
              {items.map((item) => {
                const current = isCurrent(pathname, item.href);
                return (
                  <li key={item.href} className="border-b border-rule">
                    <Link
                      href={item.href}
                      aria-current={current ? "page" : undefined}
                      onClick={() => dialog.current?.close()}
                      className="block py-3.5 no-underline"
                    >
                      <span
                        className={cn(
                          "flex items-center gap-2 text-[1.0625rem] font-medium",
                          current ? "text-ink" : "text-ink-2",
                        )}
                      >
                        {current ? (
                          <span aria-hidden="true" className="size-[7px] rounded-full bg-ink" />
                        ) : null}
                        {t.shell.nav[item.key]}
                        {item.dot ? <Dot /> : null}
                      </span>
                      <span className="mt-0.5 block text-[0.875rem] text-ink-3">
                        {t.shell.about[item.key]}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          {footer ? <div className="mt-auto pt-8">{footer}</div> : null}
        </div>
      </dialog>
    </div>
  );
}
