import { PERSON_PLANS } from "@sintr/core";
import { describe, expect, it } from "vitest";
import {
  allowanceLine,
  atTheLimit,
  formatNext,
  limitReplyText,
  nearTheLimit,
  priceLine,
  sourceLine,
} from "@/lib/plan";

describe("plans in plain words", () => {
  it("says what a plan gives each month as a sentence, never a table", () => {
    expect(allowanceLine(PERSON_PLANS.free.allowance)).toBe(
      "100 messages with the assistant and 4 reports written by it, each month.",
    );
    expect(allowanceLine(PERSON_PLANS.personal.allowance)).toBe(
      "600 messages with the assistant and 12 reports written by it, each month.",
    );
    expect(allowanceLine(PERSON_PLANS.unlimited.allowance)).toBe("The assistant, with no monthly limit.");
    expect(allowanceLine({ assistantMessages: 1, reports: 1, audioMinutes: 0 })).toBe(
      "1 message with the assistant and 1 report written by it, each month.",
    );
  });

  it("names the day the count starts again, and where a plan came from", () => {
    expect(formatNext("2026-11-01")).toBe("1\u00a0November");
    expect(formatNext("2027-01-01")).toBe("1\u00a0January");
    expect(sourceLine("grant")).toContain("whoever runs this sintr");
    expect(sourceLine("practice")).toContain("practice");
    expect(sourceLine("installation")).toBeNull();
  });

  it("says a price as Stripe sets it", () => {
    expect(priceLine({ amount: 1990, currency: "brl", interval: "month", intervalCount: 1 })).toBe(
      "R$19.90 a month",
    );
    expect(priceLine({ amount: 500, currency: "jpy", interval: "month", intervalCount: 3 })).toBe(
      "JP¥500 every 3 months",
    );
  });
});

describe("the quiet word before the limit", () => {
  it("comes in the last tenth of the month, or the last five messages, and never without a limit", () => {
    expect(nearTheLimit({ used: 89, limit: 100 })).toBe(false);
    expect(nearTheLimit({ used: 90, limit: 100 })).toBe(true);
    expect(nearTheLimit({ used: 99, limit: 100 })).toBe(true);
    expect(nearTheLimit({ used: 100, limit: 100 })).toBe(false);
    expect(atTheLimit({ used: 100, limit: 100 })).toBe(true);
    expect(nearTheLimit({ used: 539, limit: 600 })).toBe(false);
    expect(nearTheLimit({ used: 540, limit: 600 })).toBe(true);
    expect(nearTheLimit({ used: 16, limit: 20 })).toBe(true);
    expect(nearTheLimit({ used: 5000, limit: null })).toBe(false);
    expect(atTheLimit({ used: 5000, limit: null })).toBe(false);
  });

  it("says plainly what happened at the limit, and that nothing was lost", () => {
    const base = { used: 100, limit: 100, next: "2026-11-01" };
    const kept = limitReplyText({
      ...base,
      kept: { proposalId: "p", draft: { situation: "words" } },
      saved: null,
    });
    expect(kept).toContain("Your words are kept");
    expect(kept).toContain("Confirm it to save it");
    expect(limitReplyText({ ...base, kept: null, saved: "checkin" })).toContain(
      "your check-in is in your diary",
    );
    expect(limitReplyText({ ...base, kept: null, saved: null })).toContain("Your message is kept");
  });
});
