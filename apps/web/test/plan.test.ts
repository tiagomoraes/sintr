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
import { messagesFor } from "@/messages";

const en = messagesFor("en");
const pt = messagesFor("pt-BR");

describe("plans in plain words", () => {
  it("says what a plan gives each month as a sentence, never a table", () => {
    expect(allowanceLine(PERSON_PLANS.free.allowance, en)).toBe(
      "100 messages with the assistant and 4 reports written by it, each month.",
    );
    expect(allowanceLine(PERSON_PLANS.personal.allowance, en)).toBe(
      "600 messages with the assistant and 12 reports written by it, each month.",
    );
    expect(allowanceLine(PERSON_PLANS.unlimited.allowance, en)).toBe("The assistant, with no monthly limit.");
    expect(allowanceLine({ assistantMessages: 1, reports: 1, audioMinutes: 0 }, en)).toBe(
      "1 message with the assistant and 1 report written by it, each month.",
    );
    expect(allowanceLine({ assistantMessages: null, reports: 4, audioMinutes: 0 }, en)).toBe(
      "Messages with the assistant without a limit and 4 reports written by it, each month.",
    );
  });

  it("says it in the page's language", () => {
    expect(allowanceLine(PERSON_PLANS.free.allowance, pt)).toBe(
      "100 mensagens com o assistente e 4 relatórios escritos por ele, todo mês.",
    );
    expect(allowanceLine({ assistantMessages: 1, reports: 1, audioMinutes: 0 }, pt)).toBe(
      "1 mensagem com o assistente e 1 relatório escrito por ele, todo mês.",
    );
    expect(allowanceLine(PERSON_PLANS.unlimited.allowance, pt)).toBe("O assistente, sem limite mensal.");
    expect(formatNext("2026-11-01", "pt-BR")).toBe("1\u00a0de\u00a0novembro");
    expect(
      priceLine({ amount: 1990, currency: "brl", interval: "month", intervalCount: 1 }, pt, "pt-BR"),
    ).toBe("R$\u00a019,90 por mês");
    expect(
      priceLine({ amount: 4990, currency: "brl", interval: "month", intervalCount: 3 }, pt, "pt-BR"),
    ).toBe("R$\u00a049,90 a cada 3 meses");
    expect(sourceLine("grant", pt)).toContain("quem mantém este sintr");
  });

  it("names the day the count starts again, and where a plan came from", () => {
    expect(formatNext("2026-11-01", "en")).toBe("1\u00a0November");
    expect(formatNext("2027-01-01", "en-GB")).toBe("1\u00a0January");
    expect(sourceLine("grant", en)).toContain("whoever runs this sintr");
    expect(sourceLine("practice", en)).toContain("practice");
    expect(sourceLine("installation", en)).toBeNull();
  });

  it("says a price as Stripe sets it", () => {
    expect(priceLine({ amount: 1990, currency: "brl", interval: "month", intervalCount: 1 }, en, "en")).toBe(
      "R$19.90 a month",
    );
    expect(priceLine({ amount: 500, currency: "jpy", interval: "month", intervalCount: 3 }, en, "en")).toBe(
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
    const kept = limitReplyText(
      {
        ...base,
        kept: { proposalId: "p", draft: { situation: "words" } },
        saved: null,
      },
      en,
    );
    expect(kept).toContain("Your words are kept");
    expect(kept).toContain("Confirm it to save it");
    expect(limitReplyText({ ...base, kept: null, saved: "checkin" }, en)).toContain(
      "your check-in is in your diary",
    );
    expect(limitReplyText({ ...base, kept: null, saved: "entry" }, en)).toContain(
      "Saved: your entry is in your diary",
    );
    expect(limitReplyText({ ...base, kept: null, saved: null }, en)).toContain("Your message is kept");
    expect(limitReplyText({ ...base, kept: null, saved: null }, pt)).toContain(
      "Sua mensagem fica guardada nesta conversa",
    );
  });
});
