import { APICallError, type LanguageModel } from "ai";
import { describe, expect, it } from "vitest";
import { runCaptureTurn, type CaptureTurn } from "../src/driver";
import type { SintrUIMessage } from "../src/shapes";
import { rehearsalModel, scriptedModel, type ScriptedReply } from "../src/testing";
import {
  assistant,
  capturedLogger,
  collect,
  instructionsOf,
  memoryPorts,
  toolNamesOf,
  toolResultsOf,
  user,
} from "./support";

const PERSON = { language: "pt-BR", timezone: "America/Sao_Paulo" };
const NOW = new Date("2026-10-18T21:30:00Z");

const SITUATION = "Na reunião de segunda meu chefe perguntou do prazo na frente de todo mundo.";
const THOUGHT_TURN = "Pensei: vou decepcionar todo mundo. Senti ansiedade, uns 80, e vergonha 60.";

interface TurnSetup {
  model: LanguageModel;
  history?: SintrUIMessage[];
  message?: SintrUIMessage;
}

function turn(setup: TurnSetup) {
  const memory = memoryPorts();
  const logger = capturedLogger();
  const responses: SintrUIMessage[] = [];
  const base: CaptureTurn = {
    model: setup.model,
    history: setup.history ?? [],
    person: PERSON,
    ports: memory.ports,
    log: logger.log,
    now: NOW,
    onResponse: (message) => {
      responses.push(message);
    },
  };
  if (setup.message) base.message = setup.message;
  return { base, memory, logger, responses, run: () => collect(runCaptureTurn(base)) };
}

const proposeEntry = (input: unknown): ScriptedReply => ({
  toolCalls: [{ toolName: "propose_entry", input }],
});

describe("the capture flow", () => {
  it("acknowledges and asks narrowly, with the capture rules and the tools, and saves nothing", async () => {
    const model = scriptedModel([
      { text: "Que situação difícil. O que passou pela sua cabeça naquela hora?" },
    ]);
    const t = turn({ model, message: user(SITUATION) });
    const out = await t.run();

    expect(out.text).toBe("Que situação difícil. O que passou pela sua cabeça naquela hora?");
    expect(model.calls).toHaveLength(1);
    expect(toolNamesOf(model.calls[0]!)).toEqual([
      "propose_checkin",
      "propose_entry",
      "recent_context",
      "signal_crisis",
    ]);
    const instructions = instructionsOf(model.calls[0]!);
    expect(instructions).toContain("Acknowledge first");
    expect(instructions).toContain("one or two questions per message at most");
    expect(instructions).toContain("Keep their exact words");
    expect(instructions).toContain("from 0 to 100");
    expect(instructions).toContain("Never translate their words");
    expect(instructions).toContain("America/Sao_Paulo");
    expect(t.memory.proposals.size).toBe(0);
    // The reply is handed back for storage.
    expect(t.responses).toHaveLength(1);
    expect(t.responses[0]!.role).toBe("assistant");
  });

  it("drafts the entry in the person's own words, and the draft is only a proposal", async () => {
    const model = scriptedModel([
      proposeEntry({
        situation: "Reunião de segunda: o chefe perguntou do prazo na frente de todos.",
        thoughts: ["Vou decepcionar todo mundo"],
        emotions: [
          { name: "Ansiedade", intensity: 80 },
          { name: "vergonha", intensity: 60 },
        ],
        tags: ["work"],
      }),
      {
        text: "Está aqui para você conferir. Pode confirmar, mudar o que quiser ou me dizer o que corrigir.",
      },
    ]);
    const t = turn({
      model,
      history: [user(SITUATION), assistant("O que você pensou?")],
      message: user(THOUGHT_TURN),
    });
    const out = await t.run();

    expect(t.memory.proposals.size).toBe(1);
    const [proposal] = [...t.memory.proposals.values()];
    expect(proposal).toMatchObject({ kind: "entry", status: "proposed", recordId: null });
    // Thoughts and emotion names are stored as the person wrote them, not as the model copied them.
    expect(proposal!.payload).toEqual({
      situation: "Reunião de segunda: o chefe perguntou do prazo na frente de todos.",
      thoughts: ["vou decepcionar todo mundo"],
      emotions: [
        { name: "ansiedade", intensity: 80 },
        { name: "vergonha", intensity: 60 },
      ],
      tags: ["work"],
    });
    expect(t.memory.confirmed).toEqual([]);
    const output = out.chunks.find((c) => c.type === "tool-output-available");
    expect(output).toMatchObject({ output: { ok: true, proposalId: "proposal-1" } });
    expect(out.text).toContain("Pode confirmar");
  });

  it("states the tiers: Tier 1 always, Tier 2 only when offered and accepted", async () => {
    const model = scriptedModel([{ text: "..." }]);
    await turn({ model, message: user(SITUATION) }).run();
    const instructions = instructionsOf(model.calls[0]!);
    expect(instructions).toContain("Tier 1, always");
    expect(instructions).toContain("Tier 2, only when you offer it and they accept");
    expect(instructions).toContain("never write it for them");
    expect(instructions).toContain("record Tier 1 and stop");
  });

  it("refuses a Tier 2 alternative thought the person did not find themselves", async () => {
    const model = scriptedModel([
      proposeEntry({
        situation: SITUATION,
        hotThought: "vou decepcionar todo mundo",
        alternative: "atrasar uma entrega não é decepcionar todos",
        alternativeBelief: 55,
      }),
      { text: "Vamos deixar a parte mais profunda para quando você quiser." },
    ]);
    const t = turn({ model, history: [user(SITUATION)], message: user(THOUGHT_TURN) });
    await t.run();
    expect(t.memory.proposals.size).toBe(0);
    const problems = JSON.stringify(toolResultsOf(model.calls[1]!));
    expect(problems).toContain("alternative is not in the person's words");
    expect(problems).toContain("alternativeBelief 55 was never said");
  });
});

