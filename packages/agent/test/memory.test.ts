import type { Entry, HouseAssistant, Memory, ProviderCredentials, UnreadSource } from "@sintr/core";
import { describe, expect, it } from "vitest";
import { MEMORY_WAIT_MS, runCaptureTurn, type CaptureTurn } from "../src/driver";
import { embedTexts, rehearsalEmbedding } from "../src/memory/embed";
import { memorySection } from "../src/memory/prompt";
import { mayRead, pageText, pagesOf, readPages } from "../src/memory/read";
import { memoryRecipients, memoryRouteFor, type EmbeddingRoute } from "../src/memory/route";
import { agreedRecipients, recipientRecord } from "../src/memory/service";
import { rehearsalMemories, rehearsalModel, scriptedModel } from "../src/testing";
import type { SintrUIMessage } from "../src/shapes";
import {
  assistant,
  capturedLogger,
  collect,
  instructionsOf,
  memoryPorts,
  toolResultsOf,
  user,
} from "./support";

/**
 * F10: the memory, as far as it needs no database (the worker's tests take
 * it through Postgres): who places words by meaning and what goes on the
 * wire, the reading held to the capture rules, and the conversation, which
 * never asks the memory before the crisis screen.
 */

const HOUSE: HouseAssistant = {
  provider: "openai_compatible",
  baseUrl: "https://openrouter.ai/api/v1",
  model: "anthropic/claude-haiku-5.5",
  apiKey: "sk-house-0123456789abcdef",
  name: "OpenRouter",
  voice: { off: false, endpoint: null, model: null, language: null },
  memory: { off: false, endpoint: null, model: null },
};
const ANTHROPIC_HOUSE: HouseAssistant = {
  ...HOUSE,
  provider: "anthropic",
  baseUrl: null,
  model: "claude-haiku-5-5",
  name: "Anthropic",
};
const OWN_OPENAI: ProviderCredentials = {
  provider: "openai_compatible",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-5-mini",
  apiKey: "sk-own-fedcba9876543210",
};

function entry(fields: Partial<Entry>): Entry {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    occurredAt: new Date("2026-10-12T21:00:00Z"),
    alternativeBelief: null,
    peakIntensity: null,
    createdAt: new Date("2026-10-12T21:00:00Z"),
    updatedAt: new Date("2026-10-12T21:00:00Z"),
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
    emotionsAfter: null,
    ...fields,
  };
}

const PAGE: UnreadSource = {
  kind: "entry",
  entry: entry({
    situation: "Minha irmã Ana ligou do hospital. Eu trabalho no plantão noturno e não pude ir.",
    thoughts: ["eu devia estar lá"],
    emotions: [{ name: "culpa", intensity: 70 }],
  }),
};

