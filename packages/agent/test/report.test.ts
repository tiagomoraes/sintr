import { randomUUID } from "node:crypto";
import {
  buildCorpus,
  buildDigest,
  checkReport,
  entryTexts,
  zonedTime,
  type Checkin,
  type Entry,
  type ReportLanguage,
  type ReportLedger,
} from "@sintr/core";
import { APICallError } from "ai";
import { describe, expect, it } from "vitest";
import { REPORT_ATTEMPTS, writeReport, type WriteReport } from "../src/report/driver";
import { rehearsalModel, scriptedModel, type ScriptedReply } from "../src/testing";
import { capturedLogger, instructionsOf, toolNamesOf, toolResultsOf } from "./support";

const TZ = "America/Sao_Paulo";
const at = (day: number, hour: number) => zonedTime({ year: 2026, month: 10, day, hour }, TZ);
const PERIOD = {
  kind: "session" as const,
  label: "2026-10-19",
  start: at(12, 17),
  end: at(19, 17),
  session: at(19, 18),
};
const STAMP = new Date("2026-10-19T00:00:00Z");

function entry(day: number, fields: Partial<Entry>): Entry {
  return {
    id: randomUUID(),
    occurredAt: at(day, 15),
    title: null,
    situation: null,
    thoughts: null,
    emotions: null,
    body: null,
    behavior: null,
    context: null,
    tags: null,
    notes: null,
    hotThought: null,
    evidenceFor: null,
    evidenceAgainst: null,
    alternative: null,
    alternativeBelief: null,
    emotionsAfter: null,
    peakIntensity: Math.max(0, ...(fields.emotions ?? []).map((e) => e.intensity ?? 0)),
    createdAt: STAMP,
    updatedAt: STAMP,
    ...fields,
  };
}

const MEETING = entry(13, {
  title: "Reunião com quatro pedidos novos",
  situation: "na reunião chegaram quatro pedidos novos para a mesma semana",
  thoughts: ["não tem como dar conta de tudo"],
  emotions: [{ name: "ansiedade", intensity: 80 }],
  behavior: "disse sim aos quatro",
});
const WALK = entry(16, {
  title: "Volta no parque",
  situation: "saí para andar no parque no almoço",
  thoughts: ["faz tempo que eu não paro assim"],
  emotions: [{ name: "alívio", intensity: 65 }],
});
const CHECKINS: Checkin[] = [13, 15, 16].map((day, i) => ({
  id: randomUUID(),
  occurredAt: at(day, 9),
  mood: [2, 2, 4][i]!,
  energy: null,
  anxiety: [4, 4, 2][i]!,
  sleepHours: [6, 5.5, 7][i]!,
  sleepQuality: null,
  note: i === 0 ? "acordei moído" : null,
  createdAt: STAMP,
  updatedAt: STAMP,
}));