describe("never inventing", () => {
  it("refuses an intensity the person never gave, tells the model why, and stores nothing", async () => {
    const model = scriptedModel([
      proposeEntry({ situation: SITUATION, emotions: [{ name: "ansiedade", intensity: 75 }] }),
      { text: "De 0 a 100, quão forte foi a ansiedade?" },
    ]);
    const t = turn({ model, history: [user(SITUATION)], message: user("senti muita ansiedade") });
    const out = await t.run();

    expect(t.memory.proposals.size).toBe(0);
    expect(model.calls).toHaveLength(2);
    expect(JSON.stringify(toolResultsOf(model.calls[1]!))).toContain(
      "emotions[0].intensity 75 was never said by the person",
    );
    expect(out.chunks.find((c) => c.type === "tool-output-available")).toMatchObject({
      output: { ok: false },
    });
    expect(out.text).toBe("De 0 a 100, quão forte foi a ansiedade?");
  });

  it("refuses a paraphrased thought and a translated emotion, then keeps the corrected draft", async () => {
    const model = scriptedModel([
      proposeEntry({
        situation: SITUATION,
        thoughts: ["I will let everyone down"],
        emotions: [{ name: "anxiety", intensity: 80 }],
      }),
      proposeEntry({
        situation: SITUATION,
        thoughts: ["vou decepcionar todo mundo"],
        emotions: [{ name: "ansiedade", intensity: 80 }],
      }),
      { text: "Pronto, o rascunho está aqui." },
    ]);
    const t = turn({ model, history: [user(SITUATION)], message: user(THOUGHT_TURN) });
    await t.run();

    const problems = JSON.stringify(toolResultsOf(model.calls[1]!));
    expect(problems).toContain("thoughts[0] is not in the person's words");
    expect(problems).toContain("emotions[0].name is not a word the person used");
    expect(t.memory.proposals.size).toBe(1);
    expect([...t.memory.proposals.values()][0]!.payload).toMatchObject({
      thoughts: ["vou decepcionar todo mundo"],
      emotions: [{ name: "ansiedade", intensity: 80 }],
    });
  });

  it("leaves out what was not given, instead of filling it in", async () => {
    const model = scriptedModel([
      proposeEntry({ situation: SITUATION, body: "", thoughts: [] }),
      { text: "ok" },
    ]);
    const t = turn({ model, history: [], message: user(SITUATION) });
    await t.run();
    expect([...t.memory.proposals.values()][0]!.payload).toEqual({ situation: SITUATION });
  });

  it("refuses an empty draft", async () => {
    const model = scriptedModel([proposeEntry({ tags: ["work"] }), { text: "ok" }]);
    const t = turn({ model, message: user(SITUATION) });
    await t.run();
    expect(t.memory.proposals.size).toBe(0);
  });
});

