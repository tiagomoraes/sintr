import type { ApiTokenAccess } from "@sintr/core";
import { intlOf } from "@/lib/format";
import type { Messages } from "@/messages";

/**
 * What the Connect screen tells a person, per assistant: a sentence on what
 * the setup does, the steps in plain words, and the exact text to paste,
 * with their address and key filled in. Every command, file and menu here
 * was checked against that client's own documentation on 2026-10-18 (see
 * docs/MCP.md); a client we could not check says so instead of guessing.
 * The words are the page's (`connect.guides`); the commands, files and
 * addresses are the same in every language.
 */

export type ClientId = "claude" | "chatgpt" | "gemini" | "claude-code" | "hermes";

export interface Snippet {
  /** What it is, for the copy button's accessible name: "the address", "the command". */
  label: string;
  /** The same, above the text: "Address", "Command". */
  caption: string;
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

export function clientGuides(endpoint: Endpoint, t: Messages): ClientGuide[] {
  const { guides: g, snippets } = t.connect;
  const address = { ...snippets.address, text: keyedUrl(endpoint) };
  const command = (text: string) => ({ ...snippets.command, text });
  const configuration = (text: string) => ({ ...snippets.configuration, text });
  return [
    {
      id: "claude",
      name: "Claude",
      what: g.claude.what,
      fromTheirServers: true,
      steps: [
        { text: g.claude.customize },
        { text: g.claude.add },
        { text: g.claude.url, snippet: address },
        { text: g.claude.signIn },
      ],
      check: g.claude.check,
      notes: [g.claude.free, g.claude.team],
      another: {
        title: g.claude.desktop,
        steps: [
          {
            text: g.claude.bridge,
            link: { href: bridgeUrl(endpoint.appUrl), label: t.connect.download },
          },
          { text: g.claude.config },
          { text: g.claude.file, snippet: configuration(claudeDesktopConfig(endpoint)) },
          { text: g.claude.restart },
        ],
      },
    },
    {
      id: "chatgpt",
      name: "ChatGPT",
      what: g.chatgpt.what,
      fromTheirServers: true,
      steps: [
        { text: g.chatgpt.open },
        { text: g.chatgpt.url, snippet: address },
        { text: g.chatgpt.auth },
        { text: g.chatgpt.create },
        { text: g.chatgpt.install },
      ],
      check: g.chatgpt.check,
      notes: [g.chatgpt.plans, g.chatgpt.address],
    },
    {
      id: "gemini",
      name: "Gemini",
      what: g.gemini.what,
      fromTheirServers: false,
      steps: [{ text: g.terminal, snippet: command(geminiCommand(endpoint)) }, { text: g.gemini.list }],
      check: g.gemini.check,
      notes: [g.gemini.app],
      another: {
        title: g.gemini.antigravity,
        steps: [
          { text: g.gemini.file, snippet: configuration(antigravityConfig(endpoint)) },
          { text: g.gemini.listed },
        ],
      },
    },
    {
      id: "claude-code",
      name: "Claude Code",
      what: g.claudeCode.what,
      fromTheirServers: false,
      steps: [
        { text: g.terminal, snippet: command(claudeCodeCommand(endpoint)) },
        { text: g.claudeCode.list },
      ],
      check: g.claudeCode.check,
      notes: [],
    },
    {
      id: "hermes",
      name: "Hermes",
      what: g.hermes.what,
      fromTheirServers: false,
      steps: [{ text: g.hermes.run, snippet: command(hermesCommand(endpoint)) }, { text: g.hermes.test }],
      check: g.hermes.check,
      notes: [],
      another: {
        title: g.hermes.config,
        steps: [{ text: g.hermes.file, snippet: configuration(hermesConfig(endpoint)) }],
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

/** The page's language (a catalog's code or an Intl tag) and the person's time zone. */
export interface Locale {
  language: string;
  timezone: string;
}

/** "just now", "4 minutes ago", "yesterday", "on 12 October", in the page's language. */
export function sinceText(at: Date, now: Date, locale: Locale, t: Messages): string {
  const since = t.connect.keys.since;
  const minutes = Math.floor((now.getTime() - at.getTime()) / 60_000);
  if (minutes < 1) return since.justNow;
  if (minutes < 60) return minutes === 1 ? since.minute : since.minutes(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? since.hour : since.hours(hours);
  if (hours < 48) return since.yesterday;
  const intl = intlOf(locale.language);
  const year = (date: Date) =>
    new Intl.DateTimeFormat(intl, { timeZone: locale.timezone, year: "numeric" }).format(date);
  const sameYear = year(at) === year(now);
  return since.on(
    new Intl.DateTimeFormat(intl, {
      timeZone: locale.timezone,
      day: "numeric",
      month: "long",
      ...(sameYear ? {} : { year: "numeric" }),
    }).format(at),
  );
}

/** The one line that tells the person whether a key is alive. */
export function lastTalkedText(
  key: { lastUsedAt: Date | null; lastClient: string | null },
  now: Date,
  locale: Locale,
  t: Messages,
): string {
  if (!key.lastUsedAt) return t.connect.keys.notUsed;
  return t.connect.keys.lastTalked(sinceText(key.lastUsedAt, now, locale, t), friendlyClient(key.lastClient));
}

/**
 * The accesses a key can be made with, in the order the form offers them:
 * the one that reads nothing first, then the one that also reads, then the
 * one that saves nothing. None is chosen for the person. Their words are
 * `connect.access`.
 */
export const ACCESS_ORDER = ["write", "read_write", "read"] as const satisfies readonly ApiTokenAccess[];

/**
 * The assistant a key's name speaks of ("Claude on my phone", "ChatGPT at
 * work"), so its steps open first once the key is made; null when it names
 * none of them.
 */
export function clientNamed(name: string): ClientId | null {
  if (/claude[\s_-]?code/iu.test(name)) return "claude-code";
  if (/claude/iu.test(name)) return "claude";
  if (/chat\s?gpt|openai/iu.test(name)) return "chatgpt";
  if (/gemini|antigravity/iu.test(name)) return "gemini";
  if (/hermes/iu.test(name)) return "hermes";
  return null;
}

/** Days without a word from its assistant (or since it was made) after which the list points a key out. */
export const QUIET_AFTER_DAYS = 60;

/** A key that has not talked to sintr for a long while, counted from when it was made if it never did. */
export function isQuiet(key: { lastUsedAt: Date | null; createdAt: Date }, now: Date): boolean {
  const since = key.lastUsedAt ?? key.createdAt;
  return now.getTime() - since.getTime() > QUIET_AFTER_DAYS * 86_400_000;
}