describe("who places a memory by meaning", () => {
  it("follows who answers: the house's own provider, with the model it is known to have", () => {
    const routed = memoryRouteFor(null, HOUSE);
    expect(routed).toEqual({
      source: "house",
      route: {
        kind: "openai",
        service: "openrouter",
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: HOUSE.apiKey,
        model: "openai/text-embedding-3-small",
        trusted: true,
      },
    });
    expect(memoryRecipients(null, HOUSE, routed)).toEqual(["OpenRouter"]);
  });

  it("uses a person's own provider, never the house, whenever they brought a key", () => {
    const routed = memoryRouteFor(OWN_OPENAI, HOUSE);
    expect(routed.source).toBe("own");
    expect(routed.route).toMatchObject({
      kind: "openai",
      service: "openai",
      model: "text-embedding-3-small",
    });
    expect(routed.route).toMatchObject({ apiKey: OWN_OPENAI.apiKey, trusted: false });
    expect(memoryRecipients(OWN_OPENAI, HOUSE, routed)).toEqual(["OpenAI"]);
    const google = memoryRouteFor(
      { provider: "google", baseUrl: null, model: "gemini-3-flash", apiKey: "g-key" },
      HOUSE,
    );
    expect(google.route).toMatchObject({ kind: "gemini", model: "gemini-embedding-001" });
  });

  it("does not guess: Anthropic has no embeddings, and an endpoint sintr does not know is not used", () => {
    expect(
      memoryRouteFor({ provider: "anthropic", baseUrl: null, model: "m", apiKey: "k" }, HOUSE).route,
    ).toEqual({
      kind: "none",
      reason: "provider_has_no_embeddings",
    });
    expect(
      memoryRouteFor(
        { provider: "openai_compatible", baseUrl: "http://localhost:11434/v1", model: "m", apiKey: null },
        HOUSE,
      ).route,
    ).toEqual({ kind: "none", reason: "provider_unknown" });
    expect(memoryRouteFor(null, ANTHROPIC_HOUSE).route).toEqual({
      kind: "none",
      reason: "provider_has_no_embeddings",
    });
    expect(memoryRouteFor(null, null)).toEqual({
      source: null,
      route: { kind: "none", reason: "not_configured" },
    });
    expect(
      memoryRouteFor(null, { ...HOUSE, memory: { off: true, endpoint: null, model: null } }).route,
    ).toEqual({
      kind: "none",
      reason: "off",
    });
  });

  it("names both providers when the house places memories through an endpoint of its own", () => {
    const house: HouseAssistant = {
      ...ANTHROPIC_HOUSE,
      memory: {
        off: false,
        endpoint: { baseUrl: "https://api.openai.com/v1", apiKey: "sk-embed" },
        model: null,
      },
    };
    const routed = memoryRouteFor(null, house);
    expect(routed.route).toMatchObject({
      kind: "openai",
      service: "openai",
      apiKey: "sk-embed",
      trusted: true,
    });
    expect(memoryRecipients(null, house, routed)).toEqual(["Anthropic", "OpenAI"]);
  });

  it("records the providers in the consent and reads them back", () => {
    expect(agreedRecipients({ recipient: recipientRecord(["Anthropic", "OpenAI"]) })).toEqual([
      "Anthropic",
      "OpenAI",
    ]);
    expect(agreedRecipients({ recipient: null })).toEqual([]);
    expect(agreedRecipients({ recipient: "not json" })).toEqual([]);
  });
});