const digest = buildDigest({ period: PERIOD, timeZone: TZ, entries: [MEETING, WALK], checkins: CHECKINS });
const ledger: ReportLedger = {
  corpus: buildCorpus([
    ...[MEETING, WALK].flatMap((e) => entryTexts(e)),
    "acordei moído",
    "A conversa de quinta.",
  ]),
  entries: new Map(
    [MEETING, WALK].map((e) => [
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
  notes: new Map(CHECKINS.map((c) => [c.id, c.note])),
};

const goodDraft = {
  week: 'Uma semana puxada no trabalho. Na terça, a reunião com quatro pedidos; na sexta, a volta no parque, "faz tempo que eu não paro assim".',
  topics: [
    { text: "A conversa de quinta.", suggested: false },
    { text: "O que repetiu nas duas semanas.", suggested: true },
  ],
  mood: "O humor ficou em 2 na terça e na quinta e subiu para 4 na sexta.",
  momentsIntro: "Os dois momentos registrados.",
  moments: [
    { entryId: MEETING.id, title: "A reunião de terça" },
    { entryId: WALK.id, title: "A volta no parque", happened: "Andou no parque no almoço." },
  ],
  patterns: [],
  helped: ["A volta no parque na sexta (16/10): alívio 65."],
};

const write = (reply: ScriptedReply): ScriptedReply => reply;
const report = (draft: unknown): ScriptedReply => ({
  toolCalls: [{ toolName: "write_report", input: draft }],
});

function run(
  replies: ScriptedReply[] | Parameters<typeof scriptedModel>[0],
  language: ReportLanguage = "pt",
) {
  const model = scriptedModel(replies);
  const logger = capturedLogger();
  const input: WriteReport = {
    model,
    digest,
    language,
    toBring: ["A conversa de quinta."],
    tasks: [],
    ledger,
    log: logger.log,
  };
  return { model, logger, result: writeReport(input) };
}

describe("the report writer", () => {
  it("writes the six sections with the person's model, copying each moment's words from its entry", async () => {
    const { model, result } = run([report(goodDraft)]);
    const written = await result;
    expect(written.ok).toBe(true);
    if (!written.ok) return;
    expect(written.problems).toEqual([]);
    expect(written.attempts).toBe(1);
    expect(written.content).toMatchObject({
      v: 1,
      language: "pt",
      author: "assistant",
      week: goodDraft.week,
      topics: goodDraft.topics,
      mood: goodDraft.mood,
      momentsIntro: "Os dois momentos registrados.",
      helped: goodDraft.helped,
      notes: [{ day: "2026-10-13", note: "acordei moído" }],
    });
    // Thoughts, emotions and intensities are the entry's, never the model's.
    expect(written.content.moments.map((m) => [m.title, m.thoughts, m.felt, m.did])).toEqual([
      [
        "A reunião de terça",
        ["não tem como dar conta de tudo"],
        [{ name: "ansiedade", intensity: 80 }],
        "disse sim aos quatro",
      ],
      ["A volta no parque", ["faz tempo que eu não paro assim"], [{ name: "alívio", intensity: 65 }], null],
    ]);
    expect(written.content.moments[1]!.happened).toBe("Andou no parque no almoço.");

    const call = model.calls[0]!;
    expect(toolNamesOf(call)).toEqual(["write_report"]);
    expect(call.toolChoice).toEqual({ type: "required" });
    const user = call.prompt.find((m) => m.role === "user");
    expect(JSON.stringify(user)).toContain(MEETING.id);
  });

  it("is told the pack's rules: the person's language, their words verbatim, never a diagnosis", async () => {
    const { model, result } = run([report(goodDraft)]);
    await result;
    const instructions = instructionsOf(model.calls[0]!);
    expect(instructions).toContain("Write in Brazilian Portuguese");
    expect(instructions).toContain("you never diagnose");
    expect(instructions).toContain("Double quotes are only for the person's exact words");
    expect(instructions).toContain('"Como foi a semana"');
    const english = run([report(goodDraft)], "en");
    await english.result;
    expect(instructionsOf(english.model.calls[0]!)).toContain("Write in English");
    expect(instructionsOf(english.model.calls[0]!)).toContain('"How the week went"');
    const spanish = run([report(goodDraft)], "es");
    await spanish.result;
    expect(instructionsOf(spanish.model.calls[0]!)).toContain("Write in Spanish");
  });

  it("sends a quote that is not in the diary back to the model, and keeps the fixed draft", async () => {
    const misquoted = { ...goodDraft, week: 'Na terça, "não vou dar conta de nada".' };
    const { model, result } = run([report(misquoted), report(goodDraft)]);
    const written = await result;
    expect(written.ok && written.problems).toEqual([]);
    expect(written.ok && written.attempts).toBe(2);
    expect(written.ok && written.content.week).toBe(goodDraft.week);
    const feedback = JSON.stringify(toolResultsOf(model.calls[1]!));
    expect(feedback).toContain("not in the diary word for word");
    expect(feedback).toContain("não vou dar conta de nada");
  });

  it("marks the draft when the quote is still wrong after the last attempt", async () => {
    const misquoted = { ...goodDraft, week: 'Na terça, "não vou dar conta de nada".' };
    const { model, result } = run([report(misquoted)]);
    const written = await result;
    expect(model.calls).toHaveLength(REPORT_ATTEMPTS);
    expect(written.ok).toBe(true);
    if (!written.ok) return;
    expect(written.problems).toEqual([
      { code: "quote_not_found", section: "week", detail: "não vou dar conta de nada" },
    ]);
    // Kept for the person to see, and never highlighted as their words.
    expect(checkReport(written.content, ledger).verified.has("não vou dar conta de nada")).toBe(false);
  });

  it("refuses a diagnosis, a cause and an entry that is not in the period", async () => {
    const wrong = {
      ...goodDraft,
      mood: "A ansiedade subiu porque dormiu pouco, sinais de burnout.",
      moments: [...goodDraft.moments, { entryId: "not-an-entry", title: "Inventado" }],
    };
    const { model, result } = run([report(wrong), report(goodDraft)]);
    const written = await result;
    expect(written.ok && written.problems).toEqual([]);
    const feedback = JSON.stringify(toolResultsOf(model.calls[1]!));
    expect(feedback).toContain("states a cause");
    expect(feedback).toContain("is a clinical label");
    expect(feedback).toContain("does not name an entry of the digest");
  });

  it("takes the dashes out of its own prose, never out of the person's words", async () => {
    const dashed = {
      ...goodDraft,
      week: "Uma semana puxada \u2014 sobretudo na terça.",
      helped: ["A volta no parque \u2013 sexta."],
    };
    const { result } = run([report(dashed)]);
    const written = await result;
    expect(written.ok && written.content.week).toBe("Uma semana puxada, sobretudo na terça.");
    expect(written.ok && written.content.helped).toEqual(["A volta no parque - sexta."]);
  });

  it("reports a provider failure as a code, and an answer without a report as no report", async () => {
    const failing = run([
      write({
        error: new APICallError({
          message: "invalid key sk-123",
          url: "https://x",
          requestBodyValues: {},
          statusCode: 401,
        }),
      }),
    ]);
    expect(await failing.result).toEqual({ ok: false, problem: "key_refused" });
    expect(failing.logger.lines.join("\n")).not.toContain("sk-123");

    const chatty = run([{ text: "Here is your report: it was a hard week." }]);
    expect(await chatty.result).toEqual({ ok: false, problem: "no_report" });
  });

  it("logs codes and counts, never the person's words", async () => {
    const { logger, result } = run([report(goodDraft)]);
    await result;
    const logged = logger.lines.join("\n");
    expect(logged).toContain("report.written");
    for (const words of [
      "não tem como dar conta de tudo",
      "faz tempo que eu não paro assim",
      "acordei moído",
      "reunião",
    ]) {
      expect(logged).not.toContain(words);
    }
  });

  it("has an offline rehearsal that writes a report the check accepts (the end-to-end path)", async () => {
    const model = rehearsalModel();
    const { log } = capturedLogger();
    const written = await writeReport({
      model,
      digest,
      language: "en",
      toBring: ["A conversa de quinta."],
      tasks: [],
      ledger,
      log,
    });
    expect(written.ok).toBe(true);
    if (!written.ok) return;
    expect(written.problems).toEqual([]);
    expect(written.content.week).toContain('"não tem como dar conta de tudo"');
    expect(written.content.topics[0]).toEqual({ text: "A conversa de quinta.", suggested: false });
    expect(written.content.moments.map((m) => m.entryId)).toEqual([MEETING.id, WALK.id]);
  });
});
