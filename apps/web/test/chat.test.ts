import { describe, expect, it } from "vitest";
import { needsSetup, problemText } from "@/lib/chat";
import { messagesFor } from "@/messages";

const t = messagesFor("en");

describe("what the person is told when the assistant cannot answer", () => {
  it("explains a code, whether bare or in a JSON body", () => {
    expect(problemText("key_refused", t)).toContain("refused the key");
    expect(problemText('{"code":"not_configured"}', t)).toContain("no assistant of its own");
    expect(problemText('{"code":"not_configured"}', t)).toContain("your own key");
  });

  it("never sends a person on the house assistant to check a key that is not theirs", () => {
    for (const code of [
      "key_refused",
      "model_not_found",
      "unreachable",
      "provider_error",
      "private_address",
    ]) {
      const words = problemText(code, t, "house");
      expect(words).toContain("Your message is kept");
      expect(words).not.toMatch(/key|Settings|address|model/u);
    }
    expect(problemText("rate_limited", t, "house")).toContain("busy");
    expect(problemText("signed_out", t, "house")).toContain("Sign in again");
  });

  it("falls back to a calm sentence for anything else, never the raw text", () => {
    const raw = "Incorrect API key provided: sk-abc***xyz";
    expect(problemText(raw, t)).not.toContain("sk-abc");
    expect(problemText(raw, t)).toContain("Your message is kept");
    expect(problemText(undefined, t)).toContain("Your message is kept");
    expect(problemText("constructor", t)).toContain("Your message is kept");
  });

  it("is said in the page's language", () => {
    const pt = messagesFor("pt-BR");
    expect(problemText("key_refused", pt)).toBe(pt.talk.problems.key_refused);
    expect(problemText("key_refused", pt, "house")).toBe(pt.talk.house.fallback);
    expect(problemText("signed_out", pt, "house")).toBe(pt.talk.problems.signed_out);
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
