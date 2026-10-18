/**
 * The MCP endpoint over Streamable HTTP, as a function from a web Request to
 * a Response, so the web app can mount it as a route. Stateless: every POST
 * carries its token, is answered with JSON, and leaves nothing behind (no
 * session, no stream). The gate, in order:
 *
 * 1. POST only. A browser on another origin is refused; no CORS headers
 *    are sent, so no page can call this with the person's key.
 * 2. The token: `Authorization: Bearer`, or the last segment of the URL
 *    for clients that take only a URL. It is the only credential: cookies
 *    are never read here.
 * 3. Limits: wrong tokens per address, calls per token, body size.
 * 4. The owner's current consent to process their health data, as every
 *    page and the worker require.
 *
 * The token and the body never reach the logs; a request is logged as its
 * status, token id and duration.
 */
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { HEALTH_DATA_CONSENT_VERSION, type ApiTokenScope, type Logger, type Repositories } from "@sintr/core";
import type { ApiTokenPrincipal } from "@sintr/core/auth";
import { RateLimiter } from "./limits";
import { createSintrServer } from "./server";

export interface McpHandlerOptions {
  /** Resolve a token to its owner; `client` is the name a client gives at `initialize`. */
  authenticate(token: string, use: { client: string | null }): Promise<ApiTokenPrincipal | null>;
  repositories: Pick<Repositories, "forUser">;
  /** The app's public address: links in results, and the one origin a browser may call from. */
  appUrl: URL;
  log: Logger;
  now?: () => Date;
  limits?: Partial<McpLimits>;
}

export interface McpLimits {
  /** Calls per token per minute. */
  callsPerMinute: number;
  /** Wrong or missing tokens per address per minute. */
  failuresPerMinute: number;
  /** Largest request body, in bytes. */
  maxBodyBytes: number;
}

export const DEFAULT_LIMITS: McpLimits = {
  callsPerMinute: 120,
  failuresPerMinute: 20,
  maxBodyBytes: 1_000_000,
};

const MINUTE = 60_000;
const BEARER = /^Bearer\s+(\S+)\s*$/i;

/** A JSON-RPC error with no id: what MCP clients show when a request is refused. */
function refuse(status: number, message: string, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", error: { code: -32001, message }, id: null }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
  });
}

/** The address a request came from, as the proxy in front of the app reports it. */
function addressOf(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",").at(-1)?.trim() || request.headers.get("x-real-ip") || "direct";
}

type Body = { ok: true; value: unknown } | { ok: false; response: Response };

async function readBody(request: Request, maxBytes: number): Promise<Body> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) return { ok: false, response: refuse(413, "The request is too large.") };
  const reader = (request.body as ReadableStream<Uint8Array> | null)?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return { ok: false, response: refuse(413, "The request is too large.") };
      }
      chunks.push(value);
    }
  }
  try {
    return { ok: true, value: JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown };
  } catch {
    return { ok: false, response: refuse(400, "The request is not valid JSON.") };
  }
}

/** The name a client gives for itself at `initialize`, if this is one. */
function clientOf(body: unknown): string | null {
  const messages = Array.isArray(body) ? body : [body];
  for (const message of messages) {
    if (message && typeof message === "object" && (message as { method?: unknown }).method === "initialize") {
      const name = (message as { params?: { clientInfo?: { name?: unknown } } }).params?.clientInfo?.name;
      return typeof name === "string" ? name : null;
    }
  }
  return null;
}

export type McpHandler = (request: Request, urlToken?: string) => Promise<Response>;

export function createMcpHandler(options: McpHandlerOptions): McpHandler {
  const limits = { ...DEFAULT_LIMITS, ...options.limits };
  const calls = new RateLimiter(limits.callsPerMinute, MINUTE);
  const failures = new RateLimiter(limits.failuresPerMinute, MINUTE);
  const now = options.now ?? (() => new Date());
  const { log, appUrl } = options;

  async function handle(
    request: Request,
    urlToken: string | undefined,
  ): Promise<{ response: Response; tokenId?: string }> {
    if (request.method !== "POST") {
      // No session and no server-initiated stream: every answer comes back on its POST.
      return { response: refuse(405, "sintr answers MCP requests over POST.", { Allow: "POST" }) };
    }
    const origin = request.headers.get("origin");
    if (origin !== null && origin !== appUrl.origin) {
      return { response: refuse(403, "Requests from a web page are not accepted.") };
    }

    const address = addressOf(request);
    const wait = failures.waitFor(address);
    if (wait > 0)
      return {
        response: refuse(429, "Too many wrong keys. Try again later.", { "Retry-After": String(wait) }),
      };

    const header = request.headers.get("authorization");
    const fromHeader = header ? BEARER.exec(header)?.[1] : undefined;
    if (header && !fromHeader) {
      failures.hit(address);
      return { response: refuse(401, "Send the key as: Authorization: Bearer <key>.", challenge) };
    }
    if (fromHeader && urlToken && fromHeader !== urlToken) {
      failures.hit(address);
      return { response: refuse(400, "Two different keys were sent. Send one.") };
    }
    const token = fromHeader ?? urlToken;
    if (!token) {
      failures.hit(address);
      return { response: refuse(401, "A sintr connection key is required.", challenge) };
    }

    const body = await readBody(request, limits.maxBodyBytes);
    if (!body.ok) return { response: body.response };

    const principal = await options.authenticate(token, { client: clientOf(body.value) });
    if (!principal) {
      failures.hit(address);
      return {
        response: refuse(
          401,
          "This sintr connection key does not work: it is wrong, revoked or expired.",
          challenge,
        ),
      };
    }
    const busy = calls.hit(principal.tokenId);
    if (busy > 0) {
      return {
        response: refuse(429, "Too many requests. Try again in a moment.", { "Retry-After": String(busy) }),
        tokenId: principal.tokenId,
      };
    }

    const scope = await options.repositories.forUser(principal.userId);
    const consent = await scope.consents.latest("health_data_processing");
    if (!consent?.granted || consent.version !== HEALTH_DATA_CONSENT_VERSION) {
      return {
        response: refuse(
          403,
          "sintr needs the person to open the app and accept the current consent before their diary can be used.",
        ),
        tokenId: principal.tokenId,
      };
    }

    const server = createSintrServer({
      scope,
      scopes: new Set<ApiTokenScope>(principal.scopes),
      tokenId: principal.tokenId,
      appUrl,
      log,
      now,
    });
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    try {
      await server.connect(transport);
      const answered = await transport.handleRequest(request, { parsedBody: body.value });
      const headers = new Headers(answered.headers);
      headers.set("Cache-Control", "no-store");
      return {
        response: new Response(answered.body, { status: answered.status, headers }),
        tokenId: principal.tokenId,
      };
    } finally {
      await server.close();
    }
  }

  return async (request, urlToken) => {
    const started = Date.now();
    try {
      const { response, tokenId } = await handle(request, urlToken);
      log.info("mcp.request", {
        status: response.status,
        ...(tokenId ? { tokenId } : {}),
        durationMs: Date.now() - started,
      });
      return response;
    } catch (error) {
      log.error("mcp.request_failed", { error, durationMs: Date.now() - started });
      return refuse(500, "sintr could not answer just now.");
    }
  };
}

/** Where a client learns how to authenticate: a bearer token, nothing more. */
const challenge = { "WWW-Authenticate": 'Bearer realm="sintr"' };
