import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "../src/config";
import { generateMasterKey } from "../src/crypto";

const valid = () => ({
  DATABASE_URL: "postgres://sintr:pw@localhost:5432/sintr",
  SINTR_AUTH_SECRET: "a".repeat(48),
  SINTR_MASTER_KEY: generateMasterKey(),
});

describe("configuration", () => {
  it("applies defaults for a minimal environment", () => {
    const config = loadConfig(valid());
    expect(config.mode).toBe("selfhost");
    expect(config.signup).toBe("open");
    expect(config.url.origin).toBe("http://localhost:3000");
    expect(config.masterKey.id).toBe("k1");
    expect(config.masterKey.key.byteLength).toBe(32);
  });

  it("names the broken variables without echoing secret values", () => {
    const env = {
      ...valid(),
      SINTR_AUTH_SECRET: "short-secret-value",
      SINTR_MASTER_KEY: "c2hvcnQta2V5LXZhbHVl",
    };
    let message = "";
    try {
      loadConfig(env);
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      message = (error as Error).message;
    }
    expect(message).toContain("SINTR_AUTH_SECRET");
    expect(message).not.toContain("short-secret-value");

    const badKey = { ...valid(), SINTR_MASTER_KEY: "c2hvcnQta2V5LXZhbHVl" };
    expect(() => loadConfig(badKey)).toThrow(/SINTR_MASTER_KEY/);
    try {
      loadConfig(badKey);
    } catch (error) {
      expect((error as Error).message).not.toContain("c2hvcnQta2V5LXZhbHVl");
    }
  });

  it("requires the database URL and rejects unknown modes", () => {
    const { DATABASE_URL: _omit, ...rest } = valid();
    expect(() => loadConfig(rest)).toThrow(/DATABASE_URL/);
    expect(() => loadConfig({ ...valid(), SINTR_MODE: "cloud" })).toThrow(/SINTR_MODE/);
  });

  it("keeps the offline test assistant off by default, and refuses it in saas mode", () => {
    expect(loadConfig(valid()).fakeAgent).toBe(false);
    expect(loadConfig({ ...valid(), SINTR_FAKE_AGENT: "1" }).fakeAgent).toBe(true);
    expect(() => loadConfig({ ...valid(), SINTR_FAKE_AGENT: "1", SINTR_MODE: "saas" })).toThrow(
      /SINTR_FAKE_AGENT/,
    );
  });

  it("gives practices unlimited seats on a self-host and one free seat on the hosted offer, unless configured", () => {
    expect(loadConfig(valid()).practice).toEqual({ plan: "Self-hosted", seats: null });
    expect(loadConfig({ ...valid(), SINTR_MODE: "saas" }).practice).toEqual({ plan: "Free", seats: 1 });
    expect(
      loadConfig({ ...valid(), SINTR_PRACTICE_SEATS: "12", SINTR_PRACTICE_PLAN: "Practice 12" }).practice,
    ).toEqual({ plan: "Practice 12", seats: 12 });
    expect(
      loadConfig({ ...valid(), SINTR_MODE: "saas", SINTR_PRACTICE_SEATS: "unlimited" }).practice,
    ).toEqual({
      plan: "Free",
      seats: null,
    });
    // An empty value in .env means "not set".
    expect(loadConfig({ ...valid(), SINTR_PRACTICE_SEATS: "" }).practice.seats).toBeNull();
    expect(() => loadConfig({ ...valid(), SINTR_PRACTICE_SEATS: "ten" })).toThrow(/SINTR_PRACTICE_SEATS/);
    expect(() => loadConfig({ ...valid(), SINTR_PRACTICE_SEATS: "-1" })).toThrow(/SINTR_PRACTICE_SEATS/);
  });

  it("has no house assistant unless SINTR_HOUSE_* configures one, all or nothing", () => {
    expect(loadConfig(valid()).house).toBeNull();
    expect(
      loadConfig({
        ...valid(),
        SINTR_HOUSE_PROVIDER: "anthropic",
        SINTR_HOUSE_MODEL: "claude-haiku-5-5",
        SINTR_HOUSE_KEY: "sk-ant-house-secret-value",
      }).house,
    ).toEqual({
      provider: "anthropic",
      baseUrl: null,
      model: "claude-haiku-5-5",
      apiKey: "sk-ant-house-secret-value",
      name: "Anthropic",
      voice: { off: false, endpoint: null, model: null, language: null },
    });
    // An OpenAI-compatible gateway is named after its host unless SINTR_HOUSE_NAME says otherwise.
    const gateway = {
      ...valid(),
      SINTR_HOUSE_PROVIDER: "openai_compatible",
      SINTR_HOUSE_BASE_URL: "http://litellm:4000/v1",
      SINTR_HOUSE_MODEL: "house",
    };
    expect(loadConfig(gateway).house).toMatchObject({ name: "litellm", apiKey: null });
    expect(loadConfig({ ...gateway, SINTR_HOUSE_NAME: "Anthropic, through our gateway" }).house?.name).toBe(
      "Anthropic, through our gateway",
    );
  });

  it("names what is missing from the house assistant, never the key", () => {
    const secret = "sk-ant-never-echo-this";
    const problem = (env: Record<string, string>) => {
      try {
        loadConfig({ ...valid(), ...env });
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        return (error as Error).message;
      }
      return "";
    };
    expect(problem({ SINTR_HOUSE_KEY: secret })).toMatch(/SINTR_HOUSE_PROVIDER/);
    expect(problem({ SINTR_HOUSE_PROVIDER: "anthropic", SINTR_HOUSE_KEY: secret })).toMatch(
      /SINTR_HOUSE_MODEL/,
    );
    expect(problem({ SINTR_HOUSE_PROVIDER: "google", SINTR_HOUSE_MODEL: "gemini" })).toMatch(
      /SINTR_HOUSE_KEY/,
    );
    expect(problem({ SINTR_HOUSE_PROVIDER: "openai_compatible", SINTR_HOUSE_MODEL: "m" })).toMatch(
      /SINTR_HOUSE_BASE_URL/,
    );
    expect(
      problem({
        SINTR_HOUSE_PROVIDER: "openai_compatible",
        SINTR_HOUSE_MODEL: "m",
        SINTR_HOUSE_BASE_URL: `https://user:${secret}@gateway.example/v1`,
      }),
    ).toMatch(/SINTR_HOUSE_BASE_URL/);
    expect(problem({ SINTR_HOUSE_PROVIDER: "someone", SINTR_HOUSE_KEY: secret })).toMatch(
      /SINTR_HOUSE_PROVIDER/,
    );
    const leaky: Record<string, string>[] = [
      { SINTR_HOUSE_KEY: secret },
      { SINTR_HOUSE_PROVIDER: "anthropic", SINTR_HOUSE_KEY: secret },
      {
        SINTR_HOUSE_PROVIDER: "openai_compatible",
        SINTR_HOUSE_MODEL: "m",
        SINTR_HOUSE_BASE_URL: `https://user:${secret}@gateway.example/v1`,
      },
    ];
    for (const env of leaky) expect(problem(env)).not.toContain(secret);
  });

  it("transcribes through the house's own provider unless SINTR_HOUSE_STT_* says otherwise", () => {
    const house = {
      ...valid(),
      SINTR_HOUSE_PROVIDER: "openai_compatible",
      SINTR_HOUSE_BASE_URL: "https://openrouter.ai/api/v1",
      SINTR_HOUSE_MODEL: "anthropic/claude-haiku-5.5",
      SINTR_HOUSE_KEY: "sk-or-house",
    };
    expect(loadConfig(house).house?.voice).toEqual({
      off: false,
      endpoint: null,
      model: null,
      language: null,
    });
    expect(
      loadConfig({
        ...house,
        SINTR_HOUSE_STT_MODEL: "openai/whisper-large-v3",
        SINTR_HOUSE_STT_LANGUAGE: "pt",
      }).house?.voice,
    ).toEqual({ off: false, endpoint: null, model: "openai/whisper-large-v3", language: "pt" });
    expect(loadConfig({ ...house, SINTR_HOUSE_STT_MODEL: "off" }).house?.voice).toMatchObject({ off: true });
    // An Anthropic house can transcribe through an endpoint of its own.
    const anthropic = {
      ...valid(),
      SINTR_HOUSE_PROVIDER: "anthropic",
      SINTR_HOUSE_MODEL: "claude-haiku-5-5",
      SINTR_HOUSE_KEY: "sk-ant-house",
      SINTR_HOUSE_STT_BASE_URL: "https://openrouter.ai/api/v1",
      SINTR_HOUSE_STT_KEY: "sk-or-voice",
    };
    expect(loadConfig(anthropic).house?.voice).toEqual({
      off: false,
      endpoint: { baseUrl: "https://openrouter.ai/api/v1", apiKey: "sk-or-voice" },
      model: null,
      language: null,
    });
  });

  it("names what is wrong with the house's transcription, never its key", () => {
    const secret = "sk-or-never-echo-this";
    const house = {
      ...valid(),
      SINTR_HOUSE_PROVIDER: "anthropic",
      SINTR_HOUSE_MODEL: "claude-haiku-5-5",
      SINTR_HOUSE_KEY: "sk-ant-house",
    };
    const problem = (env: Record<string, string>) => {
      try {
        loadConfig({ ...env });
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        return (error as Error).message;
      }
      return "";
    };
    // Without a house there is nothing to transcribe for.
    expect(problem({ ...valid(), SINTR_HOUSE_STT_KEY: secret })).toMatch(/SINTR_HOUSE_PROVIDER/);
    expect(problem({ ...house, SINTR_HOUSE_STT_KEY: secret })).toMatch(/SINTR_HOUSE_STT_BASE_URL/);
    expect(problem({ ...house, SINTR_HOUSE_STT_BASE_URL: `https://u:${secret}@voice.example/v1` })).toMatch(
      /SINTR_HOUSE_STT_BASE_URL/,
    );
    expect(
      problem({ ...house, SINTR_MODE: "saas", SINTR_HOUSE_STT_BASE_URL: "https://voice.example/v1" }),
    ).toMatch(/SINTR_HOUSE_STT_KEY/);
    expect(problem({ ...house, SINTR_HOUSE_STT_LANGUAGE: "Portuguese" })).toMatch(/SINTR_HOUSE_STT_LANGUAGE/);
    for (const env of [
      { ...valid(), SINTR_HOUSE_STT_KEY: secret },
      { ...house, SINTR_HOUSE_STT_KEY: secret },
      { ...house, SINTR_HOUSE_STT_BASE_URL: `https://u:${secret}@voice.example/v1` },
    ]) {
      expect(problem(env)).not.toContain(secret);
    }
  });

  it("asks a gateway on the hosted offer for a key and a name people are told", () => {
    const gateway = {
      ...valid(),
      SINTR_MODE: "saas",
      SINTR_HOUSE_PROVIDER: "openai_compatible",
      SINTR_HOUSE_BASE_URL: "http://litellm:4000/v1",
      SINTR_HOUSE_MODEL: "house",
    };
    expect(() => loadConfig(gateway)).toThrow(/SINTR_HOUSE_KEY/);
    expect(() => loadConfig({ ...gateway, SINTR_HOUSE_KEY: "sk-gateway-key" })).toThrow(/SINTR_HOUSE_NAME/);
    expect(
      loadConfig({ ...gateway, SINTR_HOUSE_KEY: "sk-gateway-key", SINTR_HOUSE_NAME: "Anthropic" }).house,
    ).toMatchObject({ name: "Anthropic", baseUrl: "http://litellm:4000/v1" });
  });

  it("puts a person on Free unless SINTR_PERSON_PLAN says otherwise", () => {
    expect(loadConfig(valid()).personPlan).toBe("free");
    expect(loadConfig({ ...valid(), SINTR_PERSON_PLAN: "unlimited" }).personPlan).toBe("unlimited");
    expect(() => loadConfig({ ...valid(), SINTR_PERSON_PLAN: "gold" })).toThrow(/SINTR_PERSON_PLAN/);
  });

  it("keeps payments off unless the key, the webhook secret and a price are all given", () => {
    expect(loadConfig(valid()).billing).toEqual({ kind: "off" });
    const stripe = {
      ...valid(),
      SINTR_STRIPE_SECRET_KEY: "sk_test_abc123",
      SINTR_STRIPE_WEBHOOK_SECRET: "whsec_def456",
      SINTR_STRIPE_PRICE_PERSONAL: "price_personal1",
    };
    expect(loadConfig(stripe).billing).toEqual({
      kind: "stripe",
      secretKey: "sk_test_abc123",
      webhookSecret: "whsec_def456",
      prices: { personal: "price_personal1", practiceSeat: null },
      apiUrl: "https://api.stripe.com",
    });
    const { SINTR_STRIPE_WEBHOOK_SECRET: _hook, ...noHook } = stripe;
    expect(() => loadConfig(noHook)).toThrow(/SINTR_STRIPE_WEBHOOK_SECRET/);
    const { SINTR_STRIPE_PRICE_PERSONAL: _price, ...noPrice } = stripe;
    expect(() => loadConfig(noPrice)).toThrow(/SINTR_STRIPE_PRICE_PERSONAL/);
    const { SINTR_STRIPE_SECRET_KEY: _key, ...noKey } = stripe;
    expect(() => loadConfig(noKey)).toThrow(/SINTR_STRIPE_SECRET_KEY/);
    expect(() => loadConfig({ ...stripe, SINTR_STRIPE_SECRET_KEY: "pk_live_public" })).toThrow(
      /SINTR_STRIPE_SECRET_KEY/,
    );
    try {
      loadConfig({ ...stripe, SINTR_STRIPE_SECRET_KEY: "pk_live_public" });
    } catch (error) {
      expect((error as Error).message).not.toContain("pk_live_public");
    }
    // A fake Stripe for the tests only.
    expect(loadConfig({ ...stripe, SINTR_STRIPE_API_URL: "http://127.0.0.1:3199/" }).billing).toMatchObject({
      apiUrl: "http://127.0.0.1:3199",
    });
    expect(() =>
      loadConfig({ ...stripe, SINTR_STRIPE_API_URL: "http://127.0.0.1:3199", SINTR_MODE: "saas" }),
    ).toThrow(/SINTR_STRIPE_API_URL/);
  });
});