describe("the quick check-in", () => {
  it("drafts exactly what was given", async () => {
    const model = scriptedModel([
      {
        toolCalls: [
          { toolName: "propose_checkin", input: { mood: 4, sleepHours: 6.5, note: "acordei bem" } },
        ],
      },
      { text: "Anotei, confira se está certo." },
    ]);
    const t = turn({ model, message: user("humor 4, dormi 6h30, acordei bem") });
    await t.run();
    expect([...t.memory.proposals.values()]).toEqual([
      {
        kind: "checkin",
        payload: { mood: 4, sleepHours: 6.5, note: "acordei bem" },
        status: "proposed",
        recordId: null,
      },
    ]);
  });

  it("refuses a value the person did not give", async () => {
    const model = scriptedModel([
      { toolCalls: [{ toolName: "propose_checkin", input: { mood: 4, energy: 3 } }] },
      { text: "Qual foi sua energia, de 0 a 5?" },
    ]);
    const t = turn({ model, message: user("humor 4 hoje") });
    await t.run();
    expect(t.memory.proposals.size).toBe(0);
    expect(JSON.stringify(toolResultsOf(model.calls[1]!))).toContain("energy 3 was never said");
  });
});

describe("the explicit yes", () => {
  async function withPendingDraft(message: string) {
    const model = scriptedModel([{ text: "Salvo." }]);
    const t = turn({
      model,
      history: [user(SITUATION), assistant("Aqui está o rascunho.")],
      message: user(message),
    });
    const { id } = await t.memory.ports.createProposal({ kind: "entry", payload: { situation: SITUATION } });
    const out = await t.run();
    return { t, out, model, id };
  }

  it('"salva" saves the waiting draft, decided by the driver before the model is called', async () => {
    const { t, out, model, id } = await withPendingDraft("salva");
    expect(t.memory.confirmed).toEqual([id]);
    expect(t.memory.proposals.get(id)).toMatchObject({ status: "saved", recordId: `record-of-${id}` });
    const update = out.chunks.find((c) => c.type === "data-proposal");
    expect(update).toMatchObject({ data: { proposalId: id, status: "saved", recordId: `record-of-${id}` } });
    expect(instructionsOf(model.calls[0]!)).toContain("it is now saved");
  });

  it("a message that also asks for a change is not a yes", async () => {
    const { t, out } = await withPendingDraft("salva, mas muda a ansiedade para 70");
    expect(t.memory.confirmed).toEqual([]);
    expect(out.types).not.toContain("data-proposal");
  });

  it("a plain yes to something else is not a yes either", async () => {
    const { t } = await withPendingDraft("sim");
    expect(t.memory.confirmed).toEqual([]);
  });

  it('"salva" with no draft waiting saves nothing', async () => {
    const model = scriptedModel([{ text: "Ainda não há nada para salvar." }]);
    const t = turn({ model, message: user("salva") });
    await t.run();
    expect(t.memory.confirmed).toEqual([]);
  });

  it("the model is told which drafts were saved, edited or discarded", async () => {
    const model = scriptedModel([{ text: "ok" }]);
    const t = turn({ model, message: user("e agora?") });
    const { id } = await t.memory.ports.createProposal({ kind: "entry", payload: { situation: SITUATION } });
    await t.memory.ports.confirmProposal(id);
    t.base.history = [
      user(SITUATION),
      {
        id: "m2",
        role: "assistant",
        parts: [
          {
            type: "tool-propose_entry",
            toolCallId: "call-9",
            state: "output-available",
            input: { situation: SITUATION },
            output: { ok: true, proposalId: id, draft: { situation: SITUATION } },
          },
        ],
      },
    ];
    await t.run();
    expect(toolResultsOf(model.calls[0]!)).toEqual([
      expect.objectContaining({ ok: true, proposalId: id, status: "saved", editedByPerson: false }),
    ]);
  });
});

