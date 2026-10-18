import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { bridgeSetup, runBridge, type BridgeConfig } from "../src/stdio";
import { APP_URL, INITIALIZE, keyFor, mcpHandler, person } from "./support";

/**
 * The stdio bridge: its settings, and a whole exchange through it with
 * in-memory pipes for stdin and stdout and the handler for HTTP.
 */

const noFiles = { read: () => null, mode: () => null };

function files(content: Record<string, string>, mode = 0o100600) {
  return {
    read: (path: string) => content[path] ?? null,
    mode: (path: string) => (path in content ? mode : null),
  };
}

describe("the bridge's settings", () => {
  it("come from the environment, and build the endpoint", () => {
    const setup = bridgeSetup({ SINTR_URL: "https://diary.example.com/", SINTR_TOKEN: "sintr_abc" }, noFiles);
    expect(setup).toEqual({
      ok: true,
      config: { endpoint: new URL("https://diary.example.com/mcp"), token: "sintr_abc" },
      warnings: [],
    });
    const already = bridgeSetup(
      { SINTR_URL: "https://diary.example.com/mcp", SINTR_TOKEN: "sintr_abc" },
      noFiles,
    );
    expect(already.ok && already.config.endpoint.toString()).toBe("https://diary.example.com/mcp");
    const sub = bridgeSetup({ SINTR_URL: "https://example.com/sintr", SINTR_TOKEN: "sintr_abc" }, noFiles);
    expect(sub.ok && sub.config.endpoint.toString()).toBe("https://example.com/sintr/mcp");
  });

  it("come from a file when the environment has none, with a warning when others can read it", () => {
    const path = "/home/person/.config/sintr/mcp.json";
    const content = { [path]: JSON.stringify({ url: "https://diary.example.com", token: "sintr_fromfile" }) };
    const setup = bridgeSetup(
      { HOME: "/home/person", XDG_CONFIG_HOME: "/home/person/.config" },
      files(content),
    );
    expect(setup.ok && setup.config.token).toBe("sintr_fromfile");
    expect(setup.ok && setup.warnings).toEqual([]);
    const open = bridgeSetup({ XDG_CONFIG_HOME: "/home/person/.config" }, files(content, 0o100644));
    if (process.platform !== "win32") expect(open.ok && open.warnings[0]).toMatch(/chmod 600/);
    const named = bridgeSetup({ SINTR_MCP_CONFIG: "/nowhere.json" }, noFiles);
    expect(named).toEqual({ ok: false, problem: "cannot read /nowhere.json" });
  });

  it("refuse to send the key in the clear to another machine, and never repeat it", () => {
    const remote = bridgeSetup(
      { SINTR_URL: "http://diary.example.com", SINTR_TOKEN: "sintr_secret" },
      noFiles,
    );
    expect(remote.ok).toBe(false);
    expect(JSON.stringify(remote)).not.toContain("sintr_secret");
    expect(bridgeSetup({ SINTR_URL: "http://localhost:3000", SINTR_TOKEN: "sintr_x" }, noFiles).ok).toBe(
      true,
    );
    expect(bridgeSetup({ SINTR_URL: "http://127.0.0.1:3000", SINTR_TOKEN: "sintr_x" }, noFiles).ok).toBe(
      true,
    );
    expect(
      bridgeSetup({ SINTR_URL: "http://192.168.1.5", SINTR_TOKEN: "sintr_x", SINTR_ALLOW_HTTP: "1" }, noFiles)
        .ok,
    ).toBe(true);
    expect(bridgeSetup({ SINTR_URL: "ftp://x", SINTR_TOKEN: "sintr_x" }, noFiles).ok).toBe(false);
    expect(bridgeSetup({ SINTR_URL: "https://u:p@x.example", SINTR_TOKEN: "sintr_x" }, noFiles).ok).toBe(
      false,
    );
    expect(bridgeSetup({ SINTR_URL: "https://x.example", SINTR_TOKEN: "not-a-key" }, noFiles)).toEqual({
      ok: false,
      problem: "SINTR_TOKEN does not look like a sintr key",
    });
    expect(bridgeSetup({ SINTR_TOKEN: "sintr_x" }, noFiles)).toMatchObject({ ok: false });
  });
});

/** Run the bridge on pipes; returns a way to send a message and wait for the answer with its id. */
function pipes(config: BridgeConfig, handler = mcpHandler()) {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const answers = new Map<number, unknown>();
  const waiting = new Map<number, (value: unknown) => void>();
  let buffer = "";
  stdout.on("data", (chunk: Buffer) => {
    buffer += chunk.toString("utf8");
    for (let at = buffer.indexOf("\n"); at >= 0; at = buffer.indexOf("\n")) {
      const line = buffer.slice(0, at);
      buffer = buffer.slice(at + 1);
      const message = JSON.parse(line) as { id?: number };
      if (typeof message.id !== "number") continue;
      answers.set(message.id, message);
      waiting.get(message.id)?.(message);
    }
  });
  const running = runBridge(config, {
    stdin,
    stdout,
    fetch: (url, init) => handler(new Request(url, init)),
  });
  return {
    running,
    send(message: { id?: number } & Record<string, unknown>): Promise<unknown> {
      stdin.write(`${JSON.stringify(message)}\n`);
      if (typeof message.id !== "number") return Promise.resolve(null);
      const id = message.id;
      return answers.has(id)
        ? Promise.resolve(answers.get(id))
        : new Promise((resolve) => waiting.set(id, resolve));
    },
    end() {
      stdin.end();
    },
  };
}

describe("the bridge", () => {
  it("carries a whole exchange to sintr and back, with the key on every request", async () => {
    const alice = await person("alice");
    const { token, id } = await keyFor(alice.scope);
    const bridge = pipes({ endpoint: new URL("/mcp", APP_URL), token });

    const initialized = (await bridge.send(INITIALIZE)) as { result: { serverInfo: { name: string } } };
    expect(initialized.result.serverInfo.name).toBe("sintr");
    await bridge.send({ jsonrpc: "2.0", method: "notifications/initialized" });
    const saved = (await bridge.send({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "save_checkin",
        arguments: { mood: 4, personWords: ["humor 4 hoje"], personConfirmed: true },
      },
    })) as { result: { content: { text: string }[] } };
    expect(JSON.parse(saved.result.content[0]!.text)).toMatchObject({ saved: true, checkin: { mood: 4 } });
    expect((await alice.scope.checkins.list())[0]?.mood).toBe(4);
    expect((await alice.scope.apiTokens.get(id))?.lastClient).toBe("claude-ai");

    bridge.end();
    await bridge.running;
  });

  it("answers the client when sintr refuses, instead of leaving it waiting", async () => {
    const bridge = pipes({ endpoint: new URL("/mcp", APP_URL), token: "sintr_not_a_real_key" });
    const refused = (await bridge.send(INITIALIZE)) as { error: { message: string } };
    expect(refused.error.message).toMatch(/does not work: it is wrong, revoked or expired/);
    expect(refused.error.message).not.toContain("sintr_not_a_real_key");
    bridge.end();
    await bridge.running;
  });
});
