import { LANGUAGES } from "@/messages";

interface Locale {
  /** The page's language: a catalog's code (pt-BR) or how dates are written (en-GB). */
  language: string;
  timezone: string;
}

/**
 * Dates are part of the app's copy, so they read in the page's language
 * (its `intl` in languages.json, so English stays "Tuesday 14 October at
 * 19:40"); the time zone is always the person's.
 */
export function intlOf(language: string): string {
  return LANGUAGES.find((known) => known.code === language)?.intl ?? language;
}

/** "Tuesday 14 October at 19:40", "terça-feira, 14 de outubro às 19:40", in the person's time zone. */
export function formatMoment(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(intlOf(locale.language), {
    timeZone: locale.timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatDay(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(intlOf(locale.language), {
    timeZone: locale.timezone,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** A day of the week by its number (0 is Sunday), in the page's language: "Tuesday", "terça-feira". */
export function weekday(day: number, language: string): string {
  // 7 January 2024 was a Sunday.
  return new Intl.DateTimeFormat(intlOf(language), { weekday: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(2024, 0, 7 + day, 12)),
  );
}

/** "the time zone and the assistant", "no fuso horário e no assistente": a list as the page's language joins it. */
export function formatList(items: readonly string[], language: string): string {
  return new Intl.ListFormat(intlOf(language), { type: "conjunction" }).format(items);
}

/** A language's name as the page's language says it in a sentence: "Portuguese", "português". */
export function languageName(code: string, language: string): string {
  const base = code.split(/[-_]/u)[0] ?? code;
  return new Intl.DisplayNames([intlOf(language)], { type: "language" }).of(base) ?? code;
}

/** A local day (`YYYY-MM-DD`, already the person's) as the page says it: "Tuesday 21 October", "terça-feira, 21 de outubro". */
export function formatDate(day: string, language: string): string {
  const [year, month, date] = day.split("-").map(Number) as [number, number, number];
  return new Intl.DateTimeFormat(intlOf(language), {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(Date.UTC(year, month - 1, date, 12)));
}

/** A month (`YYYY-MM`) as a calendar's title: "October 2026", "outubro de 2026". */
export function formatMonth(month: string, language: string): string {
  const [year, number] = month.split("-").map(Number) as [number, number];
  return new Intl.DateTimeFormat(intlOf(language), {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, number - 1, 15, 12)));
}