describe("the crisis protocol", () => {
  it.each([
    ["quero morrer", "Que bom que você me contou"],
    ["I keep thinking about killing myself", "Thank you for telling me"],
  ])("stops the diary on %j before any model is called, and points to human help", async (text, opening) => {
    const model = scriptedModel([proposeEntry({ situation: text })]);
    const t = turn({ model, history: [user(SITUATION)], message: user(text) });
    const out = await t.run();

    expect(model.calls).toHaveLength(0);
    expect(out.text.startsWith(opening)).toBe(true);
    expect(out.text).toContain("188");
    expect(out.text).toContain("192");
    expect(out.chunks.find((c) => c.type === "data-crisis")).toMatchObject({ data: { source: "screen" } });
    expect(t.memory.proposals.size).toBe(0);
    // The stop is stored with the reply, so the conversation stays stopped.
    expect(t.responses[0]!.parts.some((p) => p.type === "data-crisis")).toBe(true);
  });

  const stopped = [
    user("quero morrer"),
    assistant("Que bom que você me contou...", [
      { type: "data-crisis", id: "crisis", data: { source: "screen" } },
    ]),
  ];

  it("keeps the diary stopped: the next replies have the crisis instructions and no tools", async () => {
    const model = scriptedModel([{ text: "Estou aqui. Por favor, ligue para o CVV no 188." }]);
    const t = turn({ model, history: stopped, message: user("não sei se consigo ligar") });
    const out = await t.run();

    expect(model.calls).toHaveLength(1);
    expect(model.calls[0]!.tools ?? []).toEqual([]);
    expect(instructionsOf(model.calls[0]!)).toContain("the diary is paused");
    expect(instructionsOf(model.calls[0]!)).not.toContain("propose_entry");
    expect(out.text).toBe("Estou aqui. Por favor, ligue para o CVV no 188.");
  });

  it("cannot draft anything while stopped, even if the model tries", async () => {
    const model = scriptedModel([
      { text: "Entendo.", toolCalls: [{ toolName: "propose_entry", input: { situation: "x" } }] },
    ]);
    const t = turn({ model, history: stopped, message: user("estou melhor, quero registrar o dia") });
    await t.run();
    expect(t.memory.proposals.size).toBe(0);
  });

  it("still gives the numbers when the provider fails during a crisis", async () => {
    const model = scriptedModel([{ error: new Error("provider down") }]);
    const t = turn({ model, history: stopped, message: user("estou com medo") });
    const out = await t.run();
    expect(out.types).not.toContain("error");
    expect(out.text).toContain("188");
    expect(out.text).toContain("192");
  });

  it("stops when the model signals a risk the screen did not catch, and withdraws drafts of that turn", async () => {
    const model = scriptedModel([
      {
        toolCalls: [
          { toolName: "propose_entry", input: { situation: SITUATION } },
          { toolName: "signal_crisis", input: { language: "pt-BR" } },
        ],
      },
      { text: "this step must never run" },
    ]);
    const t = turn({ model, history: [user(SITUATION)], message: user("não vejo mais sentido em nada") });
    const out = await t.run();

    expect(model.calls).toHaveLength(1);
    expect(out.text).not.toContain("this step must never run");
    expect(out.text).toContain("Que bom que você me contou");
    expect(out.chunks.find((c) => c.type === "data-crisis")).toMatchObject({ data: { source: "assistant" } });
    expect([...t.memory.proposals.values()].map((p) => p.status)).toEqual(["discarded"]);
  });
});

