import { cn } from "@sintr/ui";
import { EACH_REPORT, NEVER_SHARED, SCOPE_SENTENCE, STOP_ANY_TIME } from "@/lib/sharing";

/**
 * What accepting a practice's invite means, in three lines: the consent
 * that follows says "as described above", so the invite's own page and
 * the welcome show exactly this.
 */
export function InvitePromises({ className }: { className?: string }) {
  return (
    <ul className={cn("list-none space-y-3 border-t border-ink p-0 pt-5 text-ink-2", className)}>
      <li>
        <span className="font-medium text-ink">{SCOPE_SENTENCE}</span> {NEVER_SHARED}
      </li>
      <li>{EACH_REPORT}</li>
      <li>{STOP_ANY_TIME}</li>
    </ul>
  );
}
