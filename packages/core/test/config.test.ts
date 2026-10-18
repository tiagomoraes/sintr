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
});
