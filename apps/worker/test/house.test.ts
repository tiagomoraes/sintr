import { randomUUID } from "node:crypto";
import {
  metered,
  prepareReport,
  reportModel,
  resolveAssistant,
  runCaptureTurn,
  scopePorts,
  serializeMessage,
  type SintrUIMessage,
} from "@sintr/agent";
import { rehearsalScript, scriptedEndpoint } from "@sintr/agent/testing";
import {
  PERSON_PLANS,
  createLogger,
  generateMasterKey,
  loadConfig,
  memoryTransport,
  parseContent,
  planReportNow,
  zonedTime,
  type UserScope,
} from "@sintr/core";
import { createRuntime } from "@sintr/core/runtime";
import { usageCounters } from "@sintr/core/schema";
import { createDatabase } from "@sintr/core/db";
import { afterAll, describe, expect, inject, it } from "vitest";
import { prepareDueReports } from "../src/reports";

/**
 * F5, end to end below the web app: a new account on an installation with
 * a house assistant signs up, has one conversation and gets one report,
 * without ever setting up a provider. The house assistant is a fake
 * OpenAI-compatible endpoint answered by the rehearsal script, reached
 * through the real adapter (address, key, streaming); nothing touches the
 * network and no real model is involved, so the model's own quality is not
 * what this tests.
 */

const HOUSE_KEY = `sk-house-${randomUUID().replaceAll("-", "")}`;
const config = loadConfig({
  DATABASE_URL: inject("houseDatabaseUrl"),
  SINTR_AUTH_SECRET: randomUUID() + randomUUID(),
  SINTR_MASTER_KEY: generateMasterKey(),
  SINTR_LOG_LEVEL: "error",
  SINTR_HOUSE_PROVIDER: "openai_compatible",
  SINTR_HOUSE_BASE_URL: "https://house.example.test/v1",
  SINTR_HOUSE_MODEL: "house-model",
  SINTR_HOUSE_KEY: HOUSE_KEY,
});
const runtime = createRuntime(config, { service: "test", poolSize: 2, email: memoryTransport() });
const handle = createDatabase(inject("houseDatabaseUrl"), { max: 1 });
const lines: string[] = [];
const log = createLogger({ level: "debug", write: (_level, line) => lines.push(line) });

afterAll(async () => {
  await runtime.close();
  await handle.close();
});

/** Sign up as the form does: email, password and the consent. */
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

/** One turn as the chat route runs it: the message stored first, the reply after. */
async function say(scope: UserScope, conversationId: string, text: string, fetch: typeof globalThis.fetch) {
  const assistant = await resolveAssistant(scope, config, { fetch });
  if (!assistant.ok) throw new Error(`no assistant: ${assistant.problem}`);
  const rows = await scope.conversations.messages(conversationId);
  const history = rows.map((row) => JSON.parse(row.content) as { parts: SintrUIMessage["parts"] });
  const message: SintrUIMessage = { id: randomUUID(), role: "user", parts: [{ type: "text", text }] };
  await scope.conversations.append(conversationId, serializeMessage(message));
  const person = { language: "en", timezone: "America/Sao_Paulo" };
  const chunks: string[] = [];
  const stream = runCaptureTurn({
    model: assistant.model,
    history: rows.map((row, i) => ({ id: row.id, role: row.role as "user", parts: history[i]!.parts })),
    message,
    person,
    ports: scopePorts(scope, conversationId, person),
    log,
    ...(assistant.source === "house" ? { metered: metered(scope, "assistantMessages") } : {}),
    onResponse: async (response) => {
      await scope.conversations.append(conversationId, serializeMessage(response));
    },
  });
  for await (const chunk of stream) chunks.push(chunk.type);
  return { source: assistant.source, chunks };
}

const SITUATION = "At the Monday meeting my manager asked about the deadline in front of everyone.";
const THOUGHTS = 'I thought: "I am going to let everyone down". Anxiety 80, shame 60.';

