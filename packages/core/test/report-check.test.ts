import { describe, expect, it } from "vitest";
import { buildCorpus, checkReport, isVerbatim, splitQuotes, type ReportLedger } from "../src/report/check";
import type { ReportContent } from "../src/report/content";
import { buildDigest } from "../src/report/digest";
import { draftContent } from "../src/report/draft";
import { entryTexts } from "../src/report/check";
import { DEMO_PERIOD, DEMO_TZ, demoRecords } from "./report-fixtures";

function setup() {
  const { entries, checkins } = demoRecords();
  const digest = buildDigest({ period: DEMO_PERIOD, timeZone: DEMO_TZ, entries, checkins });
  const ledger: ReportLedger = {
    corpus: buildCorpus([...entries.flatMap((e) => entryTexts(e)), ...checkins.map((c) => c.note)]),
    entries: new Map(
      entries.map((e) => [
        e.id,
        {
          id: e.id,
          occurredAt: e.occurredAt.toISOString(),
          thoughts: e.thoughts ?? [],
          emotions: e.emotions ?? [],
          body: e.body,
          hotThought: e.hotThought,
          evidenceFor: e.evidenceFor,
          evidenceAgainst: e.evidenceAgainst,
          alternative: e.alternative,
          alternativeBelief: e.alternativeBelief,
          emotionsAfter: e.emotionsAfter ?? [],
        },
      ]),
    ),
    notes: new Map(checkins.map((c) => [c.id, c.note])),
  };
  const content = draftContent({ digest, language: "pt", toBring: [] });
  return { digest, ledger, content };
}

const withProse = (content: ReportContent, prose: Partial<ReportContent>): ReportContent => ({
  ...content,
  ...prose,
});

describe("quotes", () => {
  it("are split out of the prose, whatever marks the writer used", () => {
    expect(splitQuotes('Na terça, “não tem como dar conta de tudo”, e "lá vem tudo de novo".')).toEqual([
      { quote: false, text: "Na terça, " },
      { quote: true, text: "não tem como dar conta de tudo" },
      { quote: false, text: ", e " },
      { quote: true, text: "lá vem tudo de novo" },
      { quote: false, text: "." },
    ]);
    expect(splitQuotes("«ella acha»").map((p) => p.quote)).toEqual([true]);
  });

  it("are found word for word, forgiving case, spacing and quote styles, at word boundaries", () => {
    const corpus = buildCorpus(["Eu  sempre deixo a desejar", "ela disse: ‘vai dar certo’"]);
    expect(isVerbatim(corpus, "eu sempre deixo a desejar")).toBe(true);
    expect(isVerbatim(corpus, "sempre deixo")).toBe(true);
    expect(isVerbatim(corpus, "Eu sempre deixo a desejar.")).toBe(true);
    expect(isVerbatim(corpus, "'vai dar certo'")).toBe(true);
    expect(isVerbatim(corpus, "eu nunca deixo a desejar")).toBe(false);
    expect(isVerbatim(corpus, "empre deix")).toBe(false);
  });
});

describe("the report check", () => {
  it("passes a draft made of the person's own records", () => {
    const { ledger, content } = setup();
    const check = checkReport(content, ledger);
    expect(check.problems).toEqual([]);
    expect(check.verified.has("eu sempre deixo a desejar")).toBe(true);
    expect(check.verified.has("acordei moído")).toBe(true);
  });

  it("reports a quote that is not in the diary word for word, and does not verify it", () => {
    const { ledger, content } = setup();
    const check = checkReport(
      withProse(content, {
        week: 'Uma semana puxada. Na terça, "não vou dar conta de nada", e na sexta "faz tempo que eu não paro assim".',
      }),
      ledger,
    );
    expect(check.problems).toEqual([
      { code: "quote_not_found", section: "week", detail: "não vou dar conta de nada" },
    ]);
    expect(check.verified.has("faz tempo que eu não paro assim")).toBe(true);
    expect(check.verified.has("não vou dar conta de nada")).toBe(false);
  });

  it("refuses diagnoses and causes in the prose, and allows the person's own quoted words", () => {
    const { ledger, content } = setup();
    const check = checkReport(
      withProse(content, {
        mood: "A ansiedade subiu porque dormiu pouco; parece burnout e catastrofização.",
        helped: ["A caminhada ajudou por causa do ar livre."],
      }),
      ledger,
    );
    expect(check.problems.map((p) => [p.code, p.section, p.detail])).toEqual([
      ["states_a_cause", "mood", "porque"],
      ["clinical_label", "mood", "burnout"],
      ["clinical_label", "mood", "catastrofização"],
      ["states_a_cause", "helped", "por causa"],
    ]);
  });

  it("finds labels and causes in English and Spanish too", () => {
    const { ledger, content } = setup();
    const codes = checkReport(
      withProse(content, {
        week: "Anxious because of work, a depressive week. Causó tristeza, quizás depresión.",
      }),
      ledger,
    ).problems.map((p) => p.detail);
    expect(codes).toEqual(["because", "causó", "depressive", "depresión"]);
  });

  it("asks for dates on every observation of what repeated", () => {
    const { ledger, content } = setup();
    const check = checkReport(
      withProse(content, {
        patterns: [
          { when: "11 e 18/10", text: 'No domingo à tarde, "lá vem tudo de novo".' },
          { when: "aos domingos", text: "Ansiedade no fim de semana." },
        ],
      }),
      ledger,
    );
    expect(check.problems).toEqual([
      { code: "undated_observation", section: "patterns", detail: "Ansiedade no fim de semana." },
    ]);
  });

  it("notices a moment whose entry changed or is gone, and a check-in note that changed", () => {
    const { ledger, content } = setup();
    const [first, second] = content.moments;
    const changed = new Map(ledger.entries);
    changed.set(first!.entryId, { ...changed.get(first!.entryId)!, thoughts: ["outro pensamento"] });
    changed.delete(second!.entryId);
    const notes = new Map(ledger.notes);
    notes.set(content.notes[0]!.checkinId, "corrigido depois");
    const check = checkReport(content, { ...ledger, entries: changed, notes });
    expect(check.problems.map((p) => p.code).sort()).toEqual([
      "moment_entry_changed",
      "moment_entry_missing",
      "note_changed",
    ]);
  });

  it("keeps the report short: topics, moments and the summary", () => {
    const { ledger, content } = setup();
    const long = withProse(content, {
      topics: Array.from({ length: 7 }, (_, i) => ({ text: `assunto ${i + 1}`, suggested: false })),
      week: Array.from({ length: 150 }, () => "palavra").join(" "),
    });
    expect(checkReport(long, ledger).problems.map((p) => p.code)).toEqual([
      "too_many_topics",
      "long_summary",
    ]);
  });
});
