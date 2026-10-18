# sintr

**A private mood diary for the week between therapy sessions.**

sintr is a psychological self-tracking product. You write down what happened, it keeps it structured the way cognitive behavioural therapy taught us (thought records), keeps your therapy context, and turns the week into a short report you review and hand to your therapist only if you want to.

It ships in two forms, from the same codebase:

- **Self-host (open source, AGPL-3.0)**: run it on your own machine with Docker. Your data stays on your disk.
- **Hosted (SaaS)**: sign in, or connect the agent you already use over MCP.

There is no filesystem dependency: the ledger lives in Postgres, encrypted per person at the application layer.

> sintr is not therapy, a diagnosis or a crisis service. It is a documentation tool for work done in professional care. If you are in danger, call CVV 188 or SAMU 192 (Brazil), or your local emergency number.

## Where it is today

This is milestone **F0, the foundation** (see [`docs/PRODUCT.md`](docs/PRODUCT.md) for the milestones). What works:

- sign up (email, password and the health data consent) and sign in, with Argon2id passwords and sliding sessions;
- the authenticated shell with calm, empty sections for entries, check-ins, therapy and reports;
- the full data model in Postgres, with every sensitive field encrypted before it is stored;
- user-scoped data access, with tests that prove one person cannot read another's data;
- the self-host stack (Caddy, app, worker, Postgres) behind one command.

Not yet: writing entries and check-ins with the embedded agent (F1), the weekly report and its approved send (F2), the MCP server (F3), the hosted offer (F4), export, deletion and retention in the UI (F5). `packages/mcp` and `packages/agent` hold their typed contracts only.

## Self-host

You need Docker with Compose and `make`.

```bash
git clone https://github.com/tiagomoraes/sintr-app.git
cd sintr-app
make selfhost-up
```

The first run writes `.env` with fresh secrets, builds the image and starts the stack. Open `http://localhost:3000` and create your account. `make selfhost-down` stops it and keeps your data.

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

## Repository

```
apps/
  web/        Next.js 15 (App Router): UI, API and auth routes
  worker/     background jobs (F0: expired auth records); also the migration runner
packages/
  core/       domain (Zod), Postgres schema and migrations (Drizzle), envelope
              encryption, user-scoped repositories, Better Auth, the redacting logger
  ui/         the sintr design system: tokens, fonts, shadcn/ui components
  mcp/        the MCP contract (interfaces only)
  agent/      the capture driver contract (interfaces only)
docker/       the self-host stack (compose, Caddy) and the dev database
docs/         product, conventions, design, self-host, privacy, decisions
```

Conventions for anyone (or any agent) working here are in [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md); the visual system is [`docs/DESIGN.md`](docs/DESIGN.md); the trade-offs taken so far are in [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Privacy

Your ledger is sensitive personal data (health data under LGPD art. 11). Every free-text field is encrypted with a key that belongs to you alone before it reaches the database, nothing is written to logs, and nothing is sent to anyone without your explicit approval of that specific report. What is protected, how, and what is not done yet: [`docs/PRIVACY.md`](docs/PRIVACY.md).

## Licence

AGPL-3.0, see [LICENSE](LICENSE). The agent pack ([`tiagomoraes/sintr`](https://github.com/tiagomoraes/sintr)) stays MIT.
