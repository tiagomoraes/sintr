interface Locale {
  language: string;
  timezone: string;
}

/** "Tuesday, 14 October at 19:40", in the person's language and time zone. */
export function formatMoment(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale.language, {
    timeZone: locale.timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatDay(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale.language, {
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
