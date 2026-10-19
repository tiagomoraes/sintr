"use client";

import { cn } from "@sintr/ui";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * The parts of the diary's shell that depend on the page. The layout stays
 * mounted while the person moves between pages, so these read the current
 * path on the client rather than the path of the first request.
 */

function inPractice(pathname: string): boolean {
  return pathname === "/practice" || pathname.startsWith("/practice/");
}

/** The main column: the practice dashboard is wider, to read a report beside its list. */
export function ShellMain({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <main
      id="main"
      className={cn(
        "col-span-12 min-[900px]:col-span-9",
        !inPractice(pathname) && "min-[900px]:max-w-[52rem]",
      )}
    >
      {children}
    </main>
  );
}

/** The crisis lines on the person's pages; a note for the professional on the practice's. */
export function ShellFooter({ person, practice }: { person: ReactNode; practice: ReactNode }) {
  return <>{inPractice(usePathname()) ? practice : person}</>;
}

/** Shown except on the pages under these paths (a notice that would repeat the page). */
export function ExceptOn({ paths, children }: { paths: readonly string[]; children: ReactNode }) {
  const pathname = usePathname();
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`)) ? null : children;
}
