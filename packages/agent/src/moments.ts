/**
 * A moment the model wrote ("occurredAt"). With an offset it is an instant;
 * without one it is a wall-clock time where the person is, never the
 * server's. A bare date is refused: the person gave a day, not a time, and
 * the time would be invented.
 */

const WITH_TIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/u;

function offsetAt(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** The instant as ISO 8601 (UTC), or null when the value is not a date with a time. */
export function momentIn(value: string, timeZone: string): string | null {
  const match = WITH_TIME.exec(value.trim());
  if (!match) return null;
  if (match[7]) {
    const instant = Date.parse(value.trim().replace(" ", "T"));
    return Number.isNaN(instant) ? null : new Date(instant).toISOString();
  }
  const [y, mo, d, h, mi, sec] = match.slice(1, 7).map((part) => Number(part ?? 0)) as number[];
  const wall = Date.UTC(y!, mo! - 1, d!, h!, mi!, sec!);
  // Two passes settle the offset across a daylight-saving change.
  let guess = wall - offsetAt(wall, timeZone);
  guess = wall - offsetAt(guess, timeZone);
  return Number.isNaN(guess) ? null : new Date(guess).toISOString();
}
