/**
 * Dates and numbers as a report prints them, in its language and in the
 * person's time zone. Plain hyphens and words only: no dashes in copy.
 */
import type { ReportLanguage } from "./content";
import { REPORT_STRINGS } from "./strings";
import { localParts, weekdayOf } from "./time";

export function formatNumber(value: number, language: ReportLanguage, digits = 1): string {
  const text = value.toFixed(digits);
  return language === "en" ? text : text.replace(".", ",");
}

/** A check-in score: integers stay integers (4), others keep one digit (3,5). */
export function formatScore(value: number, language: ReportLanguage): string {
  return Number.isInteger(value) ? String(value) : formatNumber(value, language);
}

/** Hours of sleep to the nearest five minutes: 7h, 6h30. */
export function formatHours(hours: number): string {
  const minutes = Math.round((hours * 60) / 5) * 5;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

function dayParts(day: string): { year: number; month: number; date: number } {
  const [year, month, date] = day.split("-").map(Number) as [number, number, number];
  return { year, month, date };
}

/** 19/10 (pt, es) or 10/19 (en). */
export function formatDayMonth(day: string, language: ReportLanguage): string {
  const { month, date } = dayParts(day);
  return language === "en" ? `${month}/${date}` : `${date}/${month}`;
}

/** "October 13 to 19", "13 a 19 de outubro", "del 13 al 19 de octubre". */
export function formatRange(first: string, last: string, language: ReportLanguage): string {
  const months = REPORT_STRINGS[language].months;
  const a = dayParts(first);
  const b = dayParts(last);
  const ma = months[a.month - 1]!;
  const mb = months[b.month - 1]!;
  if (language === "pt") {
    if (a.year !== b.year) return `${a.date} de ${ma} de ${a.year} a ${b.date} de ${mb} de ${b.year}`;
    if (a.month !== b.month) return `${a.date} de ${ma} a ${b.date} de ${mb}`;
    return `${a.date} a ${b.date} de ${mb}`;
  }
  if (language === "es") {
    if (a.year !== b.year) return `del ${a.date} de ${ma} de ${a.year} al ${b.date} de ${mb} de ${b.year}`;
    if (a.month !== b.month) return `del ${a.date} de ${ma} al ${b.date} de ${mb}`;
    return `del ${a.date} al ${b.date} de ${mb}`;
  }
  if (a.year !== b.year) return `${ma} ${a.date}, ${a.year} to ${mb} ${b.date}, ${b.year}`;
  if (a.month !== b.month) return `${ma} ${a.date} to ${mb} ${b.date}`;
  return `${ma} ${a.date} to ${b.date}`;
}

function clock(hour: number, minute: number, language: ReportLanguage): string {
  if (language === "en") return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return minute ? `${hour}h${String(minute).padStart(2, "0")}` : `${hour}h`;
}

/** "Tuesday, October 13 · 21:30" / "terça, 13 de outubro · 21h30". */
export function formatMomentTime(date: Date, timeZone: string, language: ReportLanguage): string {
  const s = REPORT_STRINGS[language];
  const p = localParts(date, timeZone);
  const weekday = s.weekdays[p.weekday]!;
  const month = s.months[p.month - 1]!;
  const time = clock(p.hour, p.minute, language);
  return language === "en"
    ? `${weekday}, ${month} ${p.day} · ${time}`
    : `${weekday}, ${p.day} de ${month} · ${time}`;
}

/** "Monday, 10/19, 18:00" / "segunda, 19/10, 18h". */
export function formatSession(date: Date, timeZone: string, language: ReportLanguage): string {
  const s = REPORT_STRINGS[language];
  const p = localParts(date, timeZone);
  const day = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
  return `${s.weekdays[p.weekday]}, ${formatDayMonth(day, language)}, ${clock(p.hour, p.minute, language)}`;
}

/** "Mon, Wed" for a list of days. */
export function formatWeekdays(days: readonly string[], language: ReportLanguage): string {
  return days.map((day) => REPORT_STRINGS[language].weekdaysShort[weekdayOf(day)]).join(", ");
}

/** "ter 13/10": a day as the notes column shows it. */
export function formatShortDay(day: string, language: ReportLanguage): string {
  return `${REPORT_STRINGS[language].weekdaysShort[weekdayOf(day)]} ${formatDayMonth(day, language)}`;
}
