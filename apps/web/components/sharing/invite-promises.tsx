"use client";

import { cn } from "@sintr/ui";
import { useMessages } from "@/components/language";

/**
 * What accepting a practice's invite means, in three lines: the consent
 * that follows says "as described above", so the invite's own page and
 * the welcome show exactly this.
 */
export function InvitePromises({ className }: { className?: string }) {
  const t = useMessages().sharing;
  return (
    <ul className={cn("list-none space-y-3 border-t border-ink p-0 pt-5 text-ink-2", className)}>
      <li>
        <span className="font-medium text-ink">{t.scope}</span> {t.never}
      </li>
      <li>{t.eachReport}</li>
      <li>{t.stopAnyTime}</li>
    </ul>
  );
}
