interface Locale {
  language: string;
  timezone: string;
}

/**
 * The app's copy is English (docs/DECISIONS.md), and dates are part of it,
 * so they read in English whatever language the person keeps their diary
 * and their report in; the time zone is always the person's.
 */
const COPY_LOCALE = "en-GB";

/** "Tuesday 14 October at 19:40", in the person's time zone. */
export function formatMoment(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(COPY_LOCALE, {
    timeZone: locale.timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatDay(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(COPY_LOCALE, {
    timeZone: locale.timezone,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function weekday(day: number): string {
  return WEEKDAYS[day] ?? "";
}
