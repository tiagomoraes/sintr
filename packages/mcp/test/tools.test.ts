import { API_TOKEN_ACCESS, upcomingSession, type ApiTokenScope } from "@sintr/core";
import { beforeAll, describe, expect, it } from "vitest";
import { LIMITS, Refusal, TOOLS, answerTool, callTool, findTool, permits, type SintrTool } from "../src";
import { contextFor, logged, person, type Person } from "./support";

/**
 * Each tool on its own, through `callTool` (what the server runs for every
 * call): the scope it needs, how it validates, whose data it can reach, and
 * how much it returns at most.
 */

const DAY = 24 * 60 * 60 * 1000;

function tool(name: string): SintrTool {
  const found = findTool(name);
  if (!found) throw new Error(`no tool ${name}`);
  return found;
}

async function refusal(promise: Promise<unknown>): Promise<string[]> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof Refusal) return error.problems;
    throw error;
  }
  throw new Error("expected a refusal");
}

interface SavedEntry {
  saved: boolean;
  crisis?: boolean;
  message?: string;
  entry: {
    id: string;
    thoughts?: string[];
    emotions?: { name: string; intensity: number | null }[];
    link: string;
  };
}

const WORDS = [
  "Hoje na reunião o chefe falou que o projeto atrasou e eu travei.",
  "Pensei “eu nunca vou dar conta disso” e senti ansiedade, uns 80.",
];

