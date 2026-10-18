# Connect your own assistant (MCP)

sintr has two ways in. You can talk to the assistant inside sintr (Talk), or you can keep using the assistant you already have (Claude, ChatGPT, Gemini, Hermes) and connect it to sintr. Then, when something happens, you tell your assistant; it drafts the entry with you, in your words, and keeps it in sintr once you say yes. The entry lands in the same encrypted diary and the same timeline as everything else.

The connection uses MCP, the Model Context Protocol, an open standard for giving an assistant tools. You do not need to know anything about it: the Connect screen in sintr walks you through it. This page is the reference behind that screen.

## In short

1. In sintr, open **Connect** and choose **Make a key**. The key is shown once; copy it.
2. Choose your assistant on the same screen and follow its steps. Your address and key are already filled in.
3. Ask your assistant something, for example "what did I write down in sintr this week?". The Connect screen then says **Connected** and when it last talked to sintr.

Each key belongs to one person and can be switched off at any time with **Disconnect**, on Connect or in Settings. What an assistant already saved stays in your diary.

## The key

- **What it may do.** By default a key may read and save. Under "Name it, or choose what it may do" you can make one that may only **save** (it records entries and check-ins and never reads your diary back) or only **read**. A key only sees the tools it may use.
- **Shown once.** sintr stores only a SHA-256 hash of the key. It is shown when you make it and never again; if you lose it, make a new one and disconnect the old one.
- **Alive or not.** Each key shows when its assistant last talked to sintr and which client it was ("Last talked to sintr 4 minutes ago, from Claude"). A key that was never used says so.
- **Recorded.** Making and disconnecting a key, and every entry or check-in an assistant saves, are written to the audit log with the key's id (never the key, never the words).
- **At most twenty** keys work at once per person.

## Setting up each assistant

Every command, file and menu below was checked against the client's own documentation on 2026-10-18 (sources at the end). Menus move; if a step looks different, the client's current help is the authority. Replace `https://diary.example.com` with your sintr's address and `YOUR_KEY` with your key; the Connect screen does both for you.

Two ways to send the key exist, and sintr accepts both:

- as a header, `Authorization: Bearer YOUR_KEY`, sent to `https://diary.example.com/mcp`. Use this whenever the client allows a header;
- inside the address, `https://diary.example.com/mcp/YOUR_KEY`, for clients that take only an address. The address is then a secret: anyone who has it can use your diary until you disconnect the key.

### Claude (claude.ai and the Claude app)

Claude adds remote servers as **custom connectors**. It reaches sintr from Anthropic's servers, so sintr needs a public `https` address.

