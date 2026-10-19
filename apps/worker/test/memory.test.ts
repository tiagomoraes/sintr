import { randomUUID } from "node:crypto";
import {
  HOUSE_DAILY_PAGES,
  memoryState,
  recall,
  recipientRecord,
  rememberNow,
  rehearsalEmbedding,
} from "@sintr/agent";
import { rehearsalScript, scriptedEndpoint } from "@sintr/agent/testing";
import {
  MEMORY_CONSENT_VERSION,
  createLogger,
  generateMasterKey,
  loadConfig,
  memoryTransport,
  type UserScope,
} from "@sintr/core";
import { createRuntime } from "@sintr/core/runtime";
import { afterAll, describe, expect, inject, it } from "vitest";
import { readDiaries } from "../src/memory";

/**
 * F10, below the web app: the memory's life on an installation with a
 * house assistant. The house's real adapter talks to fake endpoints on the
 * same machine (chat answered by the rehearsal script, embeddings by the
 * rehearsal embedder), so what goes on the wire, and when nothing does, is
 * what this shows; how a real model reads a diary is not.
 */

const HOUSE_KEY = `sk-house-${randomUUID().replaceAll("-", "")}`;
const config = loadConfig({
  DATABASE_URL: inject("databaseUrl"),
  SINTR_AUTH_SECRET: randomUUID() + randomUUID(),
  SINTR_MASTER_KEY: generateMasterKey(),
  SINTR_LOG_LEVEL: "error",
  SINTR_HOUSE_PROVIDER: "openai_compatible",
  SINTR_HOUSE_BASE_URL: "https://house.example.test/v1",
  SINTR_HOUSE_MODEL: "house-model",
  SINTR_HOUSE_KEY: HOUSE_KEY,
  SINTR_HOUSE_NAME: "Example AI",
  // A gateway sintr does not know places memories only with a model its operator names.
  SINTR_HOUSE_EMBED_MODEL: "embed-model",
});
const runtime = createRuntime(config, { service: "test", poolSize: 2, email: memoryTransport() });
const lines: string[] = [];
const log = createLogger({ level: "debug", write: (_level, line) => lines.push(line) });

afterAll(() => runtime.close());

/** The house on this machine: what each request carried, and the rehearsal's answers. */
function house() {
  const chat = scriptedEndpoint(rehearsalScript);
  const sent: { url: string; key: string | null; body: string }[] = [];
  const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init);
    const body = await request.clone().text();
    sent.push({ url: request.url, key: request.headers.get("authorization"), body });
    if (request.url.endsWith("/embeddings")) {
      const { model, input: texts } = JSON.parse(body) as { model: string; input: string[] };
      const embedded = rehearsalEmbedding(texts);
      if (!embedded.ok) return new Response("{}", { status: 500 });
      return Response.json({
        model,
        data: embedded.vectors.map((embedding, index) => ({ index, embedding })),
      });
    }
    return chat.fetch(request);
  }) as typeof globalThis.fetch;
  return { fetch, sent, words: () => sent.map((request) => request.body).join("\n") };
}

async function signUp(label: string): Promise<UserScope> {
  const { user } = await runtime.auth.api.signUpEmail({
    body: {
      email: `${label}-${randomUUID()}@example.test`,
      password: "a sentence long enough to pass",
      name: "",
      consent: true,
    } as never,
  });
  return runtime.repositories.forUser(user.id);
}

/** The yes Memory records: the providers it showed, in the consent. */
async function agree(scope: UserScope): Promise<void> {
  const state = await memoryState(scope, config);
  if (state.kind !== "off" && state.kind !== "paused") throw new Error(`cannot agree from ${state.kind}`);
  await scope.consents.record({
    purpose: "memory",
    version: MEMORY_CONSENT_VERSION,
    granted: true,
    recipient: recipientRecord(state.recipients),
  });
  await scope.memories.setName((await scope.profile.get()).preferredName);
}

const MEETING = "At the Monday meeting my manager asked about the deadline in front of everyone.";
const WORK = "I work as a nurse on the night shift at the hospital.";
const RISK = "I want to die, I cannot do this anymore.";

