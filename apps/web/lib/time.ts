/**
 * `datetime-local` inputs hold a wall-clock time without a zone. These read
 * and write them in the person's own time zone, not the server's.
 */

function partsIn(date: Date, timeZone: string): Record<string, number> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const out: Record<string, number> = {};
  for (const part of parts) if (part.type !== "literal") out[part.type] = Number(part.value);
  return out;
}

/** The zone's offset from UTC at `date`, in milliseconds. */
function offsetAt(date: Date, timeZone: string): number {
  const p = partsIn(date, timeZone);
  const asUtc = Date.UTC(
    p.year ?? 0,
    (p.month ?? 1) - 1,
    p.day ?? 1,
    p.hour ?? 0,
    p.minute ?? 0,
    p.second ?? 0,
  );
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** "2026-10-18T14:02" in `timeZone` as an instant, or null if it is not one. */
export function fromLocalInput(value: string, timeZone: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number) as [number, number, number, number, number, number];
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  // Two passes settle the offset across a daylight-saving change.
  let guess = wall - offsetAt(new Date(wall), timeZone);
  guess = wall - offsetAt(new Date(guess), timeZone);
  const result = new Date(guess);
  return Number.isNaN(result.getTime()) ? null : result;
}

/** An instant as the `datetime-local` value of that moment in `timeZone`. */
export function toLocalInput(date: Date, timeZone: string): string {
  const p = partsIn(date, timeZone);
  const two = (n: number | undefined) => String(n ?? 0).padStart(2, "0");
  return `${p.year}-${two(p.month)}-${two(p.day)}T${two(p.hour)}:${two(p.minute)}`;
}
