"use client";

import { Wordmark, cn } from "@sintr/ui";
import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { useMessages } from "@/components/language";

/**
 * The header bar: wordmark on the left, a few quiet actions on the right.
 * `sticky` keeps it at the top of a phone (the diary's, where the assistant's
 * corner is in it), clear at first and paper once the page scrolls under it.
 */
export function SiteHeader({
  home = "/",
  sticky = false,
  children,
}: {
  home?: string;
  sticky?: boolean;
  children?: ReactNode;
}) {
  const t = useMessages();
  const header = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = header.current;
    if (!sticky || !element) return;
    const mark = () => {
      if (window.scrollY > 4) element.dataset.scrolled = "true";
      else delete element.dataset.scrolled;
    };
    mark();
    window.addEventListener("scroll", mark, { passive: true });
    return () => window.removeEventListener("scroll", mark);
  }, [sticky]);
  return (
    <header ref={header} className={cn("relative z-20", sticky && "sintr-header--sticky")}>
      <div className="wrap flex min-h-[72px] items-center justify-between gap-6 md:min-h-[88px]">
        <Link href={home} aria-label={t.shell.homeLink} className="no-underline">
          <Wordmark />
        </Link>
        {children ? <nav className="flex items-center gap-[clamp(14px,2.4vw,34px)]">{children}</nav> : null}
      </div>
    </header>
  );
}

export function HeaderLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="py-1.5 text-label font-medium text-ink-2 no-underline transition-colors duration-300 hover:text-ink"
    >
      {children}
    </Link>
  );
}