describe("placing words by meaning, on the wire", () => {
  const route = memoryRouteFor(null, HOUSE).route as Exclude<EmbeddingRoute, { kind: "none" }>;

  function endpoint(answer: (body: unknown) => Response) {
    const requests: {
      url: string;
      headers: Headers;
      body: unknown;
      redirect: string | undefined;
    }[] = [];
    const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const request = new Request(input, init);
      const body = JSON.parse(await request.text()) as unknown;
      requests.push({ url: request.url, headers: request.headers, body, redirect: init?.redirect });
      return answer(body);
    }) as typeof globalThis.fetch;
    return { fetch, requests };
  }

  it("sends the words, the model and the key to /embeddings, and keeps the vectors in order", async () => {
    const fake = endpoint(() =>
      Response.json({
        data: [
          { index: 1, embedding: [0, 1, 0] },
          { index: 0, embedding: [1, 0, 0] },
        ],
      }),
    );
    const result = await embedTexts(route, ["first", "second"], { mode: "saas", fetch: fake.fetch });
    expect(result).toEqual({
      ok: true,
      space: { model: "openai/text-embedding-3-small", dimensions: 3 },
      vectors: [
        [1, 0, 0],
        [0, 1, 0],
      ],
    });
    expect(fake.requests[0]!.url).toBe("https://openrouter.ai/api/v1/embeddings");
    expect(fake.requests[0]!.headers.get("authorization")).toBe(`Bearer ${HOUSE.apiKey}`);
    expect(fake.requests[0]!.body).toEqual({
      model: "openai/text-embedding-3-small",
      input: ["first", "second"],
      encoding_format: "float",
    });
  });

  it("asks Gemini for its own shape, with the key in its header", async () => {
    const gemini = memoryRouteFor({ provider: "google", baseUrl: null, model: "m", apiKey: "g-key" }, null)
      .route as Exclude<EmbeddingRoute, { kind: "none" }>;
    const fake = endpoint(() => Response.json({ embeddings: [{ values: [0.5, 0.5] }] }));
    const result = await embedTexts(gemini, ["words"], { mode: "selfhost", fetch: fake.fetch });
    expect(result).toMatchObject({ ok: true, space: { model: "gemini-embedding-001", dimensions: 2 } });
    expect(fake.requests[0]!.url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents",
    );
    expect(fake.requests[0]!.headers.get("x-goog-api-key")).toBe("g-key");
    expect(fake.requests[0]!.body).toMatchObject({
      requests: [{ model: "models/gemini-embedding-001", content: { parts: [{ text: "words" }] } }],
    });
  });

  it("answers a failure with a code, never with what the provider said", async () => {
    const { log, lines } = capturedLogger();
    const refused = endpoint(() =>
      Response.json({ error: { message: "bad key for words" } }, { status: 401 }),
    );
    expect(
      await embedTexts(route, ["the person's words"], { mode: "saas", fetch: refused.fetch, log }),
    ).toEqual({
      ok: false,
      problem: "key_refused",
    });
    const short = endpoint(() => Response.json({ data: [{ index: 0, embedding: [1, 0] }] }));
    expect(await embedTexts(route, ["a", "b"], { mode: "saas", fetch: short.fetch, log })).toEqual({
      ok: false,
      problem: "provider_error",
    });
    expect(lines.join("\n")).not.toContain("person's words");
    expect(lines.join("\n")).not.toContain("bad key");
  });

  it("holds a person's own address to the hosted offer's rules, and refuses redirects for it", async () => {
    const own = memoryRouteFor(
      { provider: "openai_compatible", baseUrl: "http://10.0.0.5/v1", model: "m", apiKey: "k" },
      { ...HOUSE, memory: { off: false, endpoint: null, model: null } },
    );
    // Unknown, so not used at all; with a model named by an operator it would be a gateway.
    expect(own.route.kind).toBe("none");
    const personal = { ...route, trusted: false, baseUrl: "https://openrouter.ai/api/v1" };
    const fake = endpoint(() => Response.json({ data: [{ index: 0, embedding: [1, 0] }] }));
    await embedTexts(personal, ["x"], { mode: "saas", fetch: fake.fetch });
    expect(fake.requests[0]!.redirect).toBe("error");
    expect(await embedTexts({ ...personal, baseUrl: "http://10.0.0.5/v1" }, ["x"], { mode: "saas" })).toEqual(
      {
        ok: false,
        problem: "https_required",
      },
    );
  });

  it("rehearses offline: texts that share words are near each other", () => {
    const result = rehearsalEmbedding([
      "the presentation at work",
      "my presentation at work went badly",
      "a quiet walk",
    ]);
    if (!result.ok) throw new Error("rehearsal failed");
    const [a, b, c] = result.vectors as [number[], number[], number[]];
    const cos = (x: number[], y: number[]) =>
      x.reduce((s, v, i) => s + v * y[i]!, 0) /
      Math.sqrt(x.reduce((s, v) => s + v * v, 0) * y.reduce((s, v) => s + v * v, 0));
    expect(cos(a, b)).toBeGreaterThan(cos(a, c));
    expect(result.space).toEqual({ model: "rehearsal", dimensions: 256 });
  });
});

