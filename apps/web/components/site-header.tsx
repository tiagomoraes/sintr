import { Wordmark } from "@sintr/ui";
import Link from "next/link";
import type { ReactNode } from "react";

/** The header bar: wordmark on the left, a few quiet actions on the right. */
export function SiteHeader({ home = "/", children }: { home?: string; children?: ReactNode }) {
  return (
    <header className="relative z-20">
      <div className="wrap flex min-h-[72px] items-center justify-between gap-6 md:min-h-[88px]">
        <Link href={home} aria-label="sintr, home" className="no-underline">
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
