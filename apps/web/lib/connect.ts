/**
 * What the Connect screen tells a person, per assistant: a sentence on what
 * the setup does, the steps in plain words, and the exact text to paste,
 * with their address and key filled in. Every command, file and menu here
 * was checked against that client's own documentation on 2026-10-18 (see
 * docs/MCP.md); a client we could not check says so instead of guessing.
 */

export type ClientId = "claude" | "chatgpt" | "gemini" | "claude-code" | "hermes";

export interface Snippet {
  /** What it is, for the copy button's accessible name: "the address", "the command". */
  label: string;
  text: string;
}

export interface Step {
  text: string;
  snippet?: Snippet;
  /** A link to open in this step (the bridge download). */
  link?: { href: string; label: string };
}

export interface Method {
  title: string;
  steps: Step[];
}

export interface ClientGuide {
  id: ClientId;
  name: string;
  /** One line: what this setup does. */
  what: string;
  /** The vendor reaches sintr from its own servers: sintr needs a public https address. */
  fromTheirServers: boolean;
  steps: Step[];
  /** How the person sees it worked. */
  check: string;
  /** Caveats in plain words: plans, regions, what we could not check. */
  notes: string[];
  /** A second way, when there is one worth knowing. */
  another?: Method;
}

/** Shown in the snippets until a key is made; never a real key. */
export const KEY_PLACEHOLDER = "YOUR_KEY";

export interface Endpoint {
  /** The app's own address, as people reach it (SINTR_URL). */
  appUrl: string;
  /** The key just made, or the placeholder. */
  key: string;
}

function trimmed(url: string): string {
  return url.replace(/\/+$/u, "");
}

export function mcpUrl(appUrl: string): string {
  return `${trimmed(appUrl)}/mcp`;
}

/** The address that carries the key, for clients that take only an address. */
export function keyedUrl({ appUrl, key }: Endpoint): string {
  return `${mcpUrl(appUrl)}/${key}`;
}

export function bridgeUrl(appUrl: string): string {
  return `${trimmed(appUrl)}/sintr-mcp.mjs`;
}

/**
 * True when only this computer (or this network) can reach the address, so
 * services that call sintr from their own servers cannot.
 */
export function onlyReachableHere(appUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(appUrl);
  } catch {
    return true;
  }
  if (url.protocol !== "https:") return true;
  const host = url.hostname.replace(/^\[|\]$/gu, "");
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "::1" ||
    /^127\./u.test(host) ||
    /^10\./u.test(host) ||
    /^192\.168\./u.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./u.test(host)
  );
}

export function claudeDesktopConfig({ appUrl, key }: Endpoint): string {
  return JSON.stringify(
    {
      mcpServers: {
        sintr: {
          command: "node",
          args: ["/path/to/sintr-mcp.mjs"],
          env: { SINTR_URL: trimmed(appUrl), SINTR_TOKEN: key },
        },
      },
    },
    null,
    2,
  );
}

export function claudeCodeCommand(endpoint: Endpoint): string {
  return `claude mcp add --transport http --scope user sintr ${mcpUrl(endpoint.appUrl)} --header "Authorization: Bearer ${endpoint.key}"`;
}

export function geminiCommand(endpoint: Endpoint): string {
  return `gemini mcp add -s user --transport http --header "Authorization: Bearer ${endpoint.key}" sintr ${mcpUrl(endpoint.appUrl)}`;
}

export function antigravityConfig(endpoint: Endpoint): string {
  return JSON.stringify(
    {
      mcpServers: {
        sintr: { serverUrl: mcpUrl(endpoint.appUrl), headers: { Authorization: `Bearer ${endpoint.key}` } },
      },
    },
    null,
    2,
  );
}

export function hermesCommand(endpoint: Endpoint): string {
  return `hermes mcp add sintr --url ${mcpUrl(endpoint.appUrl)} --auth header`;
}

export function hermesConfig(endpoint: Endpoint): string {
  return [
    "mcp_servers:",
    "  sintr:",
    `    url: "${mcpUrl(endpoint.appUrl)}"`,
    "    headers:",
    `      Authorization: "Bearer ${endpoint.key}"`,
  ].join("\n");
}

