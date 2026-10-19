/**
 * The room's time of day is the person's own: the window light takes the
 * colours of the hour where they are (sintr.css, `[data-time]`), and the
 * home greets them for the part of the day it is.
 */

export type TimeOfDay =
  "dawn" | "early" | "morning" | "noon" | "late" | "golden" | "dusk" | "evening" | "night";

/** The hour (0 to 23) at `now` in `timeZone`; UTC when the zone cannot be read. */
export function hourIn(timeZone: string, now: Date = new Date()): number {
  const read = (zone: string) =>
    Number(
      new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "numeric", hourCycle: "h23" }).format(now),
    );
  try {
    return read(timeZone);
  } catch {
    return read("UTC");
  }
}

/** The light for an hour, as the site names its palettes. */
export function timeOfDay(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 6) return "dawn";
  if (hour >= 6 && hour < 8) return "early";
  if (hour >= 8 && hour < 11) return "morning";
  if (hour >= 11 && hour < 14) return "noon";
  if (hour >= 14 && hour < 16) return "late";
  if (hour >= 16 && hour < 18) return "golden";
  if (hour >= 18 && hour < 20) return "dusk";
  if (hour >= 20 && hour < 22) return "evening";
  return "night";
}

/** The part of the day a greeting names. */
export function partOfDay(hour: number): "morning" | "afternoon" | "evening" {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "evening";
}
