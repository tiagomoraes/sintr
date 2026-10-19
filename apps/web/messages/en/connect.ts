/**
 * Your other assistants (Connect): keep the diary from the assistant you
 * already talk to, over MCP. Keys, each client's steps and the technical
 * details. Menus and buttons of other products are named as their English
 * screens name them; commands, files, addresses and keys are never words.
 */
export const connect = {
  title: "Your other assistants",
  lede: "If you already talk to ChatGPT, Claude, Gemini or Hermes, they can keep your diary here: tell them what happened, and once you say yes, the entry is kept in sintr, in your words.",
  instead: "Rather not set anything up?",
  insteadLink: "Speak or write on your home",
  insteadAfter: "instead.",
  /** The keys that work, above the setup. */
  connected: "Your assistants",
  how: {
    label: "How it works",
    make: {
      title: "Make a key",
      text: "A private key that lets one assistant reach your diary. You can switch it off at any time.",
    },
    give: {
      title: "Give it to your assistant",
      text: "Choose your assistant below and copy what it needs. It takes a minute or two.",
    },
    talk: {
      title: "Talk as usual",
      text: "When something happens, tell your assistant. It drafts the entry with you and keeps it here once you say yes.",
    },
  },
  heading: {
    made: "Your new key",
    another: "Connect another assistant",
    first: "Connect an assistant",
  },
  make: {
    button: "Make a key",
    making: "Making your key",
    more: "Name it, or choose what it may do",
    name: "Name",
    optional: "(optional)",
    placeholder: "For example, Claude on my laptop",
    hint: "So you can tell your keys apart later.",
    access: "What it may do",
  },
  /** What a key may do, by its access in the core (API_TOKEN_ACCESS). */
  access: {
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
  },
  /** A key made without a name is called this, then "My assistant 2", and is kept so. */
  defaultName: "My assistant",
  problems: {
    access: "Choose what your assistant may do.",
    tooMany: (max: number) =>
      `You already have ${max} keys. Disconnect one you no longer use, then make a new one.`,
  },
  /** The key just made, shown once. */
  panel: {
    for: (name: string) => `For ${name}`,
    /** For the copy button: "Copy your key". */
    key: "your key",
    copyNow: "Copy it now: sintr shows it only this once. If you lose it, make a new one.",
    filled: "It is already filled in the steps below.",
    /** `last` is the key's `keys.lastTalked`. */
    connected: (last: string) => `Connected. ${last}`,
    waiting:
      "Waiting for your assistant. Once you finish the steps below, ask it something, and this line changes when it reaches sintr.",
    hide: "I saved it, hide the key",
  },
  setup: {
    title: "Give it to your assistant",
    made: "Your address and key are filled in. Copy each piece where the steps say.",
    /** `placeholder` is what the steps show until a key is made (YOUR_KEY). */
    waiting: (placeholder: string) =>
      `Make a key above and it is filled in here; until then these steps show ${placeholder} in its place.`,
    choose: "Your assistant",
    check: "To check it worked: ",
    /** For a client that calls from its own servers, when this sintr has no public address. */
    blocked: (name: string, address: string) =>
      `${name} reaches sintr from its own servers, and this sintr is at ${address}, which only this computer or network can reach. It needs a public https address first (the self-host guide explains how).`,
    fromFile: "The way below, from a file, works from this computer now.",
  },
  /** What a snippet is: the copy button's name ("Copy the address") and the caption above it. */
  snippets: {
    address: { label: "the address", caption: "Address" },
    command: { label: "the command", caption: "Command" },
    configuration: { label: "the configuration", caption: "Configuration" },
    endpoint: { label: "the endpoint", caption: "Endpoint" },
  },
  download: "Download sintr-mcp.mjs",
  /**
   * Each client's setup, checked against its own documentation (docs/MCP.md).
   * Menus and buttons are named as the product's English screens name them.
   */
  guides: {
    terminal: "In a terminal, run:",
    claude: {
      what: "Adds sintr to Claude as a connector, on claude.ai and in the Claude app.",
      customize: "In Claude, open Customize, then Connectors.",
      add: "Choose + Add, then Add custom connector. Name it sintr.",
      url: "Paste this as the URL. It holds your key, so keep it to yourself.",
      signIn: "When it asks how people sign in, choose No sign-in (some pages write No sign in), and add it.",
      check:
        "In a new chat, choose the + button, then Connectors, and turn sintr on. Then ask: what did I write down in sintr this week?",
      free: "Free Claude accounts can add one custom connector.",
      team: "On a Team or Enterprise plan an owner adds connectors for everyone, so use the desktop file below instead: your key is yours alone.",
      desktop: "Or, in the Claude desktop app, from a file (works with a sintr on this computer)",
      bridge:
        "Download the bridge, a small program that passes messages between Claude and sintr. It needs Node.js 20 or newer on this computer.",
      config:
        "In the Claude app, open Settings, then Developer, then Edit Config. On a Mac, Settings is in the Claude menu at the top of the screen. On Windows, the file is %APPDATA%\\Claude\\claude_desktop_config.json.",
      file: "Add this to the file, and change /path/to/sintr-mcp.mjs to where you saved the bridge. If the file already has mcpServers, add only the sintr part inside it.",
      restart: "Quit Claude completely and open it again.",
    },
    chatgpt: {
      what: "Adds sintr to ChatGPT on chatgpt.com, as a custom app.",
      open: "Open chatgpt.com/plugins, choose the plus button, then Add custom MCP server.",
      url: "Name it sintr. Under Connection, paste this as the Server URL:",
      auth: "For authentication, choose No authentication.",
      create: "Tick I understand and want to continue, then choose Create as a plugin.",
      install: "Find sintr in your plugins and install it.",
      check: "Start a new conversation, type @ and choose sintr, then ask: what did I write down this week?",
      plans:
        "OpenAI lists custom MCP servers for ChatGPT Business, Enterprise and Edu. If you do not see the option on your plan, check OpenAI's current help.",
      address:
        "ChatGPT cannot send a key on its own, so the key travels inside the address. Anyone with the address can use your diary: keep it private, and disconnect the key here if it leaks.",
    },
    gemini: {
      what: "Adds sintr to Gemini CLI, Google's assistant in the terminal.",
      list: "Start gemini and type /mcp: sintr is listed with what it can do.",
      check: "Ask Gemini: what did I write down in sintr this week?",
      app: "The Gemini app on gemini.google.com connects custom apps with a sign-in that sintr does not offer yet, so we could not check it works there. Check Google's current help before trying.",
      antigravity:
        "Or, in Antigravity CLI (Google moved free and Google One accounts there from Gemini CLI in June 2026)",
      file: "Add this to ~/.gemini/config/mcp_config.json (inside mcpServers, if the file has it already):",
      listed: "Type /mcp to see sintr listed.",
    },
    claudeCode: {
      what: "Adds sintr to Claude Code, for every project on this computer.",
      list: "Run claude mcp list: sintr shows as connected. Inside Claude Code, /mcp shows it too.",
      check: "Ask Claude Code: what did I write down in sintr this week?",
    },
    hermes: {
      what: "Adds sintr to Hermes Agent.",
      run: "In a terminal, run this, and paste your key when Hermes asks for it:",
      test: "Run hermes mcp test sintr to see that it connects. In a running session, /reload-mcp picks it up.",
      check: "Ask Hermes: what did I write down in sintr this week?",
      config: "Or, in Hermes's configuration file",
      file: "Add this to ~/.hermes/config.yaml (under mcp_servers, if the file has it already):",
    },
  },
  /** The keys that still work, here and in Settings. */
  keys: {
    label: "Connected assistants",
    /** `access` is one of the access labels, `made` a day, `prefix` the key's first characters. */
    meta: (access: string, made: string, prefix: string) =>
      `${access}. Made on ${made}. Starts with ${prefix}.`,
    after:
      "Disconnecting switches a key off at once. What the assistant already saved stays in your diary, and you can connect it again with a new key.",
    disconnect: "Disconnect",
    disconnecting: "Disconnecting",
    /** The button's accessible name, with the key's name. */
    disconnectName: (name: string) => `Disconnect ${name}`,
    /** A key whose scopes match none of the accesses: its scopes, as they are. */
    canUse: (scopes: string) => `Can use: ${scopes}`,
    notUsed: "Not used yet.",
    /** `since` is one of `since` below, `client` the assistant's name as a person knows it. */
    lastTalked: (since: string, client: string | null) =>
      `Last talked to sintr ${since}${client ? `, from ${client}` : ""}.`,
    since: {
      justNow: "just now",
      minute: "a minute ago",
      minutes: (n: number) => `${n} minutes ago`,
      hour: "an hour ago",
      hours: (n: number) => `${n} hours ago`,
      yesterday: "yesterday",
      /** `day` is "12 October", or "12 October 2025" in another year. */
      on: (day: string) => `on ${day}`,
    },
  },
  /** The copy button. `label` is what it copies, with its article ("the address"). */
  copy: {
    copy: "Copy",
    copied: "Copied",
    copyLabel: (label: string) => `Copy ${label}`,
    copiedLabel: (label: string) => `Copied ${label}`,
    copiedStatus: (label: string) => `Copied ${label}.`,
    failed: "Select it and copy it by hand.",
  },
  /** For the technical reader, out of everyone else's way. Code stays code. */
  technical: {
    summary: "Details for the technically curious",
    endpoint: {
      term: "The endpoint",
      body: "sintr is an MCP server over Streamable HTTP. It is stateless: every request is a POST answered with JSON, with no session and no event stream.",
    },
    /** Around two pieces of code: the header, then the address that ends with the key. */
    key: {
      term: "The key",
      before: "Send it as",
      middle: ". Clients that take only an address can put it at the end instead (",
      after:
        "); the address is then a secret. The key is the only credential: cookies are never read there, and a browser on another site is refused. sintr stores only a SHA-256 hash of it.",
    },
    /** Around four pieces of code: SINTR_URL, SINTR_TOKEN, the JSON and its file. */
    bridge: {
      term: "From a program on your computer",
      before:
        "For clients that start servers as local programs, the bridge forwards stdio to the endpoint with your key. It needs Node.js 20 or newer; set",
      and: "and",
      or: ", or put",
      in: "in",
      after: ". Over plain http it talks only to this computer.",
    },
    tools: {
      term: "What your assistant can do",
      /** `scopes` is the scopes a tool needs, joined with ", " or with `or`. */
      needs: (scopes: string) => `Needs ${scopes}.`,
      or: " or ",
      after: "A key that may only read, or only save, does not even see the other tools.",
    },
    told: {
      term: "What your assistant is told",
      body: "When it connects, it receives these instructions, from the same rules as the assistant inside sintr. What it saves is checked against your own words before it is kept.",
    },
    leaves: {
      term: "What leaves this diary",
      body: "Your assistant's provider receives what you tell it, and what sintr answers its tools: your recent days, an entry it opens, your therapy schedule and notes, a period's entries when it helps you prepare. That provider's terms apply to it. Nothing is ever sent to your therapist from an assistant; reports are approved and sent here.",
      guide: "The full guide, with every client",
    },
  },
} as const;