describe("reading the diary", () => {
  const pages = pagesOf([PAGE], "America/Sao_Paulo");

  it("shows the model the page in labelled lines, dated where the person is", () => {
    expect(pages[0]!.day).toBe("2026-10-12");
    const text = pageText(pages[0]!);
    expect(text).toContain('<page id="p1" kind="entry" day="2026-10-12">');
    expect(text).toContain("what happened: Minha irmã Ana ligou do hospital.");
    expect(text).toContain('thoughts: "eu devia estar lá"');
    expect(text).toContain("feelings: culpa 70");
  });

  it("keeps the person's own span as the quote, and the model's sentence as the memory", async () => {
    const model = scriptedModel([
      {
        toolCalls: [
          {
            toolName: "remember",
            input: {
              memories: [
                {
                  page: "p1",
                  kind: "about",
                  text: "Trabalha no plantão noturno.",
                  quote: "TRABALHO no  plantão noturno",
                },
                {
                  page: "p1",
                  kind: "moment",
                  text: "A irmã, Ana, ligou do hospital.",
                  quote: "“Minha irmã Ana ligou do hospital”",
                },
              ],
            },
          },
        ],
      },
    ]);
    const reading = await readPages({ model, pages, known: [], log: capturedLogger().log });
    expect(reading).toMatchObject({ ok: true, refused: 0 });
    if (!reading.ok) return;
    expect(reading.found.get("p1")).toEqual([
      { kind: "about", text: "Trabalha no plantão noturno.", quote: "trabalho no plantão noturno" },
      { kind: "moment", text: "A irmã, Ana, ligou do hospital.", quote: "Minha irmã Ana ligou do hospital" },
    ]);
    expect(instructionsOf(model.calls[0]!)).toContain("Every memory rests on the person's own words");
  });

  it("keeps a memory with the page its words are on, even if the model named another, and without a copied label", async () => {
    const meeting: UnreadSource = {
      kind: "entry",
      entry: entry({
        id: "00000000-0000-4000-8000-000000000002",
        situation: "O chefe, Marcos, perguntou do prazo.",
      }),
    };
    const two = pagesOf([PAGE, meeting], "UTC");
    const model = scriptedModel([
      {
        toolCalls: [
          {
            toolName: "remember",
            input: {
              memories: [
                // The meeting is on p2, though the model says p1.
                {
                  page: "p1",
                  kind: "about",
                  text: "Tem um chefe, Marcos.",
                  quote: "O chefe, Marcos, perguntou do prazo",
                },
                {
                  page: "p1",
                  kind: "moment",
                  text: "Ana ligou do hospital.",
                  quote: "what happened: Minha irmã Ana ligou do hospital",
                },
                // Words on no page are still refused.
                { page: "p2", kind: "about", text: "Gosta de café.", quote: "eu adoro café" },
              ],
            },
          },
        ],
      },
      { toolCalls: [{ toolName: "remember", input: { memories: [] } }] },
    ]);
    const reading = await readPages({ model, pages: two, known: [], log: capturedLogger().log });
    if (!reading.ok) throw new Error("reading failed");
    expect(reading.found.get("p1")).toEqual([
      { kind: "moment", text: "Ana ligou do hospital.", quote: "Minha irmã Ana ligou do hospital" },
    ]);
    expect(reading.found.get("p2")).toEqual([
      { kind: "about", text: "Tem um chefe, Marcos.", quote: "O chefe, Marcos, perguntou do prazo" },
    ]);
    expect(JSON.stringify(toolResultsOf(model.calls[1]!))).toContain("eu adoro café");
  });

  it("refuses an invented quote, a cause or a clinical label, tells the model why once, and keeps what holds", async () => {
    const model = scriptedModel([
      {
        toolCalls: [
          {
            toolName: "remember",
            input: {
              memories: [
                {
                  page: "p1",
                  kind: "moment",
                  text: "Ana ligou do hospital.",
                  quote: "Ana ligou do hospital",
                },
                { page: "p1", kind: "about", text: "Tem uma irmã.", quote: "eu tenho uma irmã mais velha" },
                {
                  page: "p1",
                  kind: "moment",
                  text: "Sente culpa porque não foi.",
                  quote: "eu devia estar lá",
                },
                {
                  page: "p1",
                  kind: "about",
                  text: "Mostra sinais de depressão.",
                  quote: "eu devia estar lá",
                },
              ],
            },
          },
        ],
      },
      { toolCalls: [{ toolName: "remember", input: { memories: [] } }] },
    ]);
    const reading = await readPages({
      model,
      pages,
      known: ["Tem uma irmã, Ana."],
      log: capturedLogger().log,
    });
    if (!reading.ok) throw new Error("reading failed");
    expect(reading.found.get("p1")).toEqual([
      { kind: "moment", text: "Ana ligou do hospital.", quote: "Ana ligou do hospital" },
    ]);
    expect(model.calls).toHaveLength(2);
    const told = JSON.stringify(toolResultsOf(model.calls[1]!));
    expect(told).toContain("is not words the person wrote on one line of the page");
    expect(told).toContain("states a cause");
    expect(told).toContain("clinical label");
    expect(JSON.stringify(model.calls[0]!.prompt)).toContain(
      "Already known about them:\\n- Tem uma irmã, Ana.",
    );
  });

  it("never sends a page the crisis screen stops, and never keeps words the screen stops from another page", async () => {
    const risky: UnreadSource = { kind: "entry", entry: entry({ situation: "Hoje eu quero morrer." }) };
    const [stopped] = pagesOf([risky], "UTC");
    expect(mayRead(stopped!)).toBe(false);
    expect(mayRead(pages[0]!)).toBe(true);
    const model = scriptedModel([
      {
        toolCalls: [
          {
            toolName: "remember",
            input: {
              memories: [
                { page: "p1", kind: "moment", text: "Escreveu: quero morrer.", quote: "eu devia estar lá" },
              ],
            },
          },
        ],
      },
      { toolCalls: [{ toolName: "remember", input: { memories: [] } }] },
    ]);
    const reading = await readPages({ model, pages, known: [], log: capturedLogger().log });
    if (!reading.ok) throw new Error("reading failed");
    expect(reading.found.get("p1")).toEqual([]);
  });

  it("reports a provider that fails as a code, and keeps nothing", async () => {
    const { log, lines } = capturedLogger();
    const model = scriptedModel([{ error: new TypeError("fetch failed") }]);
    expect(await readPages({ model, pages, known: [], log })).toEqual({ ok: false, problem: "unreachable" });
    expect(lines.join("\n")).not.toContain("Ana");
  });
});

