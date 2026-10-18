/**
 * Bring your own key: the person's provider, model and key, as an AI SDK
 * language model. Three kinds cover the field:
 * - an OpenAI-compatible endpoint (base URL, key, model): OpenAI itself,
 *   OpenRouter, Ollama, LiteLLM, vLLM and most gateways;
 * - Anthropic and Google, by name.
 *
 * Keys and base URLs are always passed explicitly, so a provider never
 * falls back to an operator's environment (ANTHROPIC_API_KEY and friends).
 */
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import type { Logger, ProviderCredentials, ProviderKind } from "@sintr/core";
import { APICallError, generateText, type LanguageModel } from "ai";

// Warnings name settings and features, never content, but they would go to
// process.emitWarning; the redacting logger is the only logger here.
globalThis.AI_SDK_LOG_WARNINGS = false;

export const DEFAULT_BASE_URLS: Record<Exclude<ProviderKind, "openai_compatible">, string> = {
  anthropic: "https://api.anthropic.com/v1",
  google: "https://generativelanguage.googleapis.com/v1beta",
};

export class ProviderSetupError extends Error {
  override readonly name = "ProviderSetupError";
  readonly code: "base_url_required" | "key_required" | BaseUrlProblem;
  constructor(code: ProviderSetupError["code"]) {
    super(`assistant provider is not usable: ${code}`);
    this.code = code;
  }
}

export interface ModelOptions {
  /** The deployment mode: saas restricts where a base URL may point. */
  mode: "selfhost" | "saas";
  /** For tests: a fetch that never reaches the network. */
  fetch?: typeof fetch;
}

export function createLanguageModel(credentials: ProviderCredentials, options: ModelOptions): LanguageModel {
  const { provider, model, apiKey } = credentials;
  const baseUrl =
    credentials.baseUrl ?? (provider === "openai_compatible" ? null : DEFAULT_BASE_URLS[provider]);
  if (!baseUrl) throw new ProviderSetupError("base_url_required");
  const checked = checkBaseUrl(baseUrl, options.mode);
  if (!checked.ok) throw new ProviderSetupError(checked.problem);
  // In SaaS mode a public host must not bounce the request somewhere internal.
  const baseFetch = options.fetch ?? globalThis.fetch;
  const fetchOption =
    options.mode === "saas"
      ? { fetch: ((input, init) => baseFetch(input, { ...init, redirect: "error" })) as typeof fetch }
      : options.fetch
        ? { fetch: options.fetch }
        : {};
  switch (provider) {
    case "openai_compatible":
      return createOpenAICompatible({
        name: "byok",
        baseURL: checked.url,
        ...(apiKey ? { apiKey } : {}),
        includeUsage: true,
        ...fetchOption,
      })(model);
    case "anthropic":
      if (!apiKey) throw new ProviderSetupError("key_required");
      return createAnthropic({ apiKey, baseURL: checked.url, ...fetchOption })(model);
    case "google":
      if (!apiKey) throw new ProviderSetupError("key_required");
      return createGoogle({ apiKey, baseURL: checked.url, ...fetchOption })(model);
  }
}

export type BaseUrlProblem = "invalid_url" | "credentials_in_url" | "https_required" | "private_address";

const PRIVATE_HOST =
  /^(?:localhost|.*\.localhost|.*\.local|.*\.internal|.*\.lan|\[?::1\]?|\[?f[cd][0-9a-f]{2}:.*|\[?fe80:.*|0\.0\.0\.0|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+)$/i;
const IP_LITERAL = /^(?:\d{1,3}(?:\.\d{1,3}){3}|\[[0-9a-f:.]+\])$/i;

/**
 * Where a base URL may point. Self-host allows any http(s) address,
 * including a model on the same machine. SaaS allows only https to a public
 * host name: no IP literals, no local names, and redirects are refused.
 * (Resolving names to catch DNS tricks is F4 hardening.) A URL never
 * carries credentials.
 */
export function checkBaseUrl(
  value: string,
  mode: "selfhost" | "saas",
): { ok: true; url: string } | { ok: false; problem: BaseUrlProblem } {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return { ok: false, problem: "invalid_url" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false, problem: "invalid_url" };
  if (url.username || url.password) return { ok: false, problem: "credentials_in_url" };
  if (mode === "saas") {
    if (url.protocol !== "https:") return { ok: false, problem: "https_required" };
    // "localhost." and "metadata.google.internal." are the same hosts.
    const host = url.hostname.replace(/\.+$/u, "");
    if (PRIVATE_HOST.test(host) || IP_LITERAL.test(host)) {
      return { ok: false, problem: "private_address" };
    }
  }
  return { ok: true, url: url.toString().replace(/\/$/u, "") };
}

export type ConnectionProblem =
  "key_refused" | "model_not_found" | "rate_limited" | "unreachable" | "timeout" | "provider_error";

/** A provider failure as a code the person can act on. Never its message. */
export function describeProviderError(error: unknown): ConnectionProblem {
  const status = APICallError.isInstance(error) ? error.statusCode : undefined;
  if (status === 401 || status === 403) return "key_refused";
  if (status === 404) return "model_not_found";
  if (status === 429) return "rate_limited";
  const name = error instanceof Error ? error.name : "";
  if (name === "TimeoutError" || name === "AbortError") return "timeout";
  if (status === undefined) {
    const cause = (error as { cause?: { code?: unknown } } | null)?.cause;
    const code = typeof cause?.code === "string" ? cause.code : "";
    if (/^(?:ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ECONNRESET|EHOSTUNREACH|ETIMEDOUT)$/.test(code))
      return "unreachable";
    if (error instanceof TypeError) return "unreachable";
  }
  return "provider_error";
}

/**
 * One short, real call to the provider: does the key work, does the model
 * answer. Only a code comes back; the reply and any error text are dropped.
 */
export async function testConnection(
  model: LanguageModel,
  log: Logger,
): Promise<{ ok: true } | { ok: false; problem: ConnectionProblem }> {
  try {
    await generateText({
      model,
      prompt: "This is a connection test. Reply with the single word: ok",
      maxRetries: 0,
      timeout: 30_000,
      telemetry: { isEnabled: false },
    });
    return { ok: true };
  } catch (error) {
    const problem = describeProviderError(error);
    log.warn("agent.connection_failed", {
      code: problem,
      status: APICallError.isInstance(error) ? (error.statusCode ?? null) : null,
      error,
    });
    return { ok: false, problem };
  }
}

/**
 * A model that always fails. The app uses it when no provider is set yet,
 * so a message that signals risk is still answered: the crisis screen runs
 * before any model, and every other message gets a clear "not set up".
 */
export function unavailableModel(): LanguageModelV4 {
  const fail = () => Promise.reject(new ProviderSetupError("key_required"));
  return {
    specificationVersion: "v4",
    provider: "sintr-unavailable",
    modelId: "none",
    supportedUrls: {},
    doGenerate: fail,
    doStream: fail,
  };
}
