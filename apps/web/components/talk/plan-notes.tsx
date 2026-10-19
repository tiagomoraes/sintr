import Link from "next/link";
import { atTheLimit, counted, formatNext, nearTheLimit, type MeterView } from "@/lib/plan";

const LINK = "text-ink underline decoration-rule-strong underline-offset-[0.28em] hover:decoration-ink";

/** Where the door to a key of one's own is, in Settings. */
export const OWN_KEY_HREF = "/settings?key=own#own-key";

/**
 * Above the composer once the month's messages are used: what happened,
 * what still works, and how to continue. Writing here still works; it is
 * the assistant's reply that waits.
 */
export function LimitNotice({ meter }: { meter: MeterView }) {
  return (
    <div className="mb-4 rounded-file border border-rule bg-wash px-5 py-4" role="status">
      <p className="text-[0.9375rem] text-ink">This month&apos;s messages with the assistant are used.</p>
      <p className="mt-1.5 text-[0.9375rem] text-ink-2">
        You can still write here: what you send is kept as a draft entry, in your own words, for you to
        confirm. Check-ins and your report keep working. The assistant answers again on{" "}
        {formatNext(meter.next)}.
      </p>
      <p className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[0.9375rem]">
        <Link href="/plan" className={LINK}>
          See your plan
        </Link>
        <Link href={OWN_KEY_HREF} className={LINK}>
          Use your own key
        </Link>
      </p>
    </div>
  );
}

/**
 * One quiet line under the composer on the house assistant: that it is
 * included, or, near the month's end of it, how many messages are left.
 */
export function PlanLine({ meter }: { meter: MeterView }) {
  if (atTheLimit(meter)) return null;
  if (nearTheLimit(meter) && meter.limit !== null) {
    return (
      <p className="mt-2 text-caption text-ink-3">
        {counted(meter.limit - meter.used, "message", "messages")} with the assistant left this month, until{" "}
        {formatNext(meter.next)}.{" "}
        <Link href="/plan" className={LINK}>
          Your plan
        </Link>
      </p>
    );
  }
  return (
    <p className="mt-2 text-caption text-ink-3">
      The assistant is included in your{" "}
      <Link href="/plan" className={LINK}>
        plan
      </Link>
      .
    </p>
  );
}