describe("the tools", () => {
  let alice: Person;
  let bob: Person;

  beforeAll(async () => {
    alice = await person("alice");
    bob = await person("bob");
  });

  it("are the six the brief names, each with its scopes", () => {
    expect(TOOLS.map((t) => t.name)).toEqual([
      "recent_context",
      "read_entry",
      "save_entry",
      "save_checkin",
      "therapy_overview",
      "prepare_report",
    ]);
    const read = new Set<ApiTokenScope>(API_TOKEN_ACCESS.read);
    const write = new Set<ApiTokenScope>(API_TOKEN_ACCESS.write);
    const both = new Set<ApiTokenScope>(API_TOKEN_ACCESS.read_write);
    const allowed = (scopes: Set<ApiTokenScope>) =>
      TOOLS.filter((t) => permits(t.needs, scopes)).map((t) => t.name);
    expect(allowed(both)).toHaveLength(6);
    expect(allowed(read)).toEqual(["recent_context", "read_entry", "therapy_overview", "prepare_report"]);
    expect(allowed(write)).toEqual(["save_entry", "save_checkin"]);
    for (const t of TOOLS) expect(t.readOnly).toBe(!t.name.startsWith("save_"));
  });

  it("refuse a token without the scope, before touching anything", async () => {
    const before = await alice.scope.entries.count();
    const readOnly = contextFor(alice.scope, "read");
    const problems = await refusal(
      callTool(tool("save_entry"), { thoughts: ["x"], personWords: ["x"], personConfirmed: true }, readOnly),
    );
    expect(problems[0]).toMatch(/cannot use save_entry: it needs entries:write/);
    expect(await alice.scope.entries.count()).toBe(before);

    const writeOnly = contextFor(alice.scope, "write");
    for (const name of ["recent_context", "read_entry", "therapy_overview", "prepare_report"]) {
      const why = await refusal(callTool(tool(name), { id: "x" }, writeOnly));
      expect(why[0]).toMatch(new RegExp(`cannot use ${name}`));
    }
    // recent_context reads what it may: entries only, with entries:read alone.
    const entriesOnly = contextFor(alice.scope, ["entries:read"]);
    const result = (await callTool(tool("recent_context"), {}, entriesOnly)) as Record<string, unknown>;
    expect(result.entries).toBeDefined();
    expect(result.checkins).toBeUndefined();
  });

  it("save an entry in the person's own words, and keep their exact span", async () => {
    const context = contextFor(alice.scope);
    const saved = (await callTool(
      tool("save_entry"),
      {
        title: "A reunião",
        situation: "Na reunião o chefe disse que o projeto atrasou.",
        thoughts: ["Eu nunca vou dar conta disso"],
        emotions: [{ name: "Ansiedade", intensity: 80 }],
        personWords: WORDS,
        personConfirmed: true,
      },
      context,
    )) as SavedEntry;
    expect(saved.saved).toBe(true);
    // The model's capitalised copy is replaced by what the person typed.
    expect(saved.entry.thoughts).toEqual(["eu nunca vou dar conta disso"]);
    expect(saved.entry.emotions).toEqual([{ name: "ansiedade", intensity: 80 }]);
    expect(saved.entry.link).toBe(`https://diary.example.test/entries/${saved.entry.id}`);

    const stored = await alice.scope.entries.get(saved.entry.id);
    expect(stored?.thoughts).toEqual(["eu nunca vou dar conta disso"]);
    expect(stored?.peakIntensity).toBe(80);
    const audit = await alice.scope.auditLog.list();
    expect(audit[0]).toMatchObject({
      action: "mcp.entry_saved",
      targetId: saved.entry.id,
      metadata: { token_id: context.tokenId },
    });
  });

  it("refuse a paraphrase, an invented number or an empty draft, with reasons, and save nothing", async () => {
    const context = contextFor(alice.scope);
    const before = await alice.scope.entries.count();
    const paraphrase = await refusal(
      callTool(
        tool("save_entry"),
        { thoughts: ["I will never manage this"], personWords: WORDS, personConfirmed: true },
        context,
      ),
    );
    expect(paraphrase).toEqual([
      "thoughts[0] is not in the person's words: copy it exactly as they wrote it",
    ]);
    const invented = await refusal(
      callTool(
        tool("save_entry"),
        { emotions: [{ name: "ansiedade", intensity: 90 }], personWords: WORDS, personConfirmed: true },
        context,
      ),
    );
    expect(invented).toEqual([
      "emotions[0].intensity 90 was never said by the person: leave it out and ask for it",
    ]);
    const empty = await refusal(
      callTool(tool("save_entry"), { personWords: WORDS, personConfirmed: true }, context),
    );
    expect(empty[0]).toMatch(/the draft is empty/);
    const bareDate = await refusal(
      callTool(
        tool("save_entry"),
        { notes: "travei", occurredAt: "2026-10-14", personWords: WORDS, personConfirmed: true },
        context,
      ),
    );
    expect(bareDate[0]).toMatch(/occurredAt needs a date and a time/);
    expect(await alice.scope.entries.count()).toBe(before);
  });

  it("need the person's yes and their words before saving", async () => {
    const context = contextFor(alice.scope);
    const unconfirmed = await refusal(
      callTool(tool("save_entry"), { notes: "travei", personWords: WORDS, personConfirmed: false }, context),
    );
    expect(unconfirmed[0]).toMatch(/^personConfirmed:/);
    const wordless = await refusal(
      callTool(tool("save_entry"), { notes: "travei", personConfirmed: true }, context),
    );
    expect(wordless[0]).toMatch(/^personWords:/);
    const tooMany = await refusal(
      callTool(
        tool("save_checkin"),
        {
          mood: 3,
          personWords: Array.from({ length: LIMITS.personWords + 1 }, () => "3"),
          personConfirmed: true,
        },
        context,
      ),
    );
    expect(tooMany[0]).toMatch(/^personWords:/);
  });

  it("read a time without an offset where the person is", async () => {
    const saved = (await callTool(
      tool("save_entry"),
      {
        notes: "travei na reunião",
        occurredAt: "2026-10-14T19:40",
        personWords: ["travei na reunião, terça às 19:40"],
        personConfirmed: true,
      },
      contextFor(alice.scope),
    )) as { entry: { when: { at: string; local: string } } };
    // São Paulo is UTC-3 in October.
    expect(saved.entry.when).toEqual({ at: "2026-10-14T22:40:00.000Z", local: "Wednesday 2026-10-14 19:40" });
  });

  it("save a check-in with only the numbers the person wrote", async () => {
    const context = contextFor(alice.scope);
    const words = ["humor 3, ansiedade 4, dormi 6h30, acordei cansada"];
    const invented = await refusal(
      callTool(
        tool("save_checkin"),
        { mood: 3, energy: 2, personWords: words, personConfirmed: true },
        context,
      ),
    );
    expect(invented).toEqual(["energy 2 was never said by the person: leave it out and ask for it"]);
    const saved = (await callTool(
      tool("save_checkin"),
      {
        mood: 3,
        anxiety: 4,
        sleepHours: 6.5,
        note: "acordei cansada",
        personWords: words,
        personConfirmed: true,
      },
      context,
    )) as { saved: boolean; checkin: { id: string; mood: number; sleepHours: number; energy?: number } };
    expect(saved.saved).toBe(true);
    expect(saved.checkin).toMatchObject({ mood: 3, sleepHours: 6.5 });
    expect(saved.checkin.energy).toBeUndefined();
    expect((await alice.scope.checkins.get(saved.checkin.id))?.note).toBe("acordei cansada");
    expect((await alice.scope.auditLog.list())[0]?.action).toBe("mcp.checkin_saved");
  });

  it("stop the diary on words that signal acute risk: nothing saved, the fixed message, the lines", async () => {
    const context = contextFor(alice.scope);
    const before = await alice.scope.entries.count();
    const answer = (await callTool(
      tool("save_entry"),
      {
        notes: "não aguento mais viver",
        personWords: ["não aguento mais viver, queria sumir"],
        personConfirmed: true,
      },
      context,
    )) as SavedEntry & { lines: { number: string }[]; stopTheDiary: string };
    expect(answer.saved).toBe(false);
    expect(answer.crisis).toBe(true);
    expect(answer.message).toMatch(/CVV atende no 188/);
    expect(answer.message).toMatch(/SAMU no 192/);
    expect(answer.lines.map((line) => line.number)).toEqual(["188", "192"]);
    expect(answer.stopTheDiary).toMatch(/Stop the diary now/);
    expect(await alice.scope.entries.count()).toBe(before);

    // A note the agent wrote is screened too, and English gets the English message.
    const checkin = (await callTool(
      tool("save_checkin"),
      { note: "I want to kill myself", personWords: ["mood 1"], personConfirmed: true },
      context,
    )) as SavedEntry;
    expect(checkin.crisis).toBe(true);
    expect(checkin.message).toMatch(/call CVV on 188/);
    expect(logged.some((line) => line.includes("mcp.crisis") && line.includes("screen_self_harm"))).toBe(
      true,
    );
    expect(logged.some((line) => /aguento|kill myself/.test(line))).toBe(false);
  });

  it("open only the person's own entries", async () => {
    const own = await alice.scope.entries.create({ title: "só da alice", thoughts: ["pensamento da alice"] });
    const read = (await callTool(tool("read_entry"), { id: own.id }, contextFor(alice.scope))) as {
      title: string;
      thoughts: string[];
    };
    expect(read).toMatchObject({ title: "só da alice", thoughts: ["pensamento da alice"] });

    // Bob's key cannot reach Alice's entry: it is answered as missing, like any id.
    await expect(callTool(tool("read_entry"), { id: own.id }, contextFor(bob.scope))).rejects.toThrow(
      "entry not found",
    );
    await expect(callTool(tool("read_entry"), { id: "not-an-id" }, contextFor(bob.scope))).rejects.toThrow(
      "entry not found",
    );
    const recent = (await callTool(tool("recent_context"), {}, contextFor(bob.scope))) as {
      entries: unknown[];
      checkins: unknown[];
    };
    expect(recent.entries).toEqual([]);
    expect(recent.checkins).toEqual([]);
    const prep = JSON.stringify(await callTool(tool("prepare_report"), {}, contextFor(bob.scope)));
    expect(prep).not.toContain("alice");
  });

  it("keep reads small, whatever the diary holds", async () => {
    const carol = await person("carol");
    const now = Date.now();
    for (let i = 0; i < 30; i += 1) {
      await carol.scope.entries.create({
        occurredAt: new Date(now - i * 60 * 60 * 1000),
        title: `entry ${i}`,
      });
      await carol.scope.checkins.create({ occurredAt: new Date(now - i * 60 * 60 * 1000), mood: 3 });
    }
    const recent = (await callTool(tool("recent_context"), { days: 14 }, contextFor(carol.scope))) as {
      entries: { title: string }[];
      moreEntries: boolean;
      checkins: unknown[];
      moreCheckins: boolean;
    };
    expect(recent.entries).toHaveLength(LIMITS.recentEntries);
    expect(recent.moreEntries).toBe(true);
    expect(recent.checkins).toHaveLength(LIMITS.recentCheckins);
    expect(recent.entries[0]?.title).toBe("entry 0");
    const tooFar = await refusal(callTool(tool("recent_context"), { days: 60 }, contextFor(carol.scope)));
    expect(tooFar[0]).toMatch(/^days:/);

    const prep = (await callTool(tool("prepare_report"), {}, contextFor(carol.scope))) as {
      entries: unknown[];
      moreEntries: number;
    };
    expect(prep.entries.length).toBeLessThanOrEqual(LIMITS.reportEntries);
  });

  it("give the therapy without the therapist's name or address", async () => {
    const dana = await person("dana");
    await dana.scope.therapySettings.update({
      therapistName: "Dr. Secret",
      therapistContact: "secret@example.test",
      sessionDay: 2,
      sessionTime: "18:00",
    });
    await dana.scope.therapyNotes.create({ kind: "to_bring", body: "falar da reunião de terça" });
    const task = await dana.scope.therapyNotes.create({ kind: "task", body: "anotar os pensamentos" });
    await dana.scope.therapyNotes.setDone(task.id, true);
    const overview = (await callTool(tool("therapy_overview"), {}, contextFor(dana.scope))) as {
      sessions: { weekly: string; next: { local: string } };
      hasTherapist: boolean;
      toBringUp: { body: string }[];
      tasks: unknown[];
    };
    expect(overview.sessions.weekly).toBe("Tuesday at 18:00");
    expect(overview.sessions.next.local).toMatch(/^Tuesday .* 18:00$/);
    expect(overview.hasTherapist).toBe(true);
    expect(overview.toBringUp.map((n) => n.body)).toEqual(["falar da reunião de terça"]);
    expect(overview.tasks).toEqual([]);
    expect(JSON.stringify(overview)).not.toMatch(/Secret|secret@/);
  });

  it("prepare for the session from the diary, and change and send nothing", async () => {
    const erin = await person("erin");
    await erin.scope.therapySettings.update({
      sessionDay: (new Date().getUTCDay() + 2) % 7,
      sessionTime: "18:00",
    });
    await erin.scope.entries.create({
      occurredAt: new Date(Date.now() - DAY),
      title: "o almoço",
      thoughts: ["ninguém me escuta"],
      emotions: [{ name: "tristeza", intensity: 60 }],
    });
    await erin.scope.checkins.create({ occurredAt: new Date(Date.now() - DAY), mood: 2, note: "dia pesado" });
    await erin.scope.therapyNotes.create({ kind: "to_bring", body: "o almoço de domingo" });

    const prep = (await callTool(tool("prepare_report"), {}, contextFor(erin.scope))) as {
      sendsNothing: string;
      period: { kind: string; session: { local: string } };
      report: { status: string };
      numbers: { mood: { average: number; days: number } };
      entries: { thoughts: string[]; link: string }[];
      checkinNotes: { note: string }[];
      toBringUp: { body: string }[];
    };
    expect(prep.sendsNothing).toMatch(/Nothing is sent from here/);
    expect(prep.period.kind).toBe("session");
    expect(prep.report.status).toBe("not prepared yet");
    expect(prep.numbers.mood).toMatchObject({ average: 2, days: 1 });
    expect(prep.entries[0]?.thoughts).toEqual(["ninguém me escuta"]);
    expect(prep.checkinNotes.map((n) => n.note)).toEqual(["dia pesado"]);
    expect(prep.toBringUp.map((n) => n.body)).toEqual(["o almoço de domingo"]);
    // Nothing was prepared, approved or sent: there is still no report at all.
    expect(await erin.scope.reports.list()).toEqual([]);

    // With a draft for that session, it is named with its status and its page.
    const session = upcomingSession(await erin.scope.therapySettings.get(), "America/Sao_Paulo", new Date());
    const draft = await erin.scope.reports.createDraft({
      periodStart: new Date(Date.now() - 5 * DAY),
      periodEnd: new Date(Date.now() - 60_000),
      sessionAt: session,
    });
    const again = (await callTool(tool("prepare_report"), {}, contextFor(erin.scope))) as {
      report: { id: string; status: string; link: string };
    };
    expect(again.report).toEqual({
      id: draft.id,
      status: "draft",
      link: `https://diary.example.test/reports/${draft.id}`,
    });
    expect((await erin.scope.reports.get(draft.id))?.status).toBe("draft");
  });

  it("answer a failure inside sintr plainly, and log a code", async () => {
    const broken = contextFor(alice.scope);
    const failing = {
      ...broken,
      scope: {
        ...broken.scope,
        profile: {
          ...broken.scope.profile,
          get: () => Promise.reject(new Error("connection reset while reading secret words")),
        },
      },
    };
    const answer = await answerTool(tool("recent_context"), {}, failing);
    expect(answer.isError).toBe(true);
    expect(JSON.stringify(answer.content)).toMatch(/could not do this just now, and nothing was changed/);
    expect(logged.some((line) => line.includes("secret words"))).toBe(false);
    expect(logged.some((line) => line.includes("mcp.tool_failed"))).toBe(true);
  });
});
