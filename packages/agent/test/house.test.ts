import type { HouseAssistant, ProviderCredentials, Taken, UserScope } from "@sintr/core";
import type { LanguageModel } from "ai";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { metered, resolveAssistant, type Metered } from "../src/assistant";
import { runCaptureTurn, type CaptureTurn } from "../src/driver";
import type { SintrUIMessage } from "../src/shapes";
import { rehearsalScript, scriptedEndpoint, scriptedModel } from "../src/testing";
import { assistant, capturedLogger, collect, memoryPorts, user } from "./support";

/**
 * F5: the house assistant. Who answers (the person's own key first, then
 * the house's), the meter taken before the model and given back after a
 * failure, and what happens when the month's messages are used: nothing is
 * lost, a "salva" still saves, and a crisis still gets the help lines.
 */

const PERSON = { language: "en", timezone: "America/Sao_Paulo" };
const NOW = new Date("2026-10-19T15:00:00Z");
const PERIOD = { start: "2026-10-01", next: "2026-11-01" };
const SITUATION = "My manager asked about the deadline in front of everyone at the Monday meeting.";

const HOUSE: HouseAssistant = {
  provider: "openai_compatible",
  baseUrl: "https://house.example.test/v1",
  model: "house-model",
  apiKey: "sk-house-0123456789abcdef",
  name: "Example",
  voice: { off: false, endpoint: null, model: null, language: null },
};
const OWN: ProviderCredentials = {
  provider: "openai_compatible",
  baseUrl: "https://own.example.test/v1",
  model: "own-model",
  apiKey: "sk-own-fedcba9876543210",
};

/** A month's meter in memory, as the core keeps it. */
function meter(limit: number | null, used = 0) {
  const state = { used, takes: 0, givenBack: 0 };
  const port: Metered = {
    async take(): Promise<Taken> {
      state.takes += 1;
      if (limit !== null && state.used >= limit)
        return { ok: false, used: state.used, limit, period: PERIOD };
      state.used += 1;
      return { ok: true, used: state.used, limit, period: PERIOD };
    },
    async giveBack() {
      state.givenBack += 1;
      state.used -= 1;
    },
  };
  return { port, state };
}

function turn(input: {
  model: LanguageModel;
  message?: SintrUIMessage;
  history?: SintrUIMessage[];
  metered?: Metered;
}) {
  const memory = memoryPorts();
  const logger = capturedLogger();
  const responses: SintrUIMessage[] = [];
  const base: CaptureTurn = {
    model: input.model,
    history: input.history ?? [],
    person: PERSON,
    ports: memory.ports,
    log: logger.log,
    now: NOW,
    onResponse: (message) => {
      responses.push(message);
    },
    ...(input.message ? { message: input.message } : {}),
    ...(input.metered ? { metered: input.metered } : {}),
  };
  return { memory, logger, responses, run: () => collect(runCaptureTurn(base)) };
}