describe("the memory on an installation with a house assistant", () => {
  const now = new Date();
  let ana: UserScope;

  it("reads nothing and sends nothing before the person agrees", async () => {
    const endpoint = house();
    ana = await signUp("memory-ana");
    await ana.profile.update({ preferredName: "Ana", timezone: "America/Sao_Paulo" });
    await ana.entries.create({ situation: MEETING, thoughts: ["I am going to let everyone down"] });
    await ana.entries.create({ situation: WORK });
    await ana.entries.create({ situation: RISK });
    await ana.checkins.create({ mood: 2, note: "Slept four hours after the shift." });

    expect(await memoryState(ana, config)).toEqual({ kind: "off", recipients: ["Example AI"] });
    expect(await readDiaries(runtime, now, { fetch: endpoint.fetch })).toMatchObject({ read: 0, kept: 0 });
    expect(await recall({ scope: ana, config, log, fetch: endpoint.fetch }, { text: "the meeting" })).toEqual(
      {
        state: "off",
      },
    );
    expect(endpoint.sent).toEqual([]);
    expect(await ana.memories.list()).toEqual([]);
  });

  it("once agreed, reads the diary through the house, newest first, and keeps what it found, placed by meaning", async () => {
    const endpoint = house();
    await agree(ana);
    expect((await memoryState(ana, config)).kind).toBe("on");
    const result = await readDiaries(runtime, now, { fetch: endpoint.fetch });
    expect(result).toMatchObject({ read: 4, failed: 0 });

    // One reading and one placing, both to the house's address with the house's key.
    expect(endpoint.sent.map((request) => new URL(request.url).pathname)).toEqual([
      "/v1/chat/completions",
      "/v1/embeddings",
    ]);
    for (const request of endpoint.sent) expect(request.key).toBe(`Bearer ${HOUSE_KEY}`);
    expect(JSON.parse(endpoint.sent[1]!.body)).toMatchObject({ model: "embed-model" });

    const memories = await ana.memories.list();
    expect(memories.map((memory) => [memory.kind, memory.text])).toEqual(
      expect.arrayContaining([
        ["name", "Ana"],
        ["about", "I work as a nurse on the night shift at the hospital"],
        ["moment", "At the Monday meeting my manager asked about the deadline in front of everyone"],
        ["moment", "Slept four hours after the shift"],
      ]),
    );
    for (const memory of memories.filter((m) => m.kind !== "name")) {
      expect(memory.embeddingModel).toBe("embed-model@256");
      expect(memory.quote).not.toBeNull();
    }
    expect(await ana.memories.progress()).toEqual({ read: 4, unread: 0 });
  });

  it("never sends a page the crisis screen stops, and never keeps anything of it", async () => {
    const all = await ana.memories.list();
    expect(all.some((memory) => memory.text.includes("die") || memory.quote?.includes("die"))).toBe(false);
    // The rehearsal keeps a moment of every page it is shown: three pages shown, the fourth never.
    expect(all.filter((memory) => memory.kind === "moment")).toHaveLength(3);
    const risky = (await ana.entries.list()).find((entry) => entry.situation === RISK)!;
    expect(await ana.memories.of({ kind: "entry", id: risky.id })).toEqual([]);
  });

  it("gives a conversation the name, who they are, and what is near in meaning to what they say", async () => {
    const endpoint = house();
    const note = await recall(
      { scope: ana, config, log, fetch: endpoint.fetch },
      { text: "My manager wants the deadline moved again", now },
    );
    if (note.state !== "on") throw new Error(`expected the memory on, not ${note.state}`);
    expect(note.name).toBe("Ana");
    expect(note.about.map((memory) => memory.text)).toEqual([
      "I work as a nurse on the night shift at the hospital",
    ]);
    const near = [...note.lately, ...note.related].map((memory) => memory.text);
    expect(near).toContain("At the Monday meeting my manager asked about the deadline in front of everyone");
    // The question went to the house to be placed, and only it.
    expect(endpoint.sent).toHaveLength(1);
    expect(JSON.parse(endpoint.sent[0]!.body)).toMatchObject({
      input: ["My manager wants the deadline moved again"],
    });
  });

  it("reads a page again when the person changes it, and keeps a memory they corrected", async () => {
    const endpoint = house();
    const about = (await ana.memories.list()).find((memory) => memory.kind === "about")!;
    await ana.memories.correct(about.id, "Works as a nurse, nights.", null);
    const work = (await ana.entries.list()).find((entry) => entry.situation === WORK)!;
    const before = (await ana.memories.of({ kind: "entry", id: work.id })).filter((m) => m.id !== about.id);
    await ana.entries.correct(work.id, { behavior: "Went to sleep." });
    expect((await ana.memories.progress()).unread).toBe(1);
    await readDiaries(runtime, now, { fetch: endpoint.fetch });
    const after = await ana.memories.of({ kind: "entry", id: work.id });
    // The person's correction stays as they wrote it; what the earlier reading found was replaced by the new one.
    expect(after.find((memory) => memory.id === about.id)).toMatchObject({
      text: "Works as a nurse, nights.",
    });
    for (const old of before) expect(after.map((memory) => memory.id)).not.toContain(old.id);
    expect(after.length).toBeGreaterThan(1);
    // The corrected memory had no place; it was placed in the same reading.
    expect(await ana.memories.unplaced(10)).toEqual([]);
  });

  it("places every memory again when the house's embeddings model changes, under the same consent", async () => {
    const endpoint = house();
    const next = {
      ...config,
      house: { ...config.house!, memory: { ...config.house!.memory, model: "embed-model-2" } },
    };
    expect((await memoryState(ana, next)).kind).toBe("on");
    const result = await rememberNow({ scope: ana, config: next, log, fetch: endpoint.fetch });
    expect(result.placed).toBeGreaterThan(0);
    const placed = (await ana.memories.list()).filter((memory) => memory.kind !== "name");
    for (const memory of placed) expect(memory.embeddingModel).toBe("embed-model-2@256");
    expect(JSON.parse(endpoint.sent[0]!.body)).toMatchObject({ model: "embed-model-2" });
    // And back, for the tests that follow.
    await rememberNow({ scope: ana, config, log, fetch: house().fetch });
  });

  it("pauses when the person's assistant changes, and sends nothing to the new one until they agree", async () => {
    const endpoint = house();
    await ana.agentSettings.update({
      provider: "openai_compatible",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-5-mini",
      apiKey: "sk-own-0123456789abcdef",
    });
    await ana.entries.create({ situation: "A new page, after the change." });
    expect(await memoryState(ana, config)).toEqual({
      kind: "paused",
      why: "route",
      recipients: ["OpenAI"],
      agreed: ["Example AI"],
    });
    expect(await rememberNow({ scope: ana, config, log, fetch: endpoint.fetch })).toMatchObject({
      state: "paused",
      read: 0,
    });
    expect(await recall({ scope: ana, config, log, fetch: endpoint.fetch }, { text: "anything" })).toEqual({
      state: "paused",
    });
    expect(endpoint.sent).toEqual([]);
    await ana.agentSettings.update({ provider: null, baseUrl: null, model: null, apiKey: null });
    expect((await memoryState(ana, config)).kind).toBe("on");
  });

  it("stops at the house's daily bound, and the rest waits", async () => {
    const endpoint = house();
    const busy = await signUp("memory-busy");
    await agree(busy);
    for (let i = 0; i < HOUSE_DAILY_PAGES; i += 1) {
      const entry = await busy.entries.create({ situation: `Page ${i}.` });
      await busy.memories.keep({ kind: "entry", id: entry.id, updatedAt: entry.updatedAt }, [], {
        occurredAt: entry.occurredAt,
        space: null,
      });
    }
    await busy.entries.create({ situation: "One page too many today." });
    const result = await rememberNow(
      { scope: busy, config, log, fetch: endpoint.fetch },
      { now: new Date() },
    );
    expect(result).toMatchObject({ state: "on", read: 0, problem: "daily_bound", waiting: 1 });
    expect(endpoint.sent).toEqual([]);
    // A day later it goes on.
    const later = await rememberNow(
      { scope: busy, config, log, fetch: endpoint.fetch },
      { now: new Date(Date.now() + 25 * 60 * 60 * 1000) },
    );
    expect(later).toMatchObject({ read: 1, problem: null });
  });

  it("forgets everything when the person withdraws, and the worker reads them no more", async () => {
    await ana.consents.record({ purpose: "memory", version: MEMORY_CONSENT_VERSION, granted: false });
    await ana.memories.forgetAll();
    await ana.entries.create({ situation: "Written after the memory was turned off." });
    expect(await runtime.memoryWork()).not.toContain(ana.userId);
    expect(await ana.memories.list()).toEqual([]);
    expect((await memoryState(ana, config)).kind).toBe("off");
  });

  it("writes no words of the diary, and no key, to the logs", () => {
    const logged = lines.join("\n");
    for (const words of [MEETING, WORK, RISK, "nurse", "deadline", "Ana", HOUSE_KEY]) {
      expect(logged).not.toContain(words);
    }
  });
});