1. In Claude, open **Customize**, then **Connectors**.
2. Choose **+ Add**, then **Add custom connector**. Name it `sintr`.
3. Paste `https://diary.example.com/mcp/YOUR_KEY` as the URL.
4. When it asks how people sign in, choose **No sign-in** (some of Anthropic's pages write "No sign in"), and add it.
5. In a new chat, choose the **+** button, then **Connectors**, and turn sintr on.

If your organisation has the **Request headers** section (in beta for some organisations), you can instead use `https://diary.example.com/mcp`, choose **No sign-in**, and add the header `authorization` with the value `Bearer YOUR_KEY`. Free Claude accounts can add one custom connector. On Team and Enterprise plans an owner adds connectors for the whole organisation, so a personal key does not belong there; use the desktop file below.

### Claude desktop app, from a file

This works with a sintr that only your computer can reach. It runs the sintr bridge (see below), which needs Node.js 20 or newer.

1. Download the bridge from your sintr: `https://diary.example.com/sintr-mcp.mjs`.
2. In the Claude app, open **Settings**, then **Developer**, then **Edit Config**. On a Mac, Settings is in the Claude menu in the menu bar. The file is `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS and `%APPDATA%\Claude\claude_desktop_config.json` on Windows.
3. Add the sintr server (inside `mcpServers` if the file already has it), with the path to where you saved the bridge:

```json
{
  "mcpServers": {
    "sintr": {
      "command": "node",
      "args": ["/path/to/sintr-mcp.mjs"],
      "env": {
        "SINTR_URL": "https://diary.example.com",
        "SINTR_TOKEN": "YOUR_KEY"
      }
    }
  }
}
```

4. Quit Claude completely and open it again.

We could not find Anthropic's wording for the Windows menu path; on Windows, opening the file directly always works.

### Claude Code

```bash
claude mcp add --transport http --scope user sintr https://diary.example.com/mcp --header "Authorization: Bearer YOUR_KEY"
```

`--scope user` makes it available in every project (the default, `local`, is the current project only). Check it with `claude mcp list` (sintr shows as connected) or `/mcp` inside Claude Code. The bridge works too:

```bash
claude mcp add --scope user --env SINTR_URL=https://diary.example.com --env SINTR_TOKEN=YOUR_KEY --transport stdio sintr -- node /path/to/sintr-mcp.mjs
```

### ChatGPT

ChatGPT adds remote servers as custom apps, from its servers, so sintr needs a public `https` address. It cannot send a key of its own, so the key goes inside the address.

1. Open [chatgpt.com/plugins](https://chatgpt.com/plugins), choose the plus button, then **Add custom MCP server**.
2. Name it `sintr`. Under **Connection**, paste `https://diary.example.com/mcp/YOUR_KEY` as the **Server URL**.
3. For authentication, choose **No authentication**.
4. Tick **I understand and want to continue**, then choose **Create as a plugin**.
5. Find sintr in your plugins and install it. In a new conversation, type `@` and choose sintr.

OpenAI's help lists custom MCP servers for ChatGPT Business, Enterprise and Edu (on Business, admins and owners create them). We found no statement for Plus or Pro; if you do not see the option, check OpenAI's current help. OpenAI's quickstart uses a Work chat for this; its guide only says to start a new conversation.

### Gemini

**Gemini CLI**, Google's assistant in the terminal:

```bash
gemini mcp add -s user --transport http --header "Authorization: Bearer YOUR_KEY" sintr https://diary.example.com/mcp
```

`-s user` keeps it for every folder (the default is the current project). Start `gemini` and type `/mcp`, or run `gemini mcp list`, to see it connected. The same entry by hand, in `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "sintr": {
      "httpUrl": "https://diary.example.com/mcp",
      "headers": { "Authorization": "Bearer YOUR_KEY" }
    }
  }
}
```

**Antigravity CLI.** Since 18 June 2026 Google moved unpaid and Google One accounts from Gemini CLI to Antigravity CLI. Add sintr to `~/.gemini/config/mcp_config.json`, then type `/mcp`:

```json
{
  "mcpServers": {
    "sintr": {
      "serverUrl": "https://diary.example.com/mcp",
      "headers": { "Authorization": "Bearer YOUR_KEY" }
    }
  }
}
```

**The Gemini app** (gemini.google.com) can add custom apps for some accounts (18 or over, in the US, in English), but its flow expects a sign-in that sintr does not offer yet. Not verified: check Google's current help before trying.

### Hermes

```bash
hermes mcp add sintr --url https://diary.example.com/mcp --auth header
```

Hermes asks for the key without showing it and keeps it in `~/.hermes/.env`. Or add it to `~/.hermes/config.yaml` yourself:

```yaml
mcp_servers:
  sintr:
    url: "https://diary.example.com/mcp"
    headers:
      Authorization: "Bearer YOUR_KEY"
```

Check it with `hermes mcp test sintr`; in a running session, `/reload-mcp` picks it up. For the bridge, use `command: "node"`, `args: ["/path/to/sintr-mcp.mjs"]` and an `env` block with `SINTR_URL` and `SINTR_TOKEN` (Hermes passes a stdio server only the environment you list).

### Any other MCP client

Point it at `https://diary.example.com/mcp` over Streamable HTTP with the header `Authorization: Bearer YOUR_KEY`, or start the bridge if it only runs local programs.

## A sintr only your computer can reach

A self-hosted sintr at `http://localhost:3000` works with the assistants that run on the same computer: Claude Code, Gemini CLI, Hermes and the Claude desktop app from a file (the key may travel over plain http to this computer only). Claude's connectors and ChatGPT call sintr from their own servers, so they need sintr at a public `https` address; [`SELFHOST.md`](SELFHOST.md) explains how to give it one. The Connect screen says which case you are in.

## The bridge

`sintr-mcp.mjs` is one small script, served by your sintr at `/sintr-mcp.mjs` and built from `packages/mcp/src/stdio.ts` (`make mcp-bridge` writes it to `packages/mcp/dist/`). It needs Node.js 20 or newer. It forwards each message between the client (stdin and stdout) and your sintr (HTTPS, with the key on every request); it reads no diary and keeps nothing.

It takes its settings from the environment, or from a file:

- `SINTR_URL`: the address of your sintr, such as `https://diary.example.com`;
- `SINTR_TOKEN`: the key;
- `SINTR_MCP_CONFIG`: a JSON file `{ "url": "...", "token": "..." }`; by default `~/.config/sintr/mcp.json` (or under `$XDG_CONFIG_HOME`). It warns if other users can read the file;
- `SINTR_ALLOW_HTTP=1`: let the key travel over plain http to another machine. Without it, http is refused except to this computer.

When sintr refuses a request (a wrong or switched-off key), the bridge answers the client with sintr's own message, so the client never waits for nothing.

## What your assistant can do

| Tool | What it does | Needs |
| --- | --- | --- |
| `recent_context` | The last days in short: each entry's date, title and emotions with intensities, each check-in's values, with ids. 1 to 14 days, at most 20 entries and 28 check-ins. | `entries:read` or `checkins:read` |
| `read_entry` | One entry in full, in your words. | `entries:read` |
| `save_entry` | Saves a thought record, after you said yes. | `entries:write` |
| `save_checkin` | Saves a check-in (mood, energy and anxiety from 0 to 5, sleep, a note), after you said yes. | `checkins:write` |
| `therapy_overview` | Your session schedule, when the next report will be prepared, your open goals, themes, tasks, what you want to bring up, and your last five session notes. Not your therapist's name or address. | `therapy:read` |
| `prepare_report` | The material of your next report: the period, its numbers, its entries in your words (at most 40), the check-in notes, what you want to bring up. It changes nothing and sends nothing. | `reports:read`, `entries:read`, `checkins:read` |

"Read and save" holds the four read scopes and the two write scopes; "Read only" the read ones; "Save only" the write ones.

**Nothing is sent to your therapist over MCP.** No tool can approve or send a report. You read, change, approve and send each report in the app, with one explicit yes for that report.

## How saving is checked

The two saving tools hold your assistant to exactly the rules of the assistant inside sintr (`packages/agent/src/rules.ts`):

- the assistant passes your own messages in `personWords`. Every thought, the strongest thought, the alternative thought and every emotion word must be found in them (forgiving case, spacing and quote styles), and what is stored is your exact wording, not the assistant's copy;
- every number (intensities, believability, the check-in scales, sleep) must be one you wrote;
- a time without an offset is read in your time zone, and a bare date is refused, since the time would be invented;
- `personConfirmed` must be `true`: the assistant has shown you the draft and you said to save it;
- a draft that breaks a rule is refused with reasons the assistant can act on, and nothing is saved.

**The crisis protocol comes first.** Your messages and the draft's words are screened by the same fixed patterns as in sintr (Portuguese, English, Spanish). If they signal acute risk, nothing is saved and sintr answers with `"crisis": true`, the fixed message in your language that points to CVV 188 and SAMU 192, and the instruction to stop the diary. `personWords` are read for these checks and dropped; they are not stored.

The confirmation itself happens in your assistant's conversation, which sintr cannot see. That is the difference from Talk, where the Confirm button or "salva" is checked by sintr; see [`DECISIONS.md`](DECISIONS.md).

## What your assistant is told

When it connects, the assistant receives sintr's instructions (the MCP `instructions`), condensed from the agent pack's skill: sintr is the record and the assistant keeps its own conversation; acknowledge first; ask narrowly, one or two questions at a time; keep your exact words for thoughts and emotions, in your language; scale, do not editorialise; never diagnose, label or advise treatment; show the draft and save only after your yes; never claim a save sintr did not confirm; use what sintr returns only in that conversation; nothing is sent to the therapist from there. And, first of all, the crisis protocol: if you signal acute risk, stop the diary, reply warmly in your language, and point to human help now (CVV 188, SAMU 192, or the local emergency number, and someone you trust).

The full text is in `packages/mcp/src/instructions.ts` and, in the app, under "Details for the technically curious" on Connect.

## Privacy: what leaves, what the assistant sees

- **What your assistant's provider receives.** Everything you say in that conversation, as always with that assistant, and what sintr answers its tools: your recent days in short, an entry it opens, your therapy schedule and notes, a period's entries when it helps you prepare. That provider's terms and retention apply to it, not sintr's. A "Save only" key means sintr answers nothing from your diary.
- **What sintr receives.** What the assistant asks to save, and your messages in `personWords` for the checks (not stored). What is saved is sealed with your own data key like everything else.
- **What stays out.** Your therapist's name and address, your reports' words (only the material, through `prepare_report`), your conversations in Talk, your provider key, other people's data.
- **The key.** Stored only as a hash; never logged, never shown again; sent as a header or inside the address. The address with the key is a secret: keep it out of shared documents and screenshots.
- **Logs.** A request is logged as its status, the key's id and the time it took; a tool call as its name and outcome. Never the key, the address with the key, or any word.
- **Your consent.** The endpoint refuses every call until the account holds the current consent to process health data, as every page does.

## Technical reference

- **Endpoint.** `POST /mcp` and `POST /mcp/{key}`, MCP over Streamable HTTP in stateless mode with JSON responses (`@modelcontextprotocol/sdk` 1.32). No session id, no server-sent stream: `GET`, `DELETE` and anything else answer `405`. Each request runs a fresh server for its key's owner, inside that person's scope.
- **Authentication.** The key is the only credential. A missing, wrong, revoked or expired key answers `401` with `WWW-Authenticate: Bearer realm="sintr"`. Cookies are never read. A request with an `Origin` header other than sintr's own is refused (`403`), and no CORS headers are sent, so no web page can call it. sintr does not offer OAuth yet.
- **Limits, per web process.** 120 calls a minute per key, 20 wrong keys a minute per address (then `429` with `Retry-After`), 1 MB per request (`413`).
- **Consent.** `403` until the current health data consent is on record.
- **Errors.** A refused tool call answers `isError: true` with `problems` that name fields and rules, never values. A failure inside sintr answers a plain sentence and logs a code.
- **Annotations.** Reads carry `readOnlyHint: true`; the saves `readOnlyHint: false` and `destructiveHint: false`; all `openWorldHint: false`.
- **Code.** `packages/mcp` (server, tools, instructions, HTTP handler, bridge), mounted by `apps/web/app/mcp`. Tests in `packages/mcp/test` and `apps/web/e2e/connect.spec.ts`.

## Sources checked on 2026-10-18

| Client | What was checked | Source |
| --- | --- | --- |
| Claude, connectors | Customize, Connectors, Add custom connector, No sign-in, Request headers (beta), plans, + then Connectors in a chat | [support.claude.com 11175166](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp), [claude.com/docs/connectors](https://claude.com/docs/connectors/custom/add-unlisted) |
| Claude desktop, file | Settings, Developer, Edit Config; file paths; `mcpServers` with `command`, `args`, `env`; quit and reopen | [modelcontextprotocol.io, local servers](https://modelcontextprotocol.io/docs/develop/connect-local-servers) |
| Claude Code | `claude mcp add --transport http ... --header`, `--env`, `--`, scopes, `claude mcp list` | [code.claude.com/docs/en/mcp](https://code.claude.com/docs/en/mcp) |
| ChatGPT | Plugins, Add custom MCP server, Server URL, No authentication, no custom key, plans | [OpenAI custom MCP guide](https://developers.openai.com/api/docs/guides/custom-mcp-server), [OpenAI help 12584461](https://help.openai.com/en/articles/12584461) |
| Gemini CLI | `httpUrl`, `headers`, `gemini mcp add`, `-s user`, `/mcp` | [gemini-cli MCP docs](https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md) |
| Antigravity CLI | `~/.gemini/config/mcp_config.json`, `mcpServers`, `serverUrl`, `headers` | [antigravity.google/docs/mcp](https://antigravity.google/docs/mcp?tab=cli) |
| Gemini app | custom apps, requirements | [Google help 17209137](https://support.google.com/gemini/answer/17209137) |
| Hermes | `mcp_servers` with `url` and `headers`, `hermes mcp add --url --auth header`, `hermes mcp test`, `/reload-mcp` | [NousResearch/hermes-agent, MCP docs](https://github.com/NousResearch/hermes-agent) |

Not verified: the Windows menu wording of the Claude desktop app, ChatGPT on Plus and Pro, and the Gemini app with a server that has no sign-in.