describe("the meter in a conversation", () => {
  it("takes one unit before the model answers, and says how many are used", async () => {
    const model = scriptedModel([{ text: "That sounds hard. What went through your mind?" }]);
    const { port, state } = meter(100, 41);
    const t = turn({ model, message: user(SITUATION), metered: port });
    const out = await t.run();
    expect(model.calls).toHaveLength(1);
    expect(state).toMatchObject({ used: 42, takes: 1, givenBack: 0 });
    expect(out.chunks.find((c) => c.type === "data-usage")).toMatchObject({
      data: { used: 42, limit: 100, next: "2026-11-01" },
      transient: true,
    });
    // The count is for the screen, not part of the stored reply.
    expect(t.responses[0]!.parts.some((p) => p.type === "data-usage")).toBe(false);
  });

  it("gives the unit back when the reply fails", async () => {
    const model = scriptedModel([{ error: new Error("connection reset") }]);
    const { port, state } = meter(100, 10);
    const t = turn({ model, message: user(SITUATION), metered: port });
    const out = await t.run();
    expect(out.types).toContain("error");
    expect(state).toMatchObject({ used: 10, takes: 1, givenBack: 1 });
  });

  it("gives the unit back when the turn breaks before the model answers", async () => {
    const model = scriptedModel([{ text: "unused" }]);
    const { port, state } = meter(100, 10);
    const memory = memoryPorts();
    memory.ports.proposalStates = () => Promise.reject(new Error("database unavailable"));
    const out = await collect(
      runCaptureTurn({
        model,
        history: [],
        message: user(SITUATION),
        person: PERSON,
        ports: memory.ports,
        log: capturedLogger().log,
        now: NOW,
        metered: port,
      }),
    );
    expect(out.types).toContain("error");
    expect(model.calls).toHaveLength(0);
    expect(state).toMatchObject({ used: 10, takes: 1, givenBack: 1 });
  });

  it("never counts a message that signals risk: the screen answers before anything", async () => {
    const model = scriptedModel([{ text: "unused" }]);
    const { port, state } = meter(100, 100);
    const t = turn({ model, message: user("I want to die"), metered: port });
    const out = await t.run();
    expect(state.takes).toBe(0);
    expect(model.calls).toHaveLength(0);
    expect(out.text).toContain("188");
  });

  it("has no meter on a person's own key: nothing is taken", async () => {
    const model = scriptedModel([{ text: "Tell me more." }]);
    const t = turn({ model, message: user(SITUATION) });
    const out = await t.run();
    expect(out.chunks.some((c) => c.type === "data-usage")).toBe(false);
  });
});

describe("when the month's messages are used", () => {
  it("keeps the person's words as a draft entry, word for word, and does not call the model", async () => {
    const model = scriptedModel([{ text: "unused" }]);
    const { port, state } = meter(100, 100);
    const t = turn({ model, message: user(SITUATION), metered: port });
    const out = await t.run();

    expect(model.calls).toHaveLength(0);
    expect(state).toMatchObject({ used: 100, takes: 1 });
    const limit = out.chunks.find((c) => c.type === "data-limit");
    expect(limit).toMatchObject({
      data: {
        used: 100,
        limit: 100,
        next: "2026-11-01",
        saved: null,
        kept: { draft: { situation: SITUATION, occurredAt: NOW.toISOString() } },
      },
    });
    // A real draft, waiting for the person's Confirm like any other.
    const [id, proposal] = [...t.memory.proposals.entries()][0]!;
    expect(proposal).toMatchObject({
      kind: "entry",
      status: "proposed",
      payload: { situation: SITUATION, occurredAt: NOW.toISOString() },
    });
    expect((limit as { data: { kept: { proposalId: string } } }).data.kept.proposalId).toBe(id);
    // Stored as sintr's part of the conversation, with no words the model never wrote.
    expect(out.text).toBe("");
    expect(t.responses[0]!.parts.map((p) => p.type)).toEqual(["data-limit"]);
    expect(t.logger.lines.join("\n")).not.toContain("deadline");
  });

  it('still saves on "salva", without the model, and keeps nothing twice', async () => {
    const model = scriptedModel([{ text: "unused" }]);
    const { port } = meter(100, 100);
    const t = turn({
      model,
      history: [user(SITUATION), assistant("Here is the draft.")],
      message: user("save it"),
      metered: port,
    });
    const { id } = await t.memory.ports.createProposal({ kind: "entry", payload: { situation: SITUATION } });
    const out = await t.run();
    expect(model.calls).toHaveLength(0);
    expect(t.memory.confirmed).toEqual([id]);
    expect(out.chunks.find((c) => c.type === "data-limit")).toMatchObject({
      data: { saved: "entry", kept: null },
    });
    expect(t.memory.proposals.size).toBe(1);
  });

  it("still answers a paused conversation with the help lines, without the model", async () => {
    const model = scriptedModel([{ text: "unused" }]);
    const { port } = meter(100, 100);
    const t = turn({
      model,
      history: [
        user("I want to die"),
        assistant("Thank you for telling me...", [
          { type: "data-crisis", id: "crisis", data: { source: "screen" } },
        ]),
      ],
      message: user("I am still here"),
      metered: port,
    });
    const out = await t.run();
    expect(model.calls).toHaveLength(0);
    expect(out.text).toContain("188");
    expect(out.text).toContain("192");
    expect(out.chunks.some((c) => c.type === "data-limit")).toBe(false);
    expect(t.memory.proposals.size).toBe(0);
  });

  it("counts a paused conversation's model replies, so it is no way around the plan", async () => {
    const model = scriptedModel([{ text: "I am here with you. CVV answers on 188." }]);
    const { port, state } = meter(100, 3);
    const t = turn({
      model,
      history: [
        user("I want to die"),
        assistant("Thank you for telling me...", [
          { type: "data-crisis", id: "crisis", data: { source: "screen" } },
        ]),
      ],
      message: user("tell me a long story about something else"),
      metered: port,
    });
    await t.run();
    expect(model.calls).toHaveLength(1);
    expect(state.used).toBe(4);
  });
});

