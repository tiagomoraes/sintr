/**
 * The stdio bridge, for clients that start MCP servers as local programs
 * (Claude Desktop, Claude Code, Gemini CLI, Hermes). It forwards each MCP
 * message from stdin to the sintr it is pointed at, over HTTPS with the
 * person's key, and each answer back to stdout. It holds no data and
 * reads no diary: the server does all the work, and checks the key on
 * every message.
 *
 * Configuration, from the environment first, then a file:
 * - SINTR_URL: the address of sintr, such as https://diary.example.com
 * - SINTR_TOKEN: the connection key made in sintr (Connect)
 * - SINTR_MCP_CONFIG: a JSON file with { "url": ..., "token": ... };
 *   by default ~/.config/sintr/mcp.json (or $XDG_CONFIG_HOME/sintr/mcp.json)
 * - SINTR_ALLOW_HTTP=1 lets the key travel over plain http to a host other
 *   than this machine; never do this across a network you do not control.
 *
 * stdout carries MCP messages only; anything for a person goes to stderr.
 * This file imports nothing from the rest of sintr, so it bundles into one
 * small script (`make build` writes dist/sintr-mcp.mjs).
 */
import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Readable, Writable } from "node:stream";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { FetchLike } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage, RequestId } from "@modelcontextprotocol/sdk/types.js";

export interface BridgeConfig {
  /** The MCP endpoint: the sintr address followed by /mcp. */
  endpoint: URL;
  token: string;
}

export type BridgeSetup =
  { ok: true; config: BridgeConfig; warnings: string[] } | { ok: false; problem: string };

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function defaultConfigPath(env: NodeJS.ProcessEnv): string {
  return join(env.XDG_CONFIG_HOME || join(homedir(), ".config"), "sintr", "mcp.json");
}

/** Read the bridge's settings. Never prints the key; problems name settings, not values. */
export function bridgeSetup(
  env: NodeJS.ProcessEnv,
  files: { read(path: string): string | null; mode(path: string): number | null } = {
    read: (path) => {
      try {
        return readFileSync(path, "utf8");
      } catch {
        return null;
      }
    },
    mode: (path) => {
      try {
        return statSync(path).mode;
      } catch {
        return null;
      }
    },
  },
): BridgeSetup {
  const warnings: string[] = [];
  let url = env.SINTR_URL?.trim() || undefined;
  let token = env.SINTR_TOKEN?.trim() || undefined;
  if (!url || !token) {
    const path = env.SINTR_MCP_CONFIG?.trim() || defaultConfigPath(env);
    const text = files.read(path);
    if (text === null && env.SINTR_MCP_CONFIG) return { ok: false, problem: `cannot read ${path}` };
    if (text !== null) {
      let parsed: { url?: unknown; token?: unknown };
      try {
        parsed = JSON.parse(text) as { url?: unknown; token?: unknown };
      } catch {
        return { ok: false, problem: `${path} is not valid JSON` };
      }
      if (!url && typeof parsed.url === "string") url = parsed.url.trim();
      if (!token && typeof parsed.token === "string") token = parsed.token.trim();
      const mode = files.mode(path);
      if (mode !== null && process.platform !== "win32" && (mode & 0o077) !== 0) {
        warnings.push(`${path} can be read by other users of this computer; chmod 600 it`);
      }
    }
  }
  if (!url) return { ok: false, problem: "SINTR_URL is not set (the address of your sintr)" };
  if (!token)
    return { ok: false, problem: "SINTR_TOKEN is not set (the connection key from sintr, Connect)" };
  if (!token.startsWith("sintr_"))
    return { ok: false, problem: "SINTR_TOKEN does not look like a sintr key" };

  let base: URL;
  try {
    base = new URL(url);
  } catch {
    return { ok: false, problem: "SINTR_URL is not an address (write it like https://diary.example.com)" };
  }
  if (base.protocol !== "https:" && base.protocol !== "http:") {
    return { ok: false, problem: "SINTR_URL must start with https://" };
  }
  if (base.protocol === "http:" && !LOOPBACK.has(base.hostname) && env.SINTR_ALLOW_HTTP !== "1") {
    return {
      ok: false,
      problem:
        "SINTR_URL must use https:// unless sintr runs on this computer (the key would travel in the clear)",
    };
  }
  if (base.username || base.password) return { ok: false, problem: "SINTR_URL must not contain a password" };
  const path = base.pathname.replace(/\/+$/u, "");
  const endpoint = new URL(base.origin);
  endpoint.pathname = path.endsWith("/mcp") ? path : `${path}/mcp`;
  return { ok: true, config: { endpoint, token }, warnings };
}

