import { generateText } from "ai";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ProviderSetupError,
  checkBaseUrl,
  createLanguageModel,
  describeProviderError,
  testConnection,
} from "../src/providers";
import { scriptedModel } from "../src/testing";
import { capturedLogger } from "./support";

/** A fetch that records the request and answers like the provider would. No network. */
function fakeFetch(body: unknown, status = 200) {
  const requests: { url: string; headers: Headers; body: string }[] = [];
  const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init);
    requests.push({ url: request.url, headers: request.headers, body: await request.text() });
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as typeof globalThis.fetch;
  return { fetch, requests };
}

const OPENAI_REPLY = {
  id: "c1",
  object: "chat.completion",
  created: 1,
  model: "m",
  choices: [{ index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
  usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
};
const ANTHROPIC_REPLY = {
  id: "m1",
  type: "message",
  role: "assistant",
  model: "m",
  content: [{ type: "text", text: "ok" }],
  stop_reason: "end_turn",
  usage: { input_tokens: 1, output_tokens: 1 },
};
const GOOGLE_REPLY = {
  candidates: [{ content: { role: "model", parts: [{ text: "ok" }] }, finishReason: "STOP" }],
  usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 },
};

describe("bring your own key", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    // Keys an operator might have in the environment: they must never be used.
    process.env.ANTHROPIC_API_KEY = "env-anthropic-key";
    process.env.ANTHROPIC_BASE_URL = "https://env.example.test";
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "env-google-key";
    process.env.OPENAI_API_KEY = "env-openai-key";
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("talks to an OpenAI-compatible endpoint with the person's base URL, key and model", async () => {
    const { fetch, requests } = fakeFetch(OPENAI_REPLY);
    const model = createLanguageModel(
      {
        provider: "openai_compatible",
        baseUrl: "https://openrouter.ai/api/v1/",
        model: "vendor/model",
        apiKey: "sk-person",
      },
      { mode: "selfhost", fetch },
    );
    expect((await generateText({ model, prompt: "hi" })).text).toBe("ok");
    expect(requests[0]!.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(requests[0]!.headers.get("authorization")).toBe("Bearer sk-person");
    expect(JSON.parse(requests[0]!.body)).toMatchObject({ model: "vendor/model" });
  });

  it("allows a keyless local endpoint when self-hosted (Ollama, LiteLLM)", async () => {
    const { fetch, requests } = fakeFetch(OPENAI_REPLY);
    const model = createLanguageModel(
      { provider: "openai_compatible", baseUrl: "http://localhost:11434/v1", model: "local", apiKey: null },
      { mode: "selfhost", fetch },
    );
    await generateText({ model, prompt: "hi" });
    expect(requests[0]!.url).toBe("http://localhost:11434/v1/chat/completions");
    expect(requests[0]!.headers.get("authorization")).toBeNull();
  });

  it("sends Anthropic the person's key, to Anthropic, never the environment's", async () => {
    const { fetch, requests } = fakeFetch(ANTHROPIC_REPLY);
    const model = createLanguageModel(
      { provider: "anthropic", baseUrl: null, model: "claude-model", apiKey: "sk-ant-person" },
      { mode: "saas", fetch },
    );
    await generateText({ model, prompt: "hi" });
    expect(requests[0]!.url).toBe("https://api.anthropic.com/v1/messages");
    expect(requests[0]!.headers.get("x-api-key")).toBe("sk-ant-person");
  });

  it("sends Google the person's key, never the environment's", async () => {
    const { fetch, requests } = fakeFetch(GOOGLE_REPLY);
    const model = createLanguageModel(
      { provider: "google", baseUrl: null, model: "gemini-model", apiKey: "g-person" },
      { mode: "selfhost", fetch },
    );
    await generateText({ model, prompt: "hi" });
    expect(requests[0]!.url).toContain(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-model",
    );
    expect(requests[0]!.headers.get("x-goog-api-key")).toBe("g-person");
  });

  it("needs a key for Anthropic and Google, and a base URL for a compatible endpoint", () => {
    const options = { mode: "selfhost" as const };
    expect(() =>
      createLanguageModel({ provider: "anthropic", baseUrl: null, model: "m", apiKey: null }, options),
    ).toThrow(ProviderSetupError);
    expect(() =>
      createLanguageModel({ provider: "google", baseUrl: null, model: "m", apiKey: null }, options),
    ).toThrow(ProviderSetupError);
    expect(() =>
      createLanguageModel({ provider: "openai_compatible", baseUrl: null, model: "m", apiKey: "k" }, options),
    ).toThrow(ProviderSetupError);
  });
});

describe("where a base URL may point", () => {
  it("never carries credentials, and is http or https", () => {
    expect(checkBaseUrl("https://user:pass@llm.example.test/v1", "selfhost")).toEqual({
      ok: false,
      problem: "credentials_in_url",
    });
    expect(checkBaseUrl("ftp://llm.example.test", "selfhost")).toEqual({ ok: false, problem: "invalid_url" });
    expect(checkBaseUrl("not a url", "selfhost")).toEqual({ ok: false, problem: "invalid_url" });
  });

  it("may be local when self-hosted", () => {
    expect(checkBaseUrl("http://localhost:11434/v1", "selfhost")).toEqual({
      ok: true,
      url: "http://localhost:11434/v1",
    });
    expect(checkBaseUrl("http://192.168.1.20:4000", "selfhost").ok).toBe(true);
  });

  it.each([
    "http://api.example.test/v1",
    "https://localhost/v1",
    "https://127.0.0.1/v1",
    "https://10.1.2.3/v1",
    "https://169.254.169.254/latest",
    "https://[::1]/v1",
    "https://gateway.internal/v1",
    "https://8.8.8.8/v1",
  ])("is refused in SaaS mode when it is not https to a public name: %s", (url) => {
    expect(checkBaseUrl(url, "saas").ok).toBe(false);
  });

  it("is accepted in SaaS mode for https to a public name", () => {
    expect(checkBaseUrl("https://openrouter.ai/api/v1", "saas")).toEqual({
      ok: true,
      url: "https://openrouter.ai/api/v1",
    });
  });
});

describe("testing the connection", () => {
  it("says ok when the model answers", async () => {
    const { log } = capturedLogger();
    expect(await testConnection(scriptedModel([{ text: "ok" }]), log)).toEqual({ ok: true });
  });

  it("names a refused key, without logging the key or the reply", async () => {
    const { fetch } = fakeFetch({ error: { message: "Incorrect API key provided: sk-pe***on" } }, 401);
    const model = createLanguageModel(
      {
        provider: "openai_compatible",
        baseUrl: "https://llm.example.test/v1",
        model: "m",
        apiKey: "sk-person-secret",
      },
      { mode: "selfhost", fetch },
    );
    const { log, lines } = capturedLogger();
    expect(await testConnection(model, log)).toEqual({ ok: false, problem: "key_refused" });
    const logged = lines.join("\n");
    expect(logged).toContain("agent.connection_failed");
    expect(logged).not.toContain("sk-pe");
    expect(logged).not.toContain("Incorrect API key");
  });

  it("names an unreachable endpoint and a missing model", async () => {
    const unreachable = (async () => {
      throw new TypeError("fetch failed", { cause: { code: "ECONNREFUSED" } });
    }) as typeof fetch;
    const model = createLanguageModel(
      { provider: "openai_compatible", baseUrl: "http://localhost:1/v1", model: "m", apiKey: null },
      { mode: "selfhost", fetch: unreachable },
    );
    expect(await testConnection(model, capturedLogger().log)).toEqual({ ok: false, problem: "unreachable" });
    expect(describeProviderError(Object.assign(new Error("x"), { name: "TimeoutError" }))).toBe("timeout");
    const { fetch } = fakeFetch({ error: { message: "model not found" } }, 404);
    const missing = createLanguageModel(
      { provider: "openai_compatible", baseUrl: "https://llm.example.test/v1", model: "nope", apiKey: "k" },
      { mode: "selfhost", fetch },
    );
    expect(await testConnection(missing, capturedLogger().log)).toEqual({
      ok: false,
      problem: "model_not_found",
    });
  });
});