function memory(fields: Partial<Memory>): Memory {
  return {
    id: "m1",
    kind: "moment",
    text: "The presentation went badly.",
    quote: "the presentation went badly",
    source: { kind: "entry", id: "e1" },
    occurredAt: new Date("2026-10-12T21:00:00Z"),
    embeddingModel: "rehearsal@256",
    editedAt: null,
    createdAt: new Date("2026-10-12T21:00:00Z"),
    updatedAt: new Date("2026-10-12T21:00:00Z"),
    ...fields,
  };
}

describe("the memory in the conversation", () => {
  it("is a section after the instructions: the name, who they are, lately and what is related, dated", () => {
    const section = memorySection(
      {
        state: "on",
        name: "Tiago",
        about: [memory({ kind: "about", text: "Works night shifts.", quote: "night shift" })],
        lately: [],
        related: [memory({})],
      },
      "America/Sao_Paulo",
    );
    expect(section).toContain("They go by: Tiago");
    expect(section).toContain("Who they are:\n- 12 October 2026: Works night shifts.");
    expect(section).toContain(
      'Related to what they are telling you now:\n- 12 October 2026: The presentation went badly. Their words: "the presentation went badly"',
    );
    expect(section).toContain("never a diagnosis");
    expect(section).toContain("The safety rules above always come first.");
  });

  it("says plainly when there is no memory, so the assistant does not pretend", () => {
    expect(memorySection({ state: "off" }, "UTC")).toContain("sintr keeps no memory of this person");
    expect(memorySection({ state: "paused" }, "UTC")).toContain("is paused");
  });

  function turn(input: {
    model: CaptureTurn["model"];
    message: SintrUIMessage;
    history?: SintrUIMessage[];
    memory: NonNullable<CaptureTurn["memory"]>;
  }): CaptureTurn {
    return {
      model: input.model,
      history: input.history ?? [],
      message: input.message,
      memory: input.memory,
      person: { language: "en", timezone: "UTC" },
      ports: memoryPorts().ports,
      log: capturedLogger().log,
      now: new Date("2026-10-19T12:00:00Z"),
    };
  }

  it("reaches the model as part of its instructions, asked with the person's words", async () => {
    const asked: string[] = [];
    const model = scriptedModel([{ text: "Hello." }]);
    await collect(
      runCaptureTurn(
        turn({
          model,
          message: user("The presentation is tomorrow."),
          memory: async (text) => {
            asked.push(text);
            return memorySection({ state: "on", name: "Tiago", about: [], lately: [], related: [] }, "UTC");
          },
        }),
      ),
    );
    expect(asked).toEqual(["The presentation is tomorrow."]);
    const instructions = instructionsOf(model.calls[0]!);
    expect(instructions).toContain("Acknowledge first");
    expect(instructions.indexOf("What you remember about them")).toBeGreaterThan(
      instructions.indexOf("Safety comes first"),
    );
  });

  it("is never asked when the crisis screen stops the message, nor in a paused conversation", async () => {
    let asked = 0;
    const ask = async () => {
      asked += 1;
      return "What you remember about them";
    };
    const model = scriptedModel([{ text: "I am here." }]);
    const stopped = await collect(
      runCaptureTurn(turn({ model, message: user("I want to die"), memory: ask })),
    );
    expect(stopped.text).toContain("188");
    expect(model.calls).toHaveLength(0);
    const paused: SintrUIMessage[] = [
      user("I want to die"),
      assistant("Thank you for telling me...", [
        { type: "data-crisis", id: "crisis", data: { source: "screen" } },
      ]),
    ];
    await collect(
      runCaptureTurn(turn({ model, history: paused, message: user("I feel a bit better"), memory: ask })),
    );
    expect(model.calls).toHaveLength(1);
    expect(instructionsOf(model.calls[0]!)).not.toContain("What you remember");
    expect(asked).toBe(0);
  });

  it("never holds the reply: a memory that fails or is late is left out", async () => {
    const failing = scriptedModel([{ text: "Hello." }]);
    const out = await collect(
      runCaptureTurn(
        turn({
          model: failing,
          message: user("hi"),
          memory: () => Promise.reject(new Error("embeddings down")),
        }),
      ),
    );
    expect(out.text).toBe("Hello.");
    expect(instructionsOf(failing.calls[0]!)).not.toContain("What you remember");
    expect(MEMORY_WAIT_MS).toBeLessThanOrEqual(6_000);
  });
});

