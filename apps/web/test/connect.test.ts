import { describe, expect, it } from "vitest";
import {
  KEY_PLACEHOLDER,
  antigravityConfig,
  claudeCodeCommand,
  claudeDesktopConfig,
  clientGuides,
  friendlyClient,
  geminiCommand,
  hermesCommand,
  hermesConfig,
  keyedUrl,
  lastTalkedText,
  mcpUrl,
  onlyReachableHere,
  sinceText,
} from "@/lib/connect";

const endpoint = { appUrl: "https://diary.example.com/", key: "sintr_abcDEF123_-xyz" };

describe("the setup for each assistant", () => {
  it("builds the address with and without the key", () => {
    expect(mcpUrl(endpoint.appUrl)).toBe("https://diary.example.com/mcp");
    expect(keyedUrl(endpoint)).toBe("https://diary.example.com/mcp/sintr_abcDEF123_-xyz");
  });

  it("writes the Claude desktop file as the documented mcpServers JSON, with the bridge and its settings", () => {
    const config = JSON.parse(claudeDesktopConfig(endpoint)) as {
      mcpServers: { sintr: { command: string; args: string[]; env: Record<string, string> } };
    };
    expect(config.mcpServers.sintr).toEqual({
      command: "node",
      args: ["/path/to/sintr-mcp.mjs"],
      env: { SINTR_URL: "https://diary.example.com", SINTR_TOKEN: endpoint.key },
    });
  });

  it("writes the commands as their docs give them", () => {
    expect(claudeCodeCommand(endpoint)).toBe(
      'claude mcp add --transport http --scope user sintr https://diary.example.com/mcp --header "Authorization: Bearer sintr_abcDEF123_-xyz"',
    );
    expect(geminiCommand(endpoint)).toBe(
      'gemini mcp add -s user --transport http --header "Authorization: Bearer sintr_abcDEF123_-xyz" sintr https://diary.example.com/mcp',
    );
    // Hermes asks for the key itself and keeps it in ~/.hermes/.env, out of the command line.
    expect(hermesCommand(endpoint)).toBe(
      "hermes mcp add sintr --url https://diary.example.com/mcp --auth header",
    );
    expect(hermesCommand(endpoint)).not.toContain(endpoint.key);
  });

  it("writes the Antigravity and Hermes files with the key as a bearer header", () => {
    const antigravity = JSON.parse(antigravityConfig(endpoint)) as {
      mcpServers: { sintr: { serverUrl: string; headers: Record<string, string> } };
    };
    expect(antigravity.mcpServers.sintr).toEqual({
      serverUrl: "https://diary.example.com/mcp",
      headers: { Authorization: "Bearer sintr_abcDEF123_-xyz" },
    });
    expect(hermesConfig(endpoint)).toBe(
      [
        "mcp_servers:",
        "  sintr:",
        '    url: "https://diary.example.com/mcp"',
        "    headers:",
        '      Authorization: "Bearer sintr_abcDEF123_-xyz"',
      ].join("\n"),
    );
  });

  it("covers the five assistants, each with a check, and fills in the key or the placeholder", () => {
    const guides = clientGuides(endpoint);
    expect(guides.map((guide) => guide.name)).toEqual([
      "Claude",
      "ChatGPT",
      "Gemini",
      "Claude Code",
      "Hermes",
    ]);
    for (const guide of guides) {
      expect(guide.what.length).toBeGreaterThan(10);
      expect(guide.check.length).toBeGreaterThan(10);
      expect(guide.steps.length).toBeGreaterThan(0);
    }
    const snippets = (key: string) =>
      clientGuides({ ...endpoint, key }).flatMap((guide) =>
        [...guide.steps, ...(guide.another?.steps ?? [])].flatMap((step) =>
          step.snippet ? [step.snippet.text] : [],
        ),
      );
    expect(
      snippets(endpoint.key).filter((text) => text.includes(endpoint.key)).length,
    ).toBeGreaterThanOrEqual(6);
    expect(snippets(KEY_PLACEHOLDER).join("\n")).not.toContain("sintr_abc");
    // The services that call from their own servers get the address that carries the key.
    const web = guides.filter((guide) => guide.fromTheirServers).map((guide) => guide.id);
    expect(web).toEqual(["claude", "chatgpt"]);
  });

  it("knows when only this computer or network can reach sintr", () => {
    expect(onlyReachableHere("http://localhost:3000")).toBe(true);
    expect(onlyReachableHere("https://localhost")).toBe(true);
    expect(onlyReachableHere("https://192.168.1.20")).toBe(true);
    expect(onlyReachableHere("https://10.1.2.3")).toBe(true);
    expect(onlyReachableHere("https://172.20.0.1")).toBe(true);
    expect(onlyReachableHere("https://diary.local")).toBe(true);
    expect(onlyReachableHere("http://diary.example.com")).toBe(true);
    expect(onlyReachableHere("https://diary.example.com")).toBe(false);
    expect(onlyReachableHere("https://172.32.0.1")).toBe(false);
  });
});

describe("whether a key is alive", () => {
  const now = new Date("2026-10-18T15:00:00Z");
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

  it("says when the assistant last talked to sintr, in plain words", () => {
    expect(sinceText(ago(0), now, "UTC")).toBe("just now");
    expect(sinceText(ago(1), now, "UTC")).toBe("a minute ago");
    expect(sinceText(ago(12), now, "UTC")).toBe("12 minutes ago");
    expect(sinceText(ago(90), now, "UTC")).toBe("an hour ago");
    expect(sinceText(ago(60 * 5), now, "UTC")).toBe("5 hours ago");
    expect(sinceText(ago(60 * 30), now, "UTC")).toBe("yesterday");
    expect(sinceText(new Date("2026-10-02T12:00:00Z"), now, "UTC")).toBe("on 2 October");
    expect(sinceText(new Date("2025-10-02T12:00:00Z"), now, "UTC")).toBe("on 2 October 2025");
  });

  it("names the client the way a person knows it", () => {
    expect(friendlyClient("claude-ai")).toBe("Claude");
    expect(friendlyClient("claude-code")).toBe("Claude Code");
    expect(friendlyClient("openai-mcp")).toBe("ChatGPT");
    expect(friendlyClient("gemini-cli-mcp-client")).toBe("Gemini");
    expect(friendlyClient("Hermes Agent")).toBe("Hermes");
    expect(friendlyClient("my-own-client")).toBe("my-own-client");
    expect(lastTalkedText({ lastUsedAt: null, lastClient: null }, now, "UTC")).toBe("Not used yet.");
    expect(lastTalkedText({ lastUsedAt: ago(3), lastClient: "claude-ai" }, now, "UTC")).toBe(
      "Last talked to sintr 3 minutes ago, from Claude.",
    );
  });
});
