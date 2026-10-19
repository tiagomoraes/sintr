"use client";

import Link from "next/link";
import { useLanguage, useMessages } from "@/components/language";
import { OWN_KEY_HREF, atTheLimit, formatNext, nearTheLimit, type MeterView } from "@/lib/plan";

const LINK = "text-ink underline decoration-rule-strong underline-offset-[0.28em] hover:decoration-ink";

/**
 * Above the composer once the month's messages are used: what happened,
 * what still works, and how to continue. Writing here still works; it is
 * the assistant's reply that waits.
 */
export function LimitNotice({ meter }: { meter: MeterView }) {
  const t = useMessages();
  const { code } = useLanguage();
  const N = t.plan.notes;
  return (
    <div className="my-2 rounded-file border border-rule bg-wash px-5 py-4" role="status">
      <p className="text-[0.9375rem] text-ink">{N.used}</p>
      <p className="mt-1.5 text-[0.9375rem] text-ink-2">{N.stillWrite(formatNext(meter.next, code))}</p>
      <p className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[0.9375rem]">
        <Link href="/plan" className={LINK}>
          {N.seePlan}
        </Link>
        <Link href={OWN_KEY_HREF} className={LINK}>
          {t.plan.ownKey}
        </Link>
      </p>
    </div>
  );
}

/**
 * One quiet line under the composer on the house assistant: that it is
 * included, or, near the month's end of it, how many messages are left, or,
 * at the limit, when it answers again (the notice above says the rest).
 */
export function PlanLine({ meter }: { meter: MeterView }) {
  const N = useMessages().plan.notes;
  const { code } = useLanguage();
  if (atTheLimit(meter)) {
    return (
      <p className="mt-2 text-caption text-ink-3">
        {N.answersAgain(formatNext(meter.next, code))}{" "}
        <Link href="/plan" className={LINK}>
          {N.yourPlan}
        </Link>
      </p>
    );
  }
  if (nearTheLimit(meter) && meter.limit !== null) {
    return (
      <p className="mt-2 text-caption text-ink-3">
        {N.left(meter.limit - meter.used, formatNext(meter.next, code))}{" "}
        <Link href="/plan" className={LINK}>
          {N.yourPlan}
        </Link>
      </p>
    );
  }
  return (
    <p className="mt-2 text-caption text-ink-3">
      {N.included}{" "}
      <Link href="/plan" className={LINK}>
        {N.includedLink}
      </Link>
      {N.includedAfter}
    </p>
  );
}