/** A scope with only what deciding the assistant reads. */
function scopeWith(own: ProviderCredentials | null): UserScope {
  return { agentSettings: { credentials: async () => own } } as unknown as UserScope;
}

describe("who answers", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    // An operator's environment must never be read for anyone's call.
    process.env.OPENAI_API_KEY = "env-openai-key";
    process.env.ANTHROPIC_API_KEY = "env-anthropic-key";
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("is the house assistant for a person without a key, with the house's address and key only", async () => {
    const endpoint = scriptedEndpoint(() => ({ text: "Thank you for telling me." }));
    const resolved = await resolveAssistant(
      scopeWith(null),
      { mode: "saas", fakeAgent: false, house: HOUSE },
      { fetch: endpoint.fetch },
    );
    expect(resolved).toMatchObject({ ok: true, source: "house", rehearsal: false });
    if (!resolved.ok) return;
    const t = turn({ model: resolved.model, message: user(SITUATION) });
    const out = await t.run();
    expect(out.text).toBe("Thank you for telling me.");
    expect(endpoint.requests).toHaveLength(1);
    const [request] = endpoint.requests;
    expect(request!.url).toBe("https://house.example.test/v1/chat/completions");
    expect(request!.headers.get("authorization")).toBe(`Bearer ${HOUSE.apiKey}`);
    expect(request!.body.model).toBe("house-model");
    // The house key is a server secret: it never reaches the logs.
    expect(t.logger.lines.join("\n")).not.toContain(HOUSE.apiKey!);
  });

  it("is the person's own key whenever they saved one, and the house key never leaves for it", async () => {
    const endpoint = scriptedEndpoint(() => ({ text: "Hello." }));
    const resolved = await resolveAssistant(
      scopeWith(OWN),
      { mode: "saas", fakeAgent: false, house: HOUSE },
      { fetch: endpoint.fetch },
    );
    expect(resolved).toMatchObject({ ok: true, source: "own" });
    if (!resolved.ok) return;
    await turn({ model: resolved.model, message: user(SITUATION) }).run();
    expect(endpoint.requests[0]!.url).toBe("https://own.example.test/v1/chat/completions");
    expect(endpoint.requests[0]!.headers.get("authorization")).toBe(`Bearer ${OWN.apiKey}`);
    expect(JSON.stringify([...endpoint.requests[0]!.headers])).not.toContain(HOUSE.apiKey);
  });

  it("reports a broken key of the person's own instead of quietly sending their words to the house", async () => {
    const broken: ProviderCredentials = { provider: "anthropic", baseUrl: null, model: "m", apiKey: null };
    expect(
      await resolveAssistant(scopeWith(broken), { mode: "saas", fakeAgent: false, house: HOUSE }),
    ).toEqual({
      ok: false,
      source: "own",
      problem: "key_required",
    });
  });

  it("is nobody without a house and without a key: the app points to the door", async () => {
    expect(
      await resolveAssistant(scopeWith(null), { mode: "selfhost", fakeAgent: false, house: null }),
    ).toEqual({
      ok: false,
      source: null,
      problem: "not_configured",
    });
  });

  it("lets the house point to the operator's own network, which a person's key may not on the hosted offer", async () => {
    const gateway: HouseAssistant = { ...HOUSE, baseUrl: "http://litellm:4000/v1" };
    expect(
      await resolveAssistant(scopeWith(null), { mode: "saas", fakeAgent: false, house: gateway }),
    ).toMatchObject({
      ok: true,
      source: "house",
    });
    const internal: ProviderCredentials = { ...OWN, baseUrl: "http://ollama:11434/v1" };
    expect(
      await resolveAssistant(scopeWith(internal), { mode: "saas", fakeAgent: false, house: gateway }),
    ).toEqual({
      ok: false,
      source: "own",
      problem: "https_required",
    });
    // A single name with https is still a private network's, not a public host.
    const single: ProviderCredentials = { ...OWN, baseUrl: "https://ollama/v1" };
    expect(
      await resolveAssistant(scopeWith(single), { mode: "saas", fakeAgent: false, house: gateway }),
    ).toEqual({
      ok: false,
      source: "own",
      problem: "private_address",
    });
  });

  it("never takes the house's own address as a person's key, which would be the house uncounted", async () => {
    const asOwn: ProviderCredentials = { ...OWN, baseUrl: "https://HOUSE.example.test/v1/", apiKey: null };
    for (const mode of ["saas", "selfhost"] as const) {
      expect(await resolveAssistant(scopeWith(asOwn), { mode, fakeAgent: false, house: HOUSE })).toEqual({
        ok: false,
        source: "own",
        problem: "private_address",
      });
    }
  });

  it("is the offline rehearsal model for both, with SINTR_FAKE_AGENT", async () => {
    expect(
      await resolveAssistant(scopeWith(null), { mode: "selfhost", fakeAgent: true, house: HOUSE }),
    ).toMatchObject({
      ok: true,
      source: "house",
      rehearsal: true,
    });
    expect(
      await resolveAssistant(scopeWith(OWN), { mode: "selfhost", fakeAgent: true, house: null }),
    ).toMatchObject({
      ok: true,
      source: "own",
      rehearsal: true,
    });
  });
});

