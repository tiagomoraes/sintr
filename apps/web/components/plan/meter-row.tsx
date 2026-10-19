/**
 * One measure of a month: its name, how much of it is used in words, and a
 * thin track that fills as it is used. Graphite on a hairline, the same
 * ramp, whatever the amount: the words carry the state, never an alarm
 * colour, and nothing here is a score.
 */
export function MeterRow({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const share = limit === null || limit === 0 ? null : Math.min(1, used / limit);
  return (
    <div className="border-b border-rule py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <dt className="text-[0.9688rem] text-ink-2">{label}</dt>
        <dd className="m-0 font-serif text-[1.1875rem] leading-snug text-ink">
          {limit === null ? `${used} so far` : `${used} of ${limit}`}
        </dd>
      </div>
      {share !== null ? (
        <div aria-hidden="true" className="mt-3 h-1 overflow-hidden rounded-pill bg-rule">
          <div
            className="h-full rounded-pill bg-ink-2"
            style={{ width: `${share > 0 ? Math.max(2, Math.round(share * 100)) : 0}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
