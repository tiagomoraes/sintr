import type { SintrDataParts } from "@sintr/agent/shapes";
import type { Allowance, PlanSource, PriceView } from "@sintr/core";

/**
 * Plans in the house voice: numbers as sentences, a month as a date, and a
 * quiet word before the limit. Shared by the plan screen and the
 * conversation; nothing here is a score.
 */

/** A month's meter of the house assistant: used, the plan's limit (null for none), and when it starts again. */
export interface MeterView {
  used: number;
  limit: number | null;
  /** The first day of the next month, YYYY-MM-DD. */
  next: string;
}

/** "1 November": the day the count starts again, never broken across two lines. */
export function formatNext(next: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "long" })
    .format(new Date(`${next}T12:00:00Z`))
    .replace(" ", "\u00a0");
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
export function allowanceLine(allowance: Allowance): string {
  const { assistantMessages: messages, reports } = allowance;
  if (messages === null && reports === null) return "The assistant, with no monthly limit.";
  const parts = [
    messages === null
      ? "messages with the assistant without a limit"
      : counted(messages, "message", "messages") + " with the assistant",
    reports === null
      ? "reports written by it without a limit"
      : counted(reports, "report", "reports") + " written by it",
  ];
  return `${parts[0]!.replace(/^./u, (c) => c.toUpperCase())} and ${parts[1]}, each month.`;
}

/** Where a plan came from, when it is not simply the one everyone starts on. */
export function sourceLine(source: PlanSource): string | null {
  switch (source) {
    case "grant":
      return "Given to you by whoever runs this sintr.";
    case "practice":
      return "Included with your practice's plan.";
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

/** "R$19.90 a month", as the payment provider prices it. */
export function priceLine(price: PriceView): string {
  const amount = WHOLE_UNITS.has(price.currency) ? price.amount : price.amount / 100;
  const money = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: price.currency.toUpperCase(),
  }).format(amount);
  const every =
    price.intervalCount === 1 ? `a ${price.interval}` : `every ${price.intervalCount} ${price.interval}s`;
  return `${money} ${every}`;
}

/** What sintr says, in place of the assistant, when the month's messages are used. */
export function limitReplyText(data: SintrDataParts["limit"]): string {
  if (data.saved) {
    return `Saved: your ${data.saved === "entry" ? "entry" : "check-in"} is in your diary. This month's messages with the assistant are used, so I cannot say more than that.`;
  }
  if (data.kept) {
    return "This month's messages with the assistant are used, so I cannot answer this one. Your words are kept: they are in the draft below, as an entry in your own words. Confirm it to save it, or change it first.";
  }
  return "This month's messages with the assistant are used, so I cannot answer this one. Your message is kept in this conversation.";
}