describe("failures and privacy", () => {
  it("reports a refused key as a code the screen can explain, with no detail", async () => {
    const refused = new APICallError({
      message: "Incorrect API key provided: sk-abc***xyz",
      url: "https://llm.example.test/v1/chat/completions",
      requestBodyValues: { messages: [{ role: "user", content: SITUATION }] },
      statusCode: 401,
      responseBody: '{"error":"Incorrect API key provided: sk-abc***xyz"}',
      isRetryable: false,
    });
    const model = scriptedModel([{ error: refused }]);
    const t = turn({ model, message: user(SITUATION) });
    const out = await t.run();

    expect(out.chunks.find((c) => c.type === "error")).toEqual({ type: "error", errorText: "key_refused" });
    const logged = t.logger.lines.join("\n");
    expect(logged).toContain("agent.model_error");
    expect(logged).not.toContain("sk-abc");
    expect(logged).not.toContain("reunião");
  });

  it("writes no words of the conversation to the logs", async () => {
    const model = scriptedModel([
      proposeEntry({ situation: SITUATION, thoughts: ["vou decepcionar todo mundo"] }),
      { text: "Pronto." },
    ]);
    const t = turn({ model, history: [user(SITUATION)], message: user(THOUGHT_TURN) });
    await t.run();
    const logged = t.logger.lines.join("\n");
    expect(t.logger.lines.length).toBeGreaterThan(0);
    for (const words of ["reunião", "decepcionar", "ansiedade", "Pronto"])
      expect(logged).not.toContain(words);
  });

  it("smooths em dashes out of the assistant's text, not out of the person's words", async () => {
    const dash = "\u2014";
    const model = scriptedModel([
      proposeEntry({ situation: `o prazo ${dash} de novo`, thoughts: [`isso ${dash} de novo`] }),
      { text: `Entendi ${dash} obrigado por contar.` },
    ]);
    const t = turn({
      model,
      history: [user(`isso ${dash} de novo, o prazo ${dash} de novo`)],
      message: user("sim"),
    });
    const out = await t.run();
    expect(out.text).toBe("Entendi, obrigado por contar.");
    expect([...t.memory.proposals.values()][0]!.payload).toMatchObject({
      thoughts: [`isso ${dash} de novo`],
    });
  });
});

describe("the rehearsal assistant (the offline provider of the end-to-end tests)", () => {
  it("asks one question, then drafts the entry from the person's own sentences through the same checks", async () => {
    const first = turn({
      model: rehearsalModel(),
      message: user("The meeting on Monday, when my manager asked about the deadline."),
    });
    const opening = await first.run();
    expect(opening.text).toContain("What went through your mind right then");
    expect(first.memory.proposals.size).toBe(0);

    const history = [
      user("The meeting on Monday, when my manager asked about the deadline."),
      assistant(opening.text),
    ];
    const second = turn({
      model: rehearsalModel(),
      history,
      message: user("I thought: I am going to let everyone down. Anxiety 80, shame 60."),
    });
    const drafted = await second.run();
    expect([...second.memory.proposals.values()][0]!.payload).toEqual({
      situation: "The meeting on Monday, when my manager asked about the deadline.",
      thoughts: ["I am going to let everyone down"],
      emotions: [
        { name: "Anxiety", intensity: 80 },
        { name: "shame", intensity: 60 },
      ],
    });
    expect(drafted.text).toContain("You can confirm it, change anything");
  });

  it("drafts a check-in from a check-in message", async () => {
    const t = turn({ model: rehearsalModel(), message: user("mood 4, energy 3, slept 7.5") });
    await t.run();
    expect([...t.memory.proposals.values()][0]).toMatchObject({
      kind: "checkin",
      payload: { mood: 4, energy: 3, sleepHours: 7.5 },
    });
  });
});