export function clientGuides(endpoint: Endpoint): ClientGuide[] {
  const address = { label: "the address", text: keyedUrl(endpoint) };
  return [
    {
      id: "claude",
      name: "Claude",
      what: "Adds sintr to Claude as a connector, on claude.ai and in the Claude app.",
      fromTheirServers: true,
      steps: [
        { text: "In Claude, open Customize, then Connectors." },
        { text: "Choose + Add, then Add custom connector. Name it sintr." },
        { text: "Paste this as the URL. It holds your key, so keep it to yourself.", snippet: address },
        {
          text: "When it asks how people sign in, choose No sign-in (some pages write No sign in), and add it.",
        },
      ],
      check:
        "In a new chat, choose the + button, then Connectors, and turn sintr on. Then ask: what did I write down in sintr this week?",
      notes: [
        "Free Claude accounts can add one custom connector.",
        "On a Team or Enterprise plan an owner adds connectors for everyone, so use the desktop file below instead: your key is yours alone.",
      ],
      another: {
        title: "Or, in the Claude desktop app, from a file (works with a sintr on this computer)",
        steps: [
          {
            text: "Download the bridge, a small program that passes messages between Claude and sintr. It needs Node.js 20 or newer on this computer.",
            link: { href: bridgeUrl(endpoint.appUrl), label: "Download sintr-mcp.mjs" },
          },
          {
            text: "In the Claude app, open Settings, then Developer, then Edit Config. On a Mac, Settings is in the Claude menu at the top of the screen. On Windows, the file is %APPDATA%\\Claude\\claude_desktop_config.json.",
          },
          {
            text: "Add this to the file, and change /path/to/sintr-mcp.mjs to where you saved the bridge. If the file already has mcpServers, add only the sintr part inside it.",
            snippet: { label: "the configuration", text: claudeDesktopConfig(endpoint) },
          },
          { text: "Quit Claude completely and open it again." },
        ],
      },
    },
    {
      id: "chatgpt",
      name: "ChatGPT",
      what: "Adds sintr to ChatGPT on chatgpt.com, as a custom app.",
      fromTheirServers: true,
      steps: [
        { text: "Open chatgpt.com/plugins, choose the plus button, then Add custom MCP server." },
        { text: "Name it sintr. Under Connection, paste this as the Server URL:", snippet: address },
        { text: "For authentication, choose No authentication." },
        { text: "Tick I understand and want to continue, then choose Create as a plugin." },
        { text: "Find sintr in your plugins and install it." },
      ],
      check: "Start a new conversation, type @ and choose sintr, then ask: what did I write down this week?",
      notes: [
        "OpenAI lists custom MCP servers for ChatGPT Business, Enterprise and Edu. If you do not see the option on your plan, check OpenAI's current help.",
        "ChatGPT cannot send a key on its own, so the key travels inside the address. Anyone with the address can use your diary: keep it private, and disconnect the key here if it leaks.",
      ],
    },
    {
      id: "gemini",
      name: "Gemini",
      what: "Adds sintr to Gemini CLI, Google's assistant in the terminal.",
      fromTheirServers: false,
      steps: [
        {
          text: "In a terminal, run:",
          snippet: { label: "the command", text: geminiCommand(endpoint) },
        },
        { text: "Start gemini and type /mcp: sintr is listed with what it can do." },
      ],
      check: "Ask Gemini: what did I write down in sintr this week?",
      notes: [
        "The Gemini app on gemini.google.com connects custom apps with a sign-in that sintr does not offer yet, so we could not check it works there. Check Google's current help before trying.",
      ],
      another: {
        title:
          "Or, in Antigravity CLI (Google moved free and Google One accounts there from Gemini CLI in June 2026)",
        steps: [
          {
            text: "Add this to ~/.gemini/config/mcp_config.json (inside mcpServers, if the file has it already):",
            snippet: { label: "the configuration", text: antigravityConfig(endpoint) },
          },
          { text: "Type /mcp to see sintr listed." },
        ],
      },
    },
    {
      id: "claude-code",
      name: "Claude Code",
      what: "Adds sintr to Claude Code, for every project on this computer.",
      fromTheirServers: false,
      steps: [
        {
          text: "In a terminal, run:",
          snippet: { label: "the command", text: claudeCodeCommand(endpoint) },
        },
        { text: "Run claude mcp list: sintr shows as connected. Inside Claude Code, /mcp shows it too." },
      ],
      check: "Ask Claude Code: what did I write down in sintr this week?",
      notes: [],
    },
    {
      id: "hermes",
      name: "Hermes",
      what: "Adds sintr to Hermes Agent.",
      fromTheirServers: false,
      steps: [
        {
          text: "In a terminal, run this, and paste your key when Hermes asks for it:",
          snippet: { label: "the command", text: hermesCommand(endpoint) },
        },
        {
          text: "Run hermes mcp test sintr to see that it connects. In a running session, /reload-mcp picks it up.",
        },
      ],
      check: "Ask Hermes: what did I write down in sintr this week?",
      notes: [],
      another: {
        title: "Or, in Hermes's configuration file",
        steps: [
          {
            text: "Add this to ~/.hermes/config.yaml (under mcp_servers, if the file has it already):",
            snippet: { label: "the configuration", text: hermesConfig(endpoint) },
          },
        ],
      },
    },
  ];
}

/** A client's name for itself (MCP clientInfo), as a person knows it. */
export function friendlyClient(name: string | null): string | null {
  if (!name) return null;
  if (/claude[\s_-]?code/iu.test(name)) return "Claude Code";
  if (/claude/iu.test(name)) return "Claude";
  if (/openai|chatgpt/iu.test(name)) return "ChatGPT";
  if (/antigravity/iu.test(name)) return "Antigravity";
  if (/gemini/iu.test(name)) return "Gemini";
  if (/hermes/iu.test(name)) return "Hermes";
  return name;
}

/** "just now", "4 minutes ago", "yesterday", "on 12 October". */
export function sinceText(at: Date, now: Date, timezone: string): string {
  const minutes = Math.floor((now.getTime() - at.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return minutes === 1 ? "a minute ago" : `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "an hour ago" : `${hours} hours ago`;
  if (hours < 48) return "yesterday";
  const sameYear =
    new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric" }).format(at) ===
    new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric" }).format(now);
  return `on ${new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(at)}`;
}

/** The one line that tells the person whether a key is alive. */
export function lastTalkedText(
  key: { lastUsedAt: Date | null; lastClient: string | null },
  now: Date,
  timezone: string,
): string {
  if (!key.lastUsedAt) return "Not used yet.";
  const client = friendlyClient(key.lastClient);
  return `Last talked to sintr ${sinceText(key.lastUsedAt, now, timezone)}${client ? `, from ${client}` : ""}.`;
}

export const ACCESS_COPY = {
  read_write: {
    label: "Read and save",
    hint: "It can look back at your recent days and save new entries and check-ins.",
  },
  write: {
    label: "Save only",
    hint: "It can save new entries and check-ins, and never reads your diary back.",
  },
  read: {
    label: "Read only",
    hint: "It can read your recent days and your therapy notes, and saves nothing.",
  },
} as const;
