import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  API_TOKEN_ACCESS,
  HEALTH_DATA_CONSENT_VERSION,
  createLogger,
  generateMasterKey,
  loadConfig,
  type ApiTokenAccess,
  type ApiTokenScope,
  type UserScope,
} from "@sintr/core";
import { authenticateApiToken } from "@sintr/core/auth";
import { createDatabase } from "@sintr/core/db";
import { createBaseRuntime } from "@sintr/core/runtime/base";
import { users } from "@sintr/core/schema";
import { inject } from "vitest";
import { createMcpHandler, type McpHandler, type McpHandlerOptions, type ToolContext } from "../src";

/**
 * The MCP server against a real Postgres (a fresh database per run), with
 * the same core the app runs. HTTP never leaves the process: the client's
 * fetch hands each request straight to the handler.
 */

export const APP_URL = new URL("https://diary.example.test");

export const runtime = createBaseRuntime(
  loadConfig({
    DATABASE_URL: inject("databaseUrl"),
    SINTR_AUTH_SECRET: randomUUID() + randomUUID(),
    SINTR_MASTER_KEY: generateMasterKey(),
    SINTR_LOG_LEVEL: "error",
  }),
  { service: "test", poolSize: 4 },
);
export const handle = createDatabase(inject("databaseUrl"), { max: 2 });

/** Every line the server logged, so a test can check what is, and is not, in them. */
export const logged: string[] = [];
export const log = createLogger({
  level: "debug",
  service: "mcp-test",
  write: (_level, line) => logged.push(line),
});

export interface Person {
  id: string;
  scope: UserScope;
}

/** A person as sign-up leaves them: keys, profile, and (unless told otherwise) the current consent. */
export async function person(
  label: string,
  options: { consent?: boolean; timezone?: string } = {},
): Promise<Person> {
  const id = `${label}-${randomUUID()}`;
  await handle.db.insert(users).values({ id, email: `${id}@example.test` });
  await runtime.repositories.provision(id);
  const scope = await runtime.repositories.forUser(id);
  await scope.profile.update({ timezone: options.timezone ?? "America/Sao_Paulo" });
  if (options.consent !== false) {
    await scope.consents.record({
      purpose: "health_data_processing",
      version: HEALTH_DATA_CONSENT_VERSION,
      granted: true,
    });
  }
  return { id, scope };
}

/** A connection key, made the way the Connect screen makes one. */
export async function keyFor(
  scope: UserScope,
  access: ApiTokenAccess = "read_write",
): Promise<{ token: string; id: string }> {
  const { token, apiToken } = await scope.apiTokens.create({
    name: `${access} key`,
    scopes: [...API_TOKEN_ACCESS[access]],
  });
  return { token, id: apiToken.id };
}

export function mcpHandler(overrides: Partial<McpHandlerOptions> = {}): McpHandler {
  return createMcpHandler({
    authenticate: (token, use) => authenticateApiToken(handle.db, token, use),
    repositories: runtime.repositories,
    appUrl: APP_URL,
    log,
    ...overrides,
  });
}

/** An MCP client connected over Streamable HTTP, in process. */
export async function connect(
  handler: McpHandler,
  token: string,
  options: { viaUrl?: boolean; name?: string } = {},
): Promise<Client> {
  const endpoint = new URL(options.viaUrl ? `/mcp/${token}` : "/mcp", APP_URL);
  const transport = new StreamableHTTPClientTransport(endpoint, {
    ...(options.viaUrl ? {} : { requestInit: { headers: { Authorization: `Bearer ${token}` } } }),
    fetch: (url, init) => handler(new Request(url, init), options.viaUrl ? token : undefined),
  });
  const client = new Client({ name: options.name ?? "sintr-test-client", version: "1.0.0" });
  await client.connect(transport);
  return client;
}

/** Call a tool and read the JSON it answered with. */
export async function call<T = Record<string, unknown>>(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
): Promise<{ isError: boolean; body: T }> {
  const result = await client.callTool({ name, arguments: args });
  const first = (result.content as { type: string; text?: string }[])[0];
  return { isError: result.isError === true, body: JSON.parse(first?.text ?? "null") as T };
}

/** A tool context for one person and one access, for calls without HTTP. */
export function contextFor(
  scope: UserScope,
  access: ApiTokenAccess | readonly ApiTokenScope[] = "read_write",
  now: () => Date = () => new Date(),
): ToolContext {
  const scopes = typeof access === "string" ? API_TOKEN_ACCESS[access] : access;
  return { scope, scopes: new Set(scopes), tokenId: randomUUID(), appUrl: APP_URL, log, now };
}

/** A raw MCP POST, as a client would send it. */
export function mcpRequest(
  body: unknown,
  init: { token?: string; headers?: Record<string, string>; method?: string; path?: string } = {},
): Request {
  const method = init.method ?? "POST";
  return new Request(new URL(init.path ?? "/mcp", APP_URL), {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      ...init.headers,
    },
    ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
  });
}

export const INITIALIZE = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "claude-ai", version: "1.0.0" },
  },
};
