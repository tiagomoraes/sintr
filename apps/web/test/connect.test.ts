import { describe, expect, it } from "vitest";
import {
  ACCESS_ORDER,
  KEY_PLACEHOLDER,
  QUIET_AFTER_DAYS,
  antigravityConfig,
  claudeCodeCommand,
  claudeDesktopConfig,
  clientGuides,
  clientNamed,
  friendlyClient,
  geminiCommand,
  hermesCommand,
  hermesConfig,
  isQuiet,
  keyedUrl,
  lastTalkedText,
  mcpUrl,
  onlyReachableHere,
  sinceText,
} from "@/lib/connect";
import { messagesFor } from "@/messages";

const en = messagesFor("en");
const pt = messagesFor("pt-BR");
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
    const guides = clientGuides(endpoint, en);
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
      clientGuides({ ...endpoint, key }, en).flatMap((guide) =>
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

  it("says the steps in the page's language, and the commands exactly the same", () => {
    const english = clientGuides(endpoint, en);
    const portuguese = clientGuides(endpoint, pt);
    expect(portuguese.map((guide) => guide.name)).toEqual(english.map((guide) => guide.name));
    expect(portuguese[0]!.steps[0]!.text).toBe("No Claude, abra “Customize” e depois “Connectors”.");
    const snippets = (guides: typeof english) =>
      guides.flatMap((guide) =>
        [...guide.steps, ...(guide.another?.steps ?? [])].flatMap((step) =>
          step.snippet ? [step.snippet.text] : [],
        ),
      );
    expect(snippets(portuguese)).toEqual(snippets(english));
    expect(english[0]!.steps[2]!.snippet).toMatchObject({ label: "the address", caption: "Address" });
    expect(portuguese[0]!.steps[2]!.snippet).toMatchObject({ label: "o endereço", caption: "Endereço" });
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

  const utc = { language: "en", timezone: "UTC" };
  const utcPt = { language: "pt-BR", timezone: "UTC" };

  it("says when the assistant last talked to sintr, in plain words", () => {
    expect(sinceText(ago(0), now, utc, en)).toBe("just now");
    expect(sinceText(ago(1), now, utc, en)).toBe("a minute ago");
    expect(sinceText(ago(12), now, utc, en)).toBe("12 minutes ago");
    expect(sinceText(ago(90), now, utc, en)).toBe("an hour ago");
    expect(sinceText(ago(60 * 5), now, utc, en)).toBe("5 hours ago");
    expect(sinceText(ago(60 * 30), now, utc, en)).toBe("yesterday");
    expect(sinceText(new Date("2026-10-02T12:00:00Z"), now, utc, en)).toBe("on 2 October");
    expect(sinceText(new Date("2025-10-02T12:00:00Z"), now, utc, en)).toBe("on 2 October 2025");
  });

  it("says it in the page's language, with its dates", () => {
    expect(sinceText(ago(12), now, utcPt, pt)).toBe("há 12 minutos");
    expect(sinceText(new Date("2026-10-02T12:00:00Z"), now, utcPt, pt)).toBe("em 2 de outubro");
    expect(sinceText(new Date("2025-10-02T12:00:00Z"), now, utcPt, pt)).toBe("em 2 de outubro de 2025");
    expect(lastTalkedText({ lastUsedAt: ago(3), lastClient: "claude-ai" }, now, utcPt, pt)).toBe(
      "Falou com o sintr pela última vez há 3 minutos, pelo Claude.",
    );
  });

  it("names the client the way a person knows it", () => {
    expect(friendlyClient("claude-ai")).toBe("Claude");
    expect(friendlyClient("claude-code")).toBe("Claude Code");
    expect(friendlyClient("openai-mcp")).toBe("ChatGPT");
    expect(friendlyClient("gemini-cli-mcp-client")).toBe("Gemini");
    expect(friendlyClient("Hermes Agent")).toBe("Hermes");
    expect(friendlyClient("my-own-client")).toBe("my-own-client");
    expect(lastTalkedText({ lastUsedAt: null, lastClient: null }, now, utc, en)).toBe("Not used yet.");
    expect(lastTalkedText({ lastUsedAt: ago(3), lastClient: "claude-ai" }, now, utc, en)).toBe(
      "Last talked to sintr 3 minutes ago, from Claude.",
    );
  });
});

describe("making a key", () => {
  it("offers the three accesses, the one that reads nothing first, each said with what it does and when to choose it", () => {
    expect(ACCESS_ORDER).toEqual(["write", "read_write", "read"]);
    for (const t of [en, pt]) {
      for (const access of ACCESS_ORDER) {
        const words = t.connect.access[access];
        expect(words.label).not.toBe("");
        expect(words.does).toMatch(/\.$/u);
        expect(words.when).toMatch(/\.$/u);
      }
    }
    expect(en.connect.access.write.does).toBe(
      "It saves the entries and check-ins you say yes to, and never reads your diary back.",
    );
  });

  it("opens the steps of the assistant a key is named after", () => {
    expect(clientNamed("Claude on my phone")).toBe("claude");
    expect(clientNamed("claude code at work")).toBe("claude-code");
    expect(clientNamed("Claude-Code")).toBe("claude-code");
    expect(clientNamed("ChatGPT no trabalho")).toBe("chatgpt");
    expect(clientNamed("Chat GPT")).toBe("chatgpt");
    expect(clientNamed("Gemini CLI")).toBe("gemini");
    expect(clientNamed("Antigravity")).toBe("gemini");
    expect(clientNamed("hermes")).toBe("hermes");
    expect(clientNamed("My assistant")).toBeNull();
  });
});

describe("a key gone quiet", () => {
  const now = new Date("2026-10-18T15:00:00Z");
  const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);

  it("is one its assistant has not called for over two months, or one never used for as long since it was made", () => {
    expect(QUIET_AFTER_DAYS).toBe(60);
    expect(isQuiet({ lastUsedAt: daysAgo(59), createdAt: daysAgo(400) }, now)).toBe(false);
    expect(isQuiet({ lastUsedAt: daysAgo(61), createdAt: daysAgo(400) }, now)).toBe(true);
    expect(isQuiet({ lastUsedAt: null, createdAt: daysAgo(3) }, now)).toBe(false);
    expect(isQuiet({ lastUsedAt: null, createdAt: daysAgo(61) }, now)).toBe(true);
  });
});
