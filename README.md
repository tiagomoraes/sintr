# sintr

**A private mood diary for the week between therapy sessions.**

sintr is a psychological self-tracking product. You write down what happened, it keeps it structured the way cognitive behavioural therapy taught us (thought records), keeps your therapy context, and turns the week into a short report you review and hand to your therapist only if you want to.

It ships in two forms, from the same codebase:

- **Self-host (open source, AGPL-3.0)**: run it on your own machine with Docker. Your data stays on your disk.
- **Hosted (SaaS)**: sign in, or connect the agent you already use over MCP.

There is no filesystem dependency: the ledger lives in Postgres, encrypted per person at the application layer.

> sintr is not therapy, a diagnosis or a crisis service. It is a documentation tool for work done in professional care. If you are in danger, call CVV 188 or SAMU 192 (Brazil), or your local emergency number.

## Where it is today

Milestones **F0, the foundation**, **F1, capture**, **F2, the weekly report**, **F3, connect your agent**, **F4, the therapist**, and **F5, the house model and the plan** (see [`docs/PRODUCT.md`](docs/PRODUCT.md) for the milestones). What works:

- sign up (email, password and the health data consent) and sign in, with Argon2id passwords and sliding sessions;
- **talking to the assistant inside sintr**: tell it what happened, it acknowledges, asks a question or two and drafts a thought record in your own words, which you confirm, edit or discard. Nothing becomes an entry until you say so (the Confirm button, or "salva");
- **the house assistant**: an installation can run on its own provider, model and key (`SINTR_HOUSE_*`), so a new person signs up, talks and gets a report without ever opening Settings; Settings says the assistant is included and who receives the words;
- **bring your own key**, behind a small door in Settings ("Use your own key instead"), or as the way in on a self-host without a house assistant: an OpenAI-compatible endpoint (OpenAI, OpenRouter, a local Ollama or LiteLLM), Anthropic or Google, with the key encrypted like your diary and never shown again, and nothing of it counted toward a plan;
- **plans**: Free (100 messages with the assistant and 4 reports written by it a month) and Personal (600 and 12) for a person, seats for a practice, with a calm plan screen that says what you have and what you used this month. At the limit nothing is lost: what you write is kept as a draft entry in your words, check-ins and the report keep working, and the help lines never depend on a plan. Plans are given by configuration and `make person-plan`, or bought through Stripe once it is configured ([`docs/OPS.md`](docs/OPS.md));
- **the crisis protocol**: a message that signals acute risk stops the diary and points to human help (CVV 188, SAMU 192), before any model is called;
- **quick check-ins** (mood, energy, anxiety, sleep, a note) without the conversation;
- **the timeline** of entries and check-ins, with a detail view; changing a saved record keeps a dated correction with what it said before;
- **your therapy**: the day and time of your sessions in your time zone, a one-off date when a session moves, your therapist's name and email, and whether an approved report is sent or kept for you;
- **the weekly report**: prepared an hour (or the lead you choose) before each session, covering exactly the days since the last one. It has the six sections of the pack's guide (how the week went, what to bring to the session, mood, energy and sleep with a chart of the last weeks, the moments that stood out, what repeated, what helped), written by your assistant in your language, with your own words quoted exactly as recorded and checked against your diary;
- an example of what a therapist receives, from a fictional diary in Portuguese: [`docs/example-report.pdf`](docs/example-report.pdf);
- **read, change, approve, send**: you read the report as a page, change its words, preview the PDF, and approve it; a second, explicit yes sends that PDF to your therapist by email, recorded with the date and the address. Nothing is ever sent on its own, and the PDFs of past reports stay available;
- **email** (optional, any SMTP server): the approved report to your therapist, a "report ready" note to you if you ask for it, password reset and email confirmation;
- **connect the assistant you already use** (Claude, ChatGPT, Gemini, Claude Code, Hermes) over MCP: make a key on the Connect screen (shown once, read and save, save only or read only), follow your assistant's steps with your address and key filled in, and see when it last talked to sintr. It records entries and check-ins held to the same rules as the assistant inside sintr (your exact words, only your numbers, the crisis protocol first), reads your recent days when it helps, and helps you prepare for a session; it can never send anything to your therapist. Disconnect a key with one click. See [`docs/MCP.md`](docs/MCP.md);
- **give your therapist access** (Sharing, "who can see what you write"): accept your therapist's invite, or invite them; they read only the reports you approve, never drafts, entries, check-ins or conversations. Choose "ask me each time" or "send what I approve", see when they opened a report, and stop sharing in one action, which ends their access at once;
- **a practice for therapists**, on the same kind of account: invite patients by code or link (or accept a patient's invite), read the reports they share in place, download the PDF, disconnect. One calm dashboard with plain counts and nothing computed across patients. Seats come from configuration (unlimited on a self-host, `make practice-plan` for one practice); every step needs both sides' yes, is audited in both accounts, and what travels through a link is sealed with the link's own key, destroyed when it ends;
- settings for the assistant, your time zone and how long conversations are kept;
- the full data model in Postgres, every sensitive field encrypted before it is stored, and tests that prove one person cannot read another's data;
- the self-host stack (Caddy, app, worker, Postgres) behind one command.

Not yet: real charges (Stripe is written and off until configured; [`docs/OPS.md`](docs/OPS.md) lists what is missing), the public landing page, export, deletion and the audit view in the UI, and OAuth for MCP clients.

## Self-host

You need Docker with Compose and `make`.

```bash
git clone https://github.com/tiagomoraes/sintr-app.git
cd sintr-app
make selfhost-up
```

The first run writes `.env` with fresh secrets, builds the image and starts the stack. Open `http://localhost:3000`, create your account, and choose your assistant's provider and key in Settings (or give the installation a house assistant in `.env`: see [`docs/SELFHOST.md`](docs/SELFHOST.md)). To send reports by email, fill in the `SINTR_SMTP_*` lines of `.env` and run `make selfhost-up` again. `make selfhost-down` stops it and keeps your data.

Back up `SINTR_MASTER_KEY` from `.env` somewhere other than the database backup: without it nothing can be read, and with it next to the database the encryption protects nothing. [`docs/SELFHOST.md`](docs/SELFHOST.md) covers a public domain with TLS, closing sign-up, backups and upgrades.

## Development

You need Node 22, pnpm (installed by `make setup` if missing), Docker and `make`. `make` is the only interface:

```bash
make setup        # install dependencies, write .env with fresh secrets, fetch the test browser
make dev          # start the dev database, migrate, run the web app and the worker
make test         # unit, integration and end-to-end tests against a real Postgres
make lint         # ESLint, Prettier and the copy rules (no dashes, no emoji)
make typecheck    # TypeScript, strict, in every package
make build        # production builds of the web app and the worker
make migrate      # apply migrations to the dev database
make db-generate  # write a new SQL migration after a schema change (NAME=...)
make report-assets # re-embed the report's fonts and light after changing them
make mcp-bridge   # bundle the stdio bridge for local MCP clients (also part of make build)
make practice-plan EMAIL=... SEATS=10  # give one practice its seats (unlimited by default on a self-host)
make person-plan EMAIL=... PLAN=personal  # give one person a plan (with a house assistant)
make help         # everything else
```

The app serves `http://localhost:3000`. Each checkout gets its own dev database container on `127.0.0.1`, at the port in `SINTR_DEV_DB_PORT`, so worktrees do not share data.

The assistant talks to the provider saved in Settings, or to the house assistant when `SINTR_HOUSE_*` is set. To try the app without a key, set `SINTR_FAKE_AGENT=1` in `.env` and run `make dev`: replies (and reports) then come from a scripted, offline assistant, and the page says so. `make test` always runs that way; no test reaches a real model, Stripe or a mail server: email goes to an in-memory transport or an outbox directory, payments to a fake Stripe on the machine, and the report PDF is printed by the Chromium that `make setup` installs.

## Repository

```
apps/
  web/        Next.js 15 (App Router): UI, API and auth routes, the MCP
              endpoint and the Connect screen, Sharing, the invite page
              and the practice dashboard
  worker/     background jobs: the report before each session (every minute,
              from each person's schedule), the practices' report notice,
              expired auth records, conversation retention, stale invites;
              also the migration runner and the seats admin path
packages/
  core/       domain (Zod), Postgres schema and migrations (Drizzle), envelope
              encryption, user-scoped repositories, Better Auth, the redacting
              logger, the report (periods, digest, checks, the document and its
              PDF), the email transport, practices, invites, links and sharing,
              plans, the assistant's monthly meter and payments (Stripe)
  ui/         the sintr design system: tokens, fonts, shadcn/ui components
  agent/      the embedded assistant: the capture conversation and the report
              writer (Vercel AI SDK), bring-your-own-key providers, the crisis
              protocol, the checks that keep drafts in the person's words, the
              choice between the house assistant and the person's key, the
              monthly meter, an offline test model and a fake endpoint
  mcp/        the MCP server: six tools, the instructions given to a connected
              agent, the stateless HTTP endpoint the app mounts at /mcp,
              and the stdio bridge for local clients (sintr-mcp.mjs)
docker/       the self-host stack (compose, Caddy) and the dev database
docs/         product, conventions, design, self-host, operations, privacy,
              decisions
```

Conventions for anyone (or any agent) working here are in [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md); the visual system is [`docs/DESIGN.md`](docs/DESIGN.md); the trade-offs taken so far are in [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Privacy

Your ledger is sensitive personal data (health data under LGPD art. 11). Every free-text field is encrypted with a key that belongs to you alone before it reaches the database, nothing is written to logs, and nothing is sent to anyone without your explicit approval of that specific report. What is protected, how, and what is not done yet: [`docs/PRIVACY.md`](docs/PRIVACY.md).

## Licence

AGPL-3.0, see [LICENSE](LICENSE). The agent pack ([`tiagomoraes/sintr`](https://github.com/tiagomoraes/sintr)) stays MIT.