describe("the rehearsal's memory (the offline provider of the end-to-end tests)", () => {
  it("keeps a moment of each page in the person's own words, and their work when a page says it", () => {
    const pages = pagesOf([PAGE], "UTC").map(pageText).join("\n\n");
    expect(rehearsalMemories(pages).memories).toEqual([
      {
        page: "p1",
        kind: "moment",
        text: "Minha irmã Ana ligou do hospital",
        quote: "Minha irmã Ana ligou do hospital",
      },
      {
        page: "p1",
        kind: "about",
        text: "trabalho no plantão noturno e não pude ir",
        quote: "trabalho no plantão noturno e não pude ir",
      },
    ]);
  });

  it("calls the person by their name and brings up what is related, so a test can see the memory arrived", async () => {
    const model = rehearsalModel();
    const out = await collect(
      runCaptureTurn(
        turn2(model, async () =>
          memorySection(
            {
              state: "on",
              name: "Tiago",
              about: [],
              lately: [],
              related: [memory({ text: "The presentation went badly" })],
            },
            "UTC",
          ),
        ),
      ),
    );
    expect(out.text).toContain("Tiago, it is good to hear from you.");
    expect(out.text).toContain("You mentioned this before: The presentation went badly.");
  });

  it("says the memory is off when asked to remember without one", async () => {
    const model = rehearsalModel();
    const out = await collect(
      runCaptureTurn({
        ...turn2(model, async () => memorySection({ state: "off" }, "UTC")),
        message: user("Do you remember what I told you last week?"),
      }),
    );
    expect(out.text).toContain("sintr's memory is off");
  });

  function turn2(
    model: ReturnType<typeof rehearsalModel>,
    ask: (text: string) => Promise<string>,
  ): CaptureTurn {
    return {
      model,
      history: [],
      message: user("The presentation is tomorrow and I am nervous."),
      person: { language: "en", timezone: "UTC" },
      ports: memoryPorts().ports,
      log: capturedLogger().log,
      memory: ask,
    };
  }
});
