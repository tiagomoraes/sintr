import { addDays, localDay, memoryTransport } from "@sintr/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CRISIS_PROTOCOL } from "../src";
import { call, connect, keyFor, mcpHandler, person, type Person } from "./support";

/**
 * The full path, with a real MCP client from the official SDK talking
 * Streamable HTTP to the handler the web app mounts, in process: make a
 * key, connect, call the tools, and find what was saved in the person's
 * timeline. No network, no model.
 */

const PERSON_SAYS = [
  "Preciso falar do que aconteceu. Na reunião de hoje o Marcos disse na frente de todos que meu relatório estava confuso.",
  "Eu pensei “sou uma fraude” e “todo mundo percebeu”. Senti vergonha, uns 85, e raiva, 40.",
  "Fiquei quieta o resto da reunião e depois chorei no banheiro.",
];

describe("an agent connected over MCP", () => {
  let alice: Person;
  const handler = mcpHandler();
  // The app's email transport is never handed to the MCP server; this one stays empty.
  const email = memoryTransport();

  beforeAll(async () => {
    alice = await person("alice");
    // Weekly, from three days from now, at 19:00 where Alice is.
    await alice.scope.sessions.add({
      startsOn: addDays(localDay(new Date(), "America/Sao_Paulo"), 3),
      time: "19:00",
      repeat: "weekly",
    });
    await alice.scope.therapyNotes.create({ kind: "to_bring", body: "a reunião com o Marcos" });
  });

  afterAll(() => {
    expect(email.sent).toEqual([]);
  });

  it("is told the capture behaviour and the crisis protocol, and sees the six tools", async () => {
    const { token } = await keyFor(alice.scope);
    const client = await connect(handler, token);
    const instructions = client.getInstructions() ?? "";
    expect(instructions).toContain(CRISIS_PROTOCOL);
    expect(instructions).toMatch(/stop the diary at once/);
    expect(instructions).toMatch(/CVV on 188/);
    expect(instructions).toMatch(/SAMU on 192/);
    expect(instructions).toMatch(/Acknowledge first/);
    expect(instructions).toMatch(/Ask narrowly/);
    expect(instructions).toMatch(/exact words/);
    expect(instructions).toMatch(/Never diagnose/);
    expect(instructions).toMatch(/Nothing is sent to the therapist from here/);
    expect(client.getServerVersion()?.name).toBe("sintr");

    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "prepare_report",
      "read_entry",
      "recent_context",
      "save_checkin",
      "save_entry",
      "therapy_overview",
    ]);
    const save = tools.find((tool) => tool.name === "save_entry")!;
    expect(save.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    });
    expect(save.inputSchema.required).toEqual(expect.arrayContaining(["personWords", "personConfirmed"]));
    expect(tools.find((tool) => tool.name === "prepare_report")?.annotations?.readOnlyHint).toBe(true);
    await client.close();
  });

  it("saves an entry and a check-in that appear in the timeline, and reads them back", async () => {
    const { token } = await keyFor(alice.scope);
    const client = await connect(handler, token);

    const entry = await call<{ saved: boolean; entry: { id: string; link: string } }>(client, "save_entry", {
      title: "A reunião com o Marcos",
      situation: "Na reunião o Marcos disse na frente de todos que o relatório estava confuso.",
      thoughts: ["sou uma fraude", "todo mundo percebeu"],
      emotions: [
        { name: "vergonha", intensity: 85 },
        { name: "raiva", intensity: 40 },
      ],
      behavior: "Fiquei quieta o resto da reunião e depois chorei no banheiro.",
      tags: ["work"],
      personWords: PERSON_SAYS,
      personConfirmed: true,
    });
    expect(entry.isError).toBe(false);
    expect(entry.body.saved).toBe(true);

    // The timeline is the entries list the app shows, newest first.
    const timeline = await alice.scope.entries.list();
    expect(timeline[0]?.id).toBe(entry.body.entry.id);
    expect(timeline[0]?.thoughts).toEqual(["sou uma fraude", "todo mundo percebeu"]);
    expect(timeline[0]?.emotions).toEqual([
      { name: "vergonha", intensity: 85 },
      { name: "raiva", intensity: 40 },
    ]);

    const checkin = await call<{ saved: boolean; checkin: { id: string } }>(client, "save_checkin", {
      mood: 2,
      anxiety: 4,
      note: "dia pesado depois da reunião",
      personWords: ["humor 2, ansiedade 4. dia pesado depois da reunião"],
      personConfirmed: true,
    });
    expect(checkin.body.saved).toBe(true);
    expect((await alice.scope.checkins.list())[0]?.id).toBe(checkin.body.checkin.id);

    const recent = await call<{ entries: { id: string; title: string }[]; checkins: { mood: number }[] }>(
      client,
      "recent_context",
    );
    expect(recent.body.entries[0]).toMatchObject({
      id: entry.body.entry.id,
      title: "A reunião com o Marcos",
    });
    expect(recent.body.checkins[0]?.mood).toBe(2);

    const read = await call<{ thoughts: string[]; behavior: string }>(client, "read_entry", {
      id: entry.body.entry.id,
    });
    expect(read.body.thoughts).toEqual(["sou uma fraude", "todo mundo percebeu"]);

    const overview = await call<{ toBringUp: { body: string }[] }>(client, "therapy_overview");
    expect(overview.body.toBringUp.map((note) => note.body)).toEqual(["a reunião com o Marcos"]);

    const prep = await call<{
      sendsNothing: string;
      entries: { id: string }[];
      numbers: { anxiety: { average: number } };
    }>(client, "prepare_report");
    expect(prep.body.sendsNothing).toMatch(/Nothing is sent/);
    expect(prep.body.entries.map((e) => e.id)).toContain(entry.body.entry.id);
    expect(prep.body.numbers.anxiety.average).toBe(4);
    expect(await alice.scope.reports.list()).toEqual([]);
    await client.close();
  });

  it("refuses a draft that is not in the person's words, so the agent can fix it", async () => {
    const { token } = await keyFor(alice.scope);
    const client = await connect(handler, token);
    const before = await alice.scope.entries.count();
    const refused = await call<{ saved: boolean; refused: boolean; problems: string[] }>(
      client,
      "save_entry",
      {
        thoughts: ["I am a fraud"],
        emotions: [{ name: "shame", intensity: 85 }],
        personWords: PERSON_SAYS,
        personConfirmed: true,
      },
    );
    expect(refused.isError).toBe(true);
    expect(refused.body).toMatchObject({ saved: false, refused: true });
    expect(refused.body.problems).toEqual([
      "thoughts[0] is not in the person's words: copy it exactly as they wrote it",
      "emotions[0].name is not a word the person used: use their own word for the emotion, or ask them",
    ]);
    expect(await alice.scope.entries.count()).toBe(before);
    await client.close();
  });

  it("answers a crisis message per the protocol in the instructions, and saves nothing", async () => {
    const { token } = await keyFor(alice.scope);
    const client = await connect(handler, token);
    const before = await alice.scope.entries.count();
    const answer = await call<{
      saved: boolean;
      crisis: boolean;
      stopTheDiary: string;
      message: string;
      lines: { name: string; number: string }[];
    }>(client, "save_entry", {
      notes: "eu penso em me matar",
      personWords: ["não sei mais o que fazer, eu penso em me matar"],
      personConfirmed: true,
    });
    expect(answer.isError).toBe(false);
    expect(answer.body.saved).toBe(false);
    expect(answer.body.crisis).toBe(true);
    // The same protocol the instructions describe: stop, then CVV 188 and SAMU 192, in the person's language.
    expect(answer.body.stopTheDiary).toMatch(/Stop the diary now/);
    expect(answer.body.message).toMatch(/Vou parar o diário aqui/);
    expect(answer.body.message).toMatch(/188/);
    expect(answer.body.message).toMatch(/192/);
    expect(answer.body.lines).toEqual([
      expect.objectContaining({ name: "CVV", number: "188" }),
      expect.objectContaining({ name: "SAMU", number: "192" }),
    ]);
    expect(client.getInstructions()).toMatch(/give them that message .* and stop the diary/);
    expect(await alice.scope.entries.count()).toBe(before);
    await client.close();
  });

  it("lists only what a read-only key may do, and refuses the rest", async () => {
    const { token } = await keyFor(alice.scope, "read");
    const client = await connect(handler, token);
    expect(client.getInstructions()).toMatch(/cannot save anything/);
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "prepare_report",
      "read_entry",
      "recent_context",
      "therapy_overview",
    ]);
    const before = await alice.scope.entries.count();
    const attempt = await client.callTool({
      name: "save_entry",
      arguments: { notes: "x", personWords: ["x"], personConfirmed: true },
    });
    expect(attempt.isError).toBe(true);
    expect(await alice.scope.entries.count()).toBe(before);
    await client.close();
  });

  it("lets a save-only key record without reading the diary back", async () => {
    const { token } = await keyFor(alice.scope, "write");
    const client = await connect(handler, token);
    expect((await client.listTools()).tools.map((tool) => tool.name).sort()).toEqual([
      "save_checkin",
      "save_entry",
    ]);
    const saved = await call<{ saved: boolean }>(client, "save_checkin", {
      sleepHours: 7,
      personWords: ["dormi 7 horas"],
      personConfirmed: true,
    });
    expect(saved.body.saved).toBe(true);
    await client.close();
  });

  it("works with the key in the address, and stops working the moment it is revoked", async () => {
    const { token, id } = await keyFor(alice.scope);
    const client = await connect(handler, token, { viaUrl: true, name: "openai-mcp" });
    expect((await call<{ days: number }>(client, "recent_context")).body.days).toBe(7);
    expect((await alice.scope.apiTokens.get(id))?.lastClient).toBe("openai-mcp");

    await alice.scope.apiTokens.revoke(id);
    await expect(client.callTool({ name: "recent_context", arguments: {} })).rejects.toThrow(
      /wrong, revoked or expired/,
    );
    await client.close();
  });

  it("keeps one person's key away from another person's diary", async () => {
    const bob = await person("bob");
    const { token } = await keyFor(bob.scope);
    const client = await connect(handler, token);
    const aliceEntry = (await alice.scope.entries.list())[0]!;
    const read = await call<{ refused: boolean; problems: string[] }>(client, "read_entry", {
      id: aliceEntry.id,
    });
    expect(read.isError).toBe(true);
    expect(read.body.problems[0]).toMatch(/entry not found/);
    const recent = await call<{ entries: unknown[] }>(client, "recent_context");
    expect(recent.body.entries).toEqual([]);
    expect(JSON.stringify(await call(client, "prepare_report"))).not.toContain("Marcos");
    await client.close();
  });
});
