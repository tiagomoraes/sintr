# sintr

**A private mood diary for the week between therapy sessions.**

sintr is a psychological self-tracking product. You write down what happened, it keeps it structured the way cognitive behavioural therapy taught us (thought records), keeps your therapy context, and turns the week into a short report you review and hand to your therapist only if you want to.

It ships in two forms, from the same codebase:

- **Self-host (open source, AGPL-3.0)**: run it on your own machine with Docker. Your data stays on your disk.
- **Hosted (SaaS)**: sign in, or connect the agent you already use over MCP.

There is no filesystem dependency: the ledger lives in Postgres, encrypted per person at the application layer.

> sintr is not therapy, a diagnosis or a crisis service. It is a documentation tool for work done in professional care. If you are in danger, call CVV 188 or SAMU 192 (Brazil), or your local emergency number.

## Where it is today

Milestones **F0, the foundation**, and **F1, capture** (see [`docs/PRODUCT.md`](docs/PRODUCT.md) for the milestones). What works:

- sign up (email, password and the health data consent) and sign in, with Argon2id passwords and sliding sessions;
- **talking to the assistant inside sintr**: tell it what happened, it acknowledges, asks a question or two and drafts a thought record in your own words, which you confirm, edit or discard. Nothing becomes an entry until you say so (the Confirm button, or "salva");
- **bring your own key**: an OpenAI-compatible endpoint (OpenAI, OpenRouter, a local Ollama or LiteLLM), Anthropic or Google, with the key encrypted like your diary and never shown again;
- **the crisis protocol**: a message that signals acute risk stops the diary and points to human help (CVV 188, SAMU 192), before any model is called;
- **quick check-ins** (mood, energy, anxiety, sleep, a note) without the conversation;
- **the timeline** of entries and check-ins, with a detail view; changing a saved record keeps a dated correction with what it said before;
- settings for the assistant, your time zone and how long conversations are kept;
- the full data model in Postgres, every sensitive field encrypted before it is stored, and tests that prove one person cannot read another's data;
- the self-host stack (Caddy, app, worker, Postgres) behind one command.

Not yet: the weekly report and its approved send (F2), the MCP server (F3), the hosted offer (F4), export, deletion and the audit view in the UI (F5). `packages/mcp` holds its typed contract only.

## Self-host

You need Docker with Compose and `make`.

```bash
git clone https://github.com/tiagomoraes/sintr-app.git
cd sintr-app
make selfhost-up
```

The first run writes `.env` with fresh secrets, builds the image and starts the stack. Open `http://localhost:3000`, create your account, and choose your assistant's provider and key in Settings. `make selfhost-down` stops it and keeps your data.

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
make help         # everything else
```

The app serves `http://localhost:3000`. Each checkout gets its own dev database container on `127.0.0.1`, at the port in `SINTR_DEV_DB_PORT`, so worktrees do not share data.

The assistant talks to the provider saved in Settings. To try the app without a key, set `SINTR_FAKE_AGENT=1` in `.env` and run `make dev`: replies then come from a scripted, offline assistant, and the page says so. `make test` always runs that way; no test reaches a real model.

## Repository

```
apps/
  web/        Next.js 15 (App Router): UI, API and auth routes
  worker/     background jobs (expired auth records, conversation retention);
              also the migration runner
packages/
  core/       domain (Zod), Postgres schema and migrations (Drizzle), envelope
              encryption, user-scoped repositories, Better Auth, the redacting logger
  ui/         the sintr design system: tokens, fonts, shadcn/ui components
  agent/      the embedded assistant: the capture conversation (Vercel AI SDK),
              bring-your-own-key providers, the crisis protocol, the checks
              that keep drafts in the person's words, an offline test model
  mcp/        the MCP contract (interfaces only)
docker/       the self-host stack (compose, Caddy) and the dev database
docs/         product, conventions, design, self-host, privacy, decisions
```

Conventions for anyone (or any agent) working here are in [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md); the visual system is [`docs/DESIGN.md`](docs/DESIGN.md); the trade-offs taken so far are in [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Privacy

Your ledger is sensitive personal data (health data under LGPD art. 11). Every free-text field is encrypted with a key that belongs to you alone before it reaches the database, nothing is written to logs, and nothing is sent to anyone without your explicit approval of that specific report. What is protected, how, and what is not done yet: [`docs/PRIVACY.md`](docs/PRIVACY.md).

## Licence

AGPL-3.0, see [LICENSE](LICENSE). The agent pack ([`tiagomoraes/sintr`](https://github.com/tiagomoraes/sintr)) stays MIT.