function say(line: string): void {
  process.stderr.write(`sintr: ${line}\n`);
}

/**
 * A failed forward, as the person can read it: sintr's own answer when there
 * is one ("This sintr connection key does not work..."), otherwise what went
 * wrong on the way. Never the key.
 */
function explain(error: unknown, token: string): string {
  const text = (error instanceof Error ? error.message : String(error)).split(token).join("[key]");
  const at = text.indexOf("{");
  if (at >= 0) {
    try {
      const answer = JSON.parse(text.slice(at)) as { error?: { message?: unknown } };
      if (typeof answer.error?.message === "string") return answer.error.message.slice(0, 500);
    } catch {
      // Not sintr's JSON: fall through to the transport's own words.
    }
  }
  return `could not reach sintr: ${text}`.slice(0, 500);
}

export interface BridgeIo {
  stdin: Readable;
  stdout: Writable;
  /** How HTTP requests are made; the global fetch by default (tests pass the handler). */
  fetch?: FetchLike;
}

/** Forward between stdin/stdout and the sintr endpoint until stdin closes. */
export async function runBridge(
  config: BridgeConfig,
  io: BridgeIo = { stdin: process.stdin, stdout: process.stdout },
): Promise<void> {
  const local = new StdioServerTransport(io.stdin, io.stdout);
  const remote = new StreamableHTTPClientTransport(config.endpoint, {
    requestInit: { headers: { Authorization: `Bearer ${config.token}` } },
    ...(io.fetch ? { fetch: io.fetch } : {}),
  });
  let initializeId: RequestId | null = null;

  local.onmessage = (message: JSONRPCMessage) => {
    if ("method" in message && message.method === "initialize" && "id" in message) initializeId = message.id;
    // A failed send is also reported through onerror, which prints it.
    remote.send(message).catch((error: unknown) => {
      const reason = explain(error, config.token);
      // A request must be answered, or the client waits for ever.
      if ("method" in message && "id" in message) {
        void local.send({ jsonrpc: "2.0", id: message.id, error: { code: -32000, message: reason } });
      }
    });
  };
  remote.onmessage = (message: JSONRPCMessage) => {
    if (initializeId !== null && "id" in message && message.id === initializeId && "result" in message) {
      const version = (message.result as { protocolVersion?: unknown }).protocolVersion;
      // Every later request names the protocol version agreed here.
      if (typeof version === "string") remote.setProtocolVersion(version);
      initializeId = null;
    }
    void local.send(message);
  };
  remote.onerror = (error) => say(explain(error, config.token));
  local.onerror = (error) => say(explain(error, config.token));

  await remote.start();
  await new Promise<void>((resolve) => {
    local.onclose = () => resolve();
    io.stdin.once("end", () => resolve());
    void local.start();
  });
  await remote.close();
}

/** The entry point of dist/sintr-mcp.mjs. */
export async function main(): Promise<void> {
  const setup = bridgeSetup(process.env);
  if (!setup.ok) {
    say(setup.problem);
    process.exitCode = 1;
    return;
  }
  for (const warning of setup.warnings) say(warning);
  await runBridge(setup.config);
}
