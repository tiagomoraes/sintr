import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { handle, INITIALIZE, keyFor, logged, mcpHandler, mcpRequest, person, type Person } from "./support";

/**
 * The HTTP gate in front of the tools: the token is the only credential,
 * only POST is answered, browsers on other origins are refused, and the
 * limits hold. Raw requests, as an MCP client would send them.
 */

interface RpcAnswer {
  result?: { instructions?: string; serverInfo?: { name: string } };
  error?: { message: string };
}

async function json(response: Response): Promise<RpcAnswer> {
  return (await response.json()) as RpcAnswer;
}

describe("the MCP endpoint", () => {
  let alice: Person;
  let key: { token: string; id: string };

  beforeAll(async () => {
    alice = await person("alice");
    key = await keyFor(alice.scope);
  });

  it("answers an initialize with the key as a bearer header", async () => {
    const response = await mcpHandler()(mcpRequest(INITIALIZE, { token: key.token }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(response.headers.get("mcp-session-id")).toBeNull();
    const body = await json(response);
    expect(body.result?.serverInfo?.name).toBe("sintr");
    expect(body.result?.instructions).toMatch(/CVV on 188/);
  });

  it("records when the key was used, and the name the client gave", async () => {
    await mcpHandler()(mcpRequest(INITIALIZE, { token: key.token }));
    const token = await alice.scope.apiTokens.get(key.id);
    expect(token?.lastUsedAt?.getTime()).toBeGreaterThan(Date.now() - 60_000);
    expect(token?.lastClient).toBe("claude-ai");

    // A name is kept only as plain letters, digits and a few marks.
    const odd = {
      ...INITIALIZE,
      params: { ...INITIALIZE.params, clientInfo: { name: "<b>evil</b>\n", version: "1" } },
    };
    await mcpHandler()(mcpRequest(odd, { token: key.token }));
    expect((await alice.scope.apiTokens.get(key.id))?.lastClient).toBe("bevil/b");
  });

  it("accepts the key as the last part of the address, for clients that take only a URL", async () => {
    const response = await mcpHandler()(mcpRequest(INITIALIZE, { path: `/mcp/${key.token}` }), key.token);
    expect(response.status).toBe(200);
    // Two different keys in one request are refused.
    const other = await keyFor(alice.scope);
    const mixed = await mcpHandler()(mcpRequest(INITIALIZE, { token: other.token }), key.token);
    expect(mixed.status).toBe(400);
  });

  it("refuses a request without a key, with a wrong, revoked or expired one, or with a cookie only", async () => {
    const handler = mcpHandler();
    const none = await handler(mcpRequest(INITIALIZE));
    expect(none.status).toBe(401);
    expect(none.headers.get("www-authenticate")).toBe('Bearer realm="sintr"');
    expect((await handler(mcpRequest(INITIALIZE, { token: `${key.token}x` }))).status).toBe(401);
    expect((await handler(mcpRequest(INITIALIZE, { token: "not-a-sintr-key" }))).status).toBe(401);
    expect((await handler(mcpRequest(INITIALIZE, { headers: { Authorization: "Basic abc" } }))).status).toBe(
      401,
    );
    // Cookies are never read here: a signed-in browser is not a key.
    const cookie = await handler(mcpRequest(INITIALIZE, { headers: { Cookie: "sintr.session_token=abc" } }));
    expect(cookie.status).toBe(401);

    const revoked = await keyFor(alice.scope);
    await alice.scope.apiTokens.revoke(revoked.id);
    const afterRevoke = await handler(mcpRequest(INITIALIZE, { token: revoked.token }));
    expect(afterRevoke.status).toBe(401);
    expect((await json(afterRevoke)).error?.message).toMatch(/wrong, revoked or expired/);

    const { token: expired } = await alice.scope.apiTokens.create({
      name: "old",
      scopes: ["entries:read"],
      expiresAt: new Date(Date.now() - 1000),
    });
    expect((await handler(mcpRequest(INITIALIZE, { token: expired }))).status).toBe(401);
  });

  it("answers POST only: no stream, no session to end", async () => {
    const handler = mcpHandler();
    const get = await handler(mcpRequest(null, { token: key.token, method: "GET" }));
    expect(get.status).toBe(405);
    expect(get.headers.get("allow")).toBe("POST");
    expect((await handler(mcpRequest(null, { token: key.token, method: "DELETE" }))).status).toBe(405);
    expect((await handler(mcpRequest(null, { token: key.token, method: "OPTIONS" }))).status).toBe(405);
  });

  it("refuses a browser on another origin, and accepts the app's own", async () => {
    const handler = mcpHandler();
    const foreign = await handler(
      mcpRequest(INITIALIZE, { token: key.token, headers: { Origin: "https://evil.example" } }),
    );
    expect(foreign.status).toBe(403);
    const own = await handler(
      mcpRequest(INITIALIZE, { token: key.token, headers: { Origin: "https://diary.example.test" } }),
    );
    expect(own.status).toBe(200);
  });

  it("refuses a person whose consent is missing or out of date", async () => {
    const bob = await person("bob", { consent: false });
    const bobKey = await keyFor(bob.scope);
    const missing = await mcpHandler()(mcpRequest(INITIALIZE, { token: bobKey.token }));
    expect(missing.status).toBe(403);
    expect((await json(missing)).error?.message).toMatch(/accept the current consent/);

    await bob.scope.consents.record({
      purpose: "health_data_processing",
      version: "2000-01-01",
      granted: true,
    });
    expect((await mcpHandler()(mcpRequest(INITIALIZE, { token: bobKey.token }))).status).toBe(403);
  });

  it("limits wrong keys per address, without locking out a working key from the same address", async () => {
    const strict = mcpHandler({ limits: { failuresPerMinute: 3, callsPerMinute: 50 } });
    const from = (address: string) => ({ "X-Forwarded-For": address });
    const shared = from("203.0.113.9");
    for (let i = 0; i < 3; i += 1) {
      expect((await strict(mcpRequest(INITIALIZE, { token: "sintr_wrong", headers: shared }))).status).toBe(
        401,
      );
    }
    const blocked = await strict(mcpRequest(INITIALIZE, { token: "sintr_wrong", headers: shared }));
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await strict(mcpRequest(INITIALIZE, { headers: shared }))).status).toBe(429);
    // A vendor's servers, or a proxy, send many people's keys from one address: a working one still goes on.
    expect((await strict(mcpRequest(INITIALIZE, { token: key.token, headers: shared }))).status).toBe(200);
    // Another address is not touched by the first one's mistakes.
    expect(
      (await strict(mcpRequest(INITIALIZE, { token: "sintr_wrong", headers: from("203.0.113.10") }))).status,
    ).toBe(401);
  });

  it("limits calls per key, counting every message of a batch, and the size of a request", async () => {
    const strict = mcpHandler({ limits: { callsPerMinute: 3, maxBodyBytes: 2_000 } });
    const counted = await keyFor(alice.scope);
    expect((await strict(mcpRequest(INITIALIZE, { token: counted.token }))).status).toBe(200);
    const list = (id: number) => ({ jsonrpc: "2.0", id, method: "tools/list" });
    const batch = await strict(
      mcpRequest([list(2), list(3), list(4)], {
        token: counted.token,
        headers: { "mcp-protocol-version": "2025-06-18" },
      }),
    );
    expect(batch.status).toBe(429);

    const big = { ...INITIALIZE, params: { ...INITIALIZE.params, padding: "x".repeat(3_000) } };
    const other = await keyFor(alice.scope);
    expect((await strict(mcpRequest(big, { token: other.token }))).status).toBe(413);
    const broken = new Request("https://diary.example.test/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${other.token}` },
      body: "{not json",
    });
    expect((await strict(broken)).status).toBe(400);
  });

  it("never writes a key or a word into the logs", async () => {
    const before = logged.length;
    const handler = mcpHandler();
    await handler(mcpRequest(INITIALIZE, { token: key.token }));
    await handler(
      mcpRequest(
        {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            name: "save_checkin",
            arguments: {
              note: "palavras secretas",
              personWords: ["palavras secretas"],
              personConfirmed: true,
            },
          },
        },
        { token: key.token, headers: { "mcp-protocol-version": "2025-06-18" } },
      ),
    );
    await handler(mcpRequest(INITIALIZE, { token: "sintr_wrong_key_value" }));
    const lines = logged.slice(before).join("\n");
    expect(lines).toContain("mcp.request");
    expect(lines).toContain("mcp.tool");
    expect(lines).not.toContain(key.token);
    expect(lines).not.toContain("sintr_wrong_key_value");
    expect(lines).not.toContain("palavras secretas");
  });

  it("stores only a hash of the key", async () => {
    const rows = await handle.db.execute<{ token_hash: string; token_prefix: string }>(
      sql`select token_hash, token_prefix from api_tokens where id = ${key.id}`,
    );
    const row = rows[0]!;
    expect(row.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.token_hash).not.toContain(key.token);
    expect(key.token.startsWith(row.token_prefix)).toBe(true);
    expect(row.token_prefix.length).toBeLessThan(15);
  });
});
