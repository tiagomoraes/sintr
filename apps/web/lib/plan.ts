import type { SintrDataParts } from "@sintr/agent/shapes";
import type { Allowance, PlanSource, PriceView } from "@sintr/core";
import { intlOf } from "@/lib/format";
import type { Messages } from "@/messages";

/**
 * Plans in the house voice: numbers as sentences, a month as a date, and a
 * quiet word before the limit. Shared by the plan screen and the
 * conversation; nothing here is a score. The words are the page's
 * (`t`), the dates and prices its language's (`language`, a catalog's
 * code or an Intl tag).
 */

/** Where the door to a key of one's own is, in Settings. */
export const OWN_KEY_HREF = "/settings?key=own#own-key";

/** A month's meter of the house assistant: used, the plan's limit (null for none), and when it starts again. */
export interface MeterView {
  used: number;
  limit: number | null;
  /** The first day of the next month, YYYY-MM-DD. */
  next: string;
}

/** "1 November", "1 de novembro": the day the count starts again, never broken across two lines. */
export function formatNext(next: string, language: string): string {
  return new Intl.DateTimeFormat(intlOf(language), { timeZone: "UTC", day: "numeric", month: "long" })
    .format(new Date(`${next}T12:00:00Z`))
    .replace(/ /gu, " ");
}

/** "1 message", "12 messages". */
export function counted(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function atTheLimit(meter: Pick<MeterView, "used" | "limit">): boolean {
  return meter.limit !== null && meter.used >= meter.limit;
}

/** A tenth of the month, or five messages, whichever is more: time to say so, once, quietly. */
export function nearTheLimit(meter: Pick<MeterView, "used" | "limit">): boolean {
  if (meter.limit === null) return false;
  const left = meter.limit - meter.used;
  return left > 0 && left <= Math.max(5, Math.ceil(meter.limit * 0.1));
}

/** What a plan gives each month, in one sentence. */
export function allowanceLine(allowance: Allowance, t: Messages): string {
  const { assistantMessages: messages, reports } = allowance;
  const words = t.plan.allowance;
  if (messages === null && reports === null) return words.unlimited;
  return words.both(words.messages(messages), words.reports(reports)).replace(/^./u, (c) => c.toUpperCase());
}

/** Where a plan came from, when it is not simply the one everyone starts on. */
export function sourceLine(source: PlanSource, t: Messages): string | null {
  switch (source) {
    case "grant":
      return t.plan.source.grant;
    case "practice":
      return t.plan.source.practice;
    default:
      return null;
  }
}

/** At most this many seats in one checkout; more is a conversation, not a form. */
export const MAX_SEATS = 500;

/** Currencies Stripe counts in whole units, without cents. */
const WHOLE_UNITS = new Set([
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "ugx",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
]);

/** "R$19.90 a month", "R$ 19,90 por mês", as the payment provider prices it. */
export function priceLine(price: PriceView, t: Messages, language: string): string {
  const amount = WHOLE_UNITS.has(price.currency) ? price.amount : price.amount / 100;
  const money = new Intl.NumberFormat(intlOf(language), {
    style: "currency",
    currency: price.currency.toUpperCase(),
  }).format(amount);
  return t.plan.price(money, price.interval, price.intervalCount);
}

/** What sintr says, in place of the assistant, when the month's messages are used. */
export function limitReplyText(data: SintrDataParts["limit"], t: Messages): string {
  if (data.saved) return t.plan.reply.saved(data.saved);
  return data.kept ? t.plan.reply.kept : t.plan.reply.waiting;
}