describe("the meter port", () => {
  it("gives back to the month it took from, once, and only what it took", async () => {
    const calls: string[] = [];
    let ok = true;
    const scope = {
      plans: {
        take: async () => {
          calls.push("take");
          return { ok, used: 1, limit: 4, period: PERIOD };
        },
        giveBack: async (_meter: string, period: typeof PERIOD) => {
          calls.push(`giveBack ${period.start}`);
        },
      },
    } as unknown as UserScope;
    const reports = metered(scope, "reports", () => NOW);
    await reports.take();
    await reports.giveBack();
    await reports.giveBack();
    ok = false;
    await reports.take();
    await reports.giveBack();
    expect(calls).toEqual(["take", "giveBack 2026-10-01", "take"]);
  });
});

describe("the fake endpoint", () => {
  it("speaks the OpenAI chat API well enough for the rehearsal's whole capture flow", async () => {
    const endpoint = scriptedEndpoint(rehearsalScript);
    const resolved = await resolveAssistant(
      scopeWith(null),
      { mode: "selfhost", fakeAgent: false, house: HOUSE },
      { fetch: endpoint.fetch },
    );
    if (!resolved.ok) throw new Error("no assistant");
    const memory = memoryPorts();
    const history: SintrUIMessage[] = [];
    for (const text of [SITUATION, 'I thought: "I am going to let everyone down". Anxiety 80.']) {
      const message = user(text);
      const responses: SintrUIMessage[] = [];
      await collect(
        runCaptureTurn({
          model: resolved.model,
          history,
          message,
          person: PERSON,
          ports: memory.ports,
          log: capturedLogger().log,
          now: NOW,
          onResponse: (response) => {
            responses.push(response);
          },
        }),
      );
      history.push(message, ...responses);
    }
    const [draft] = [...memory.proposals.values()];
    expect(draft).toMatchObject({
      kind: "entry",
      payload: { situation: SITUATION, thoughts: ["I am going to let everyone down"] },
    });
    // Streamed answers and a tool call round trip, all through the HTTP shape.
    expect(endpoint.requests.every((r) => r.body.stream === true)).toBe(true);
    expect(endpoint.requests.length).toBeGreaterThanOrEqual(3);
  });
});
