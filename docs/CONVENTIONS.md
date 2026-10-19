# Conventions for agents working in this repo

This is context for AI coding agents (Claude Code, Hermes, Codex, others). It is not user documentation.

## What this repo is

`sintr-app` is the **product** for sintr: a self-hostable + SaaS application. The sibling repo `tiagomoraes/sintr` is the **agent pack** (skill + Markdown ledger + Python report pipeline) and is a separate, independent deliverable. The pack is MIT; this app is AGPL-3.0. Do not copy the pack into this repo.

The product replaces the pack's filesystem ledger with a Postgres database. The pack can optionally talk to this app over MCP; keep that interface stable.

## Canonical interface: `make`

Every developer and CI action goes through a `make` target. Do not document raw `pnpm`/`docker` invocations as the primary path; expose them as targets and document the target.

Expected targets (add as the project grows): `setup`, `dev`, `test`, `lint`, `typecheck`, `build`, `migrate`, `selfhost-up`, `selfhost-down`, `seed`.

## Stack (do not swap without a recorded reason)

- **TypeScript**, strict. pnpm workspaces monorepo.
- **Next.js 15** (App Router, React Server Components) in `apps/web`; it also serves the API.
- **Postgres 16** + **Drizzle ORM** (versioned SQL migrations).
- **Better Auth** for authentication (email + password, magic link, OAuth).
- **Vercel AI SDK** (`ai`) for the embedded agent, with pluggable providers. Self-host = BYOK; SaaS = managed.
- **`@modelcontextprotocol/sdk`** for the MCP server.
- **Tailwind CSS + shadcn/ui (Radix)** for UI. Design tokens live in `docs/DESIGN.md`.
- **Playwright/Chromium** for HTML to PDF of the weekly report. Reuse the report HTML/CSS from the pack's design system, adapted.
- **Vitest** for unit/integration, **Playwright** for e2e.
- Background work in `apps/worker`, not in request handlers.

## Architecture

See [`docs/PRODUCT.md`](PRODUCT.md). Short version: one core (`packages/core`), shared by a self-host shell and a SaaS shell, differentiated only by environment flags.

## Non-negotiable rules

1. **Sensitive content never reaches logs.** No entry text, no chat text, no thoughts in logs, error messages, or telemetry. Redact at the logging boundary.
2. **Application-layer encryption.** Columns flagged sensitive are encrypted before INSERT with a per-user DEK (AES-256-GCM); the DEK is wrapped by the master KEK. A database dump must not reveal content.
3. **Tenant isolation is proven, not assumed.** Every query is scoped by `user_id`; isolation has automated tests.
4. **Nothing is sent to a third party (including the therapist) without an explicit, recorded, per-instance consent.**
5. **No diagnosis, no clinical claims** anywhere in code, copy, or agent prompts. Crisis resource (CVV 188 / SAMU 192) present where a person might disclose acute risk.
6. **The person's words are verbatim.** Never paraphrase a thought; never translate user content.

## Copy and product voice

Calm, private, precise. No em dashes or en dashes in user-facing copy, docs, or commit bodies. No emoji, no hype, no gamification (streaks, badges, scores as judgement). Prefer lowercase, plain language.

The app's words live in its message catalog, `apps/web/messages/en/<feature>.ts`, one file per screen or feature; components read them as `t.<feature>`. A new or rewritten string goes there, not into a component, so the languages milestone adds a catalog instead of hunting through the code (DECISIONS 94).

## Tests and verification

- Every feature ships with tests. `make test` must pass before a change is considered done.
- Anything touching encryption, auth, or data scoping needs a test that would fail if the protection were removed.
- Prefer a small, coherent solution over a configurable one. When you take a trade-off, record the reason in the commit body or a short doc.

## Git

- Branch per task; PR into `main`.
- Commit subjects in the imperative, lowercase, no em dash.
- Keep the working tree clean; never commit secrets, `.env`, or generated artifacts.
