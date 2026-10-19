import { describe, expect, it } from "vitest";
import { needsSetup, problemCopy } from "@/lib/chat";

describe("what the person is told when the assistant cannot answer", () => {
  it("explains a code, whether bare or in a JSON body", () => {
    expect(problemCopy("key_refused")).toContain("refused the key");
    expect(problemCopy('{"code":"not_configured"}')).toContain("no assistant of its own");
    expect(problemCopy('{"code":"not_configured"}')).toContain("your own key");
  });

  it("never sends a person on the house assistant to check a key that is not theirs", () => {
    for (const code of [
      "key_refused",
      "model_not_found",
      "unreachable",
      "provider_error",
      "private_address",
    ]) {
      const words = problemCopy(code, "house");
      expect(words).toContain("Your message is kept");
      expect(words).not.toMatch(/key|Settings|address|model/u);
    }
    expect(problemCopy("rate_limited", "house")).toContain("busy");
    expect(problemCopy("signed_out", "house")).toContain("Sign in again");
  });

  it("falls back to a calm sentence for anything else, never the raw text", () => {
    const raw = "Incorrect API key provided: sk-abc***xyz";
    expect(problemCopy(raw)).not.toContain("sk-abc");
    expect(problemCopy(raw)).toContain("Your message is kept");
    expect(problemCopy(undefined)).toContain("Your message is kept");
  });
});

describe("when trying again cannot help", () => {
  it("is told apart from a passing failure", () => {
    expect(needsSetup('{"code":"not_configured"}')).toBe(true);
    expect(needsSetup("nothing_to_retry")).toBe(true);
    expect(needsSetup("rate_limited")).toBe(false);
    expect(needsSetup("key_refused")).toBe(false);
  });
});