describe("a new account on an installation with a house assistant", () => {
  it("signs up, talks, keeps an entry and gets a report, without ever choosing a provider", async () => {
    const endpoint = scriptedEndpoint(rehearsalScript);
    const ana = await signUp("house-ana");
    expect(await ana.agentSettings.credentials()).toBeNull();

    // One conversation: the assistant asks, then drafts, then the person confirms.
    const conversation = await ana.conversations.create({ title: "The meeting" });
    expect((await say(ana, conversation.id, SITUATION, endpoint.fetch)).source).toBe("house");
    await say(ana, conversation.id, THOUGHTS, endpoint.fetch);
    const [draft] = await ana.proposals.list(conversation.id);
    expect(draft).toMatchObject({ kind: "entry", status: "proposed" });
    await ana.proposals.confirm(draft!.id);
    const [entry] = await ana.entries.list();
    expect(entry).toMatchObject({ situation: SITUATION, thoughts: ["I am going to let everyone down"] });

    // One report, as "Prepare it now" makes it.
    const plan = planReportNow({
      schedule: await ana.sessions.schedule(),
      timeZone: (await ana.profile.get()).timezone,
      reports: await ana.reports.recent(),
      now: new Date(),
    });
    if (plan.action !== "create") throw new Error("expected a report to prepare");
    const { model, problem, metered: reports } = await reportModel(ana, config, { fetch: endpoint.fetch });
    expect(problem).toBeNull();
    const prepared = await prepareReport({ scope: ana, period: plan.period, model, metered: reports, log });
    const content = parseContent(prepared!.report.content)!;
    expect(content.author).toBe("assistant");
    expect(content.moments.map((m) => m.thoughts)).toEqual([["I am going to let everyone down"]]);

    // Every call went to the house, with the house's key, and the plan counted them.
    expect(endpoint.requests.length).toBeGreaterThanOrEqual(4);
    for (const request of endpoint.requests) {
      expect(request.url).toBe("https://house.example.test/v1/chat/completions");
      expect(request.headers.get("authorization")).toBe(`Bearer ${HOUSE_KEY}`);
      expect(request.body.model).toBe("house-model");
    }
    const month = await ana.plans.current();
    expect(month.plan).toMatchObject({ id: "free", source: "installation" });
    expect(month.used).toEqual({ assistantMessages: 2, reports: 1, audioMinutes: 0 });

    // The house key is never stored for the person, never logged, and the diary's words are not logged either.
    expect(await ana.agentSettings.get()).toMatchObject({ provider: null, hasKey: false });
    const logged = lines.join("\n");
    expect(logged).not.toContain(HOUSE_KEY);
    expect(logged).not.toContain("deadline");
    expect(logged).not.toContain("let everyone down");
  });

  it("uses a person's own key instead, when they bring one, and counts nothing", async () => {
    const endpoint = scriptedEndpoint(rehearsalScript);
    const bia = await signUp("house-bia");
    await bia.agentSettings.update({
      provider: "openai_compatible",
      baseUrl: "https://own.example.test/v1",
      model: "own-model",
      apiKey: "sk-own-0123456789abcdef",
    });
    const conversation = await bia.conversations.create({ title: null });
    expect((await say(bia, conversation.id, SITUATION, endpoint.fetch)).source).toBe("own");
    expect(endpoint.requests[0]!.url).toBe("https://own.example.test/v1/chat/completions");
    expect(endpoint.requests[0]!.headers.get("authorization")).toBe("Bearer sk-own-0123456789abcdef");
    expect((await bia.plans.current()).used.assistantMessages).toBe(0);
  });

  it("keeps the words and stops the assistant at the month's limit; the report is prepared by sintr alone", async () => {
    const endpoint = scriptedEndpoint(rehearsalScript);
    const cris = await signUp("house-cris");
    // A session nobody else in the test database has, so the scheduler prepares hers alone.
    const ZONE = "Pacific/Chatham";
    await cris.profile.update({ timezone: ZONE });
    await cris.therapySettings.update({ reportLeadMinutes: 60 });
    await cris.sessions.add({ startsOn: "2026-10-01", time: "03:17", repeat: "weekly" });
    const { assistantMessages, reports } = PERSON_PLANS.free.allowance;
    // A month already used up.
    const now = zonedTime({ year: 2026, month: 10, day: 22, hour: 2, minute: 17 }, ZONE);
    await handle.db.insert(usageCounters).values({
      userId: cris.userId,
      period: "2026-10-01",
      assistantMessages: assistantMessages!,
      reports: reports!,
    });

    // The scheduled report still arrives, made of the person's own words, and no model was asked.
    const due = await prepareDueReports({ ...runtime, log, config: { ...config, fakeAgent: false } }, now, {
      modelFor: (scope) => reportModel(scope, config, { fetch: endpoint.fetch }),
    });
    expect(due).toEqual({ prepared: 1, failed: 0 });
    const [report] = await cris.reports.list();
    expect(parseContent(report!.content)).toMatchObject({ author: "sintr", problem: "limit_reached" });
    expect(endpoint.requests).toHaveLength(0);
    expect((await cris.plans.current(now)).used.reports).toBe(reports);
  });

  it("leaves an assistant's draft as it is when the scheduler would prepare it again over the limit", async () => {
    const endpoint = scriptedEndpoint(rehearsalScript);
    const dani = await signUp("house-dani");
    // Another session nobody else has: Fridays at 04:41 in Chatham.
    const ZONE = "Pacific/Chatham";
    await dani.profile.update({ timezone: ZONE });
    await dani.therapySettings.update({ reportLeadMinutes: 60 });
    await dani.sessions.add({ startsOn: "2026-10-02", time: "04:41", repeat: "weekly" });
    await dani.checkins.create({
      occurredAt: zonedTime({ year: 2026, month: 10, day: 21, hour: 10, minute: 0 }, ZONE),
      mood: 3,
      note: "a calm day",
    });
    // "Prepare it now" the evening before: the assistant writes it, one unit.
    const early = zonedTime({ year: 2026, month: 10, day: 22, hour: 20, minute: 0 }, ZONE);
    const plan = planReportNow({
      schedule: await dani.sessions.schedule(),
      timeZone: ZONE,
      reports: await dani.reports.recent(),
      now: early,
    });
    if (plan.action !== "create") throw new Error("expected a report to prepare");
    const now = await reportModel(dani, config, { fetch: endpoint.fetch });
    await prepareReport({ scope: dani, period: plan.period, model: now.model, metered: now.metered, log });
    expect(parseContent((await dani.reports.list())[0]!.content)?.author).toBe("assistant");
    // Then the month's reports are used, and the preparation time comes.
    const used = { reports: PERSON_PLANS.free.allowance.reports! };
    await handle.db
      .insert(usageCounters)
      .values({ userId: dani.userId, period: "2026-10-01", ...used })
      .onConflictDoUpdate({ target: [usageCounters.userId, usageCounters.period], set: used });
    const calls = endpoint.requests.length;
    const due = await prepareDueReports(
      { ...runtime, log, config: { ...config, fakeAgent: false } },
      zonedTime({ year: 2026, month: 10, day: 23, hour: 3, minute: 41 }, ZONE),
      { modelFor: (scope) => reportModel(scope, config, { fetch: endpoint.fetch }) },
    );
    expect(due).toEqual({ prepared: 0, failed: 0 });
    const reports = await dani.reports.list();
    expect(reports).toHaveLength(1);
    expect(parseContent(reports[0]!.content)?.author).toBe("assistant");
    expect(endpoint.requests.length).toBe(calls);
    expect((await dani.plans.current(early)).used.reports).toBe(PERSON_PLANS.free.allowance.reports);
  });

  it("counts one report when two preparations of the same period race", async () => {
    const endpoint = scriptedEndpoint(rehearsalScript);
    const eli = await signUp("house-eli");
    const plan = planReportNow({
      schedule: await eli.sessions.schedule(),
      timeZone: "UTC",
      reports: [],
      now: new Date(),
    });
    if (plan.action !== "create") throw new Error("expected a report to prepare");
    const both = await Promise.all(
      [1, 2].map(async () => {
        const { model, metered: reports } = await reportModel(eli, config, { fetch: endpoint.fetch });
        return prepareReport({ scope: eli, period: plan.period, model, metered: reports, log });
      }),
    );
    expect(both.filter(Boolean)).toHaveLength(1);
    expect(await eli.reports.list()).toHaveLength(1);
    expect((await eli.plans.current()).used.reports).toBe(1);
  });
});
