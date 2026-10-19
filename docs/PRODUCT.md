# Product

## What this is

sintr is a psychological self-tracking product: a private mood diary you keep with an AI assistant. It structures difficult moments the way cognitive-behavioural therapy taught us (thought records), keeps therapy context, and turns the week into a short report the person reviews and hands to their therapist only if they want to.

Today the sibling repo `tiagomoraes/sintr` ships sintr as an **agent pack**: a portable skill plus a Markdown ledger, for people who already run a filesystem-capable agent. That covers a small, technical slice of the audience. This repo is the product: a real application with a database, reachable by people who do not run agents.

## Two sides

1. **A person for themselves.** Keep the diary, prepare the weekly report, approve it, and hand it to their therapist: as a PDF by email, or by giving the therapist access in sintr to the reports they approve.
2. **A therapist for their patients.** Any account can open a practice. The practice invites patients by code or link (or accepts a patient's invite), has a number of seats, and gets one calm dashboard over the people who linked back: who accepted, which reports they shared, nothing else.

The unit of trust is one **link between one person and one practice**: accepted on both sides, consented by the person, revocable at once by either side, and audited in both accounts. The person owns the data; the therapist sees only what the person approved and shared. The dashboard centralises access, not analysis: no scores, no trends, nothing across patients.

## Two offers, one codebase

**Self-host (open source, AGPL-3.0)**
- Install with one command (Docker Compose: app + Postgres).
- Bring your own LLM key (Anthropic, OpenAI, Google, OpenRouter) or run a local model via Ollama; or give the installation a house assistant (one provider, model and key in the environment) that everyone on it uses.
- Talk to the assistant inside the app and/or connect your own agent over MCP.
- Data stays on the person's machine. Our infrastructure cost: zero.
- Same code as the SaaS, differentiated by environment flags. Nothing is rebuilt separately.

**Hosted (SaaS)**
- Login, multi-tenant, database encrypted at the application layer.
- The assistant is included: the installation runs on its own key (the house assistant), so a person never has to paste one. Bringing your own key stays possible, behind a small door in Settings.
- Plans pay for it: Free and Personal for a person, the Practice plan (seats) for a therapist. Payments through Stripe, behind configuration.
- The person submits as they go (web or MCP inside the agent they already use); we store it; at the end of the period we generate the report and send it to the therapist with approval.
- Zero-data-retention providers on the managed path.
- Two entry surfaces: **MCP** into the agent they already use, and an **embedded agent** inside the app.
- Web first; mobile later.

## The house model and the plan (F5)

The owner's decision: nobody should have to paste an API key to use sintr. The installation runs on its own key, the house assistant, and the subscription pays for it. Bringing your own key stays possible as a small door for whoever wants it (free here, private to their provider, at their own risk); it is never the main path. A self-host without a house key works as before, on the person's own key.

**What a person does in their first five minutes.** They sign up with an email, a password and the consent, and land in their diary, which offers one thing: "Talk it through". Talk opens on "Tell me what happened." with one line under the box: the assistant is included in their plan. They write what happened; the assistant answers, asks a narrow question or two and drafts an entry in their own words; they confirm it. If they tell Therapy when their sessions are, the report is prepared before each one; otherwise "Prepare this week's report" makes one now. Nothing in those five minutes asks for a provider, a key or a card, and nothing needs Settings.

**What the plan screen says to someone who never pays.** That their diary is the same on every plan, and a plan is only about how much of the assistant they can use. "You are on Free. 100 messages with the assistant and 4 reports written by it, each month." Then this month in two plain lines (23 of 100, 1 of 4) and what happens when they run out: nothing is lost; they can still write in Talk, and what they write is kept as a draft entry in their own words; check-ins and the report keep working, made from what they wrote; the count starts again on the first of the month. Then, once: Personal, its numbers and its price, and the other way on, their own key. No feature matrix, no countdown, no colour, no email. Someone who never pays keeps a diary for as long as they want, with a little of the assistant every month, and nothing they wrote is ever behind the plan.

**What the therapist's plan means.** Seats: one for each patient linked to the practice, or invite waiting for an answer, as F4 counted them. A hosted practice starts with one free seat, to try sintr with one patient. The Practice plan is as many seats as the therapist chooses, paid per seat, and it includes the assistant for the therapist's own diary, as Personal does. It does not pay for the patients' plans and shows nobody's use: what a person has never depends on sharing with their therapist, so stopping sharing never costs them anything.

The numbers, and why, are in DECISIONS 72; the limit's behaviour in 76 to 78; the practice plan in 79.

## Voice and users

People in regular therapy who want their self-observations documented between sessions but do not want another app to open, or who already live inside an AI assistant. They value privacy and plain language. Typical moment of use: right after a difficult situation ("preciso falar do que aconteceu"), or right before a session ("gera o report da semana"). They already have a therapist; they are not looking for an AI therapist.

Calm, private, precise. Like a well-kept notebook a trusted professional would recognise. No streaks, no scores-as-judgement, no wellness-app empathy performance.

## Invariants (not negotiable)

1. **The person's words are sacred.** Verbatim thoughts, their emotion vocabulary, their language.
2. **Capture first, analyse later.** Never gate recording behind completeness.
3. **Nothing leaves without explicit, per-instance, recorded consent.** Sending to the therapist means approving that specific report.
4. **Structure serves the session.** The schema exists to sharpen therapy, not to grade the week.
5. **Calm by default.** Quiet weeks are fine, empty fields are fine, the product never nags.
6. **Not therapy, not a diagnosis, not a crisis service.** Crisis resource (CVV 188, SAMU 192) in the UI and the agent.
7. **Sensitive health data (LGPD art. 11).** Specific consent, encryption, minimisation, defined retention, portability, deletion.

## Architecture: one core, two shells

TypeScript monorepo with pnpm workspaces:

```
sintr-app/
  apps/
    web/        Next.js (App Router): UI + API + embedded agent
    worker/     jobs: digest/report generation, sending, retention
  packages/
    core/       domain, schema (Zod), crypto, repositories, digest, report render
    mcp/        MCP server (tools/resources): HTTP + stdio
    agent/      capture-conversation driver (prompt derived from the pack's SKILL.md), provider-agnostic
    ui/         the sintr design system (tokens + shadcn components)
  docker/       self-host compose (app + postgres + caddy)
  docs/
```

## Data model (multi-tenant)

- **Auth**: `users`, `sessions`, `accounts`, `verification_tokens`
- **Profile**: `profiles` (name, language, timezone)
- **Therapy**: `therapy_settings` (therapist, contact, `session_day`, `session_time`, `report_lead`, `require_approval`, delivery channel)
- **Ledger**: `entries` (full CBT), `checkins`, `therapy_notes`, `insights`
- **Reports**: `reports` (period, `status` draft/reviewed/sent, recipient, `sent_at`, content + PDF)
- **Agent**: `conversations`, `messages` (configurable retention)
- **Integration**: `api_tokens` (MCP, scoped and revocable), `audit_log`
- **Sharing (F4)**: `practices` (the professional's names, plan and seats), `invites` (codes both ways, expiring), `links` (one person and one practice, with its own key), `shared_reports` (sealed copies of approved reports), `notifications` (kinds and ids)
- **Commercial**: `consents` (versioned consent log); seats live on `practices` (from configuration, a grant or a subscription); `subscriptions` (a person's plan and a practice's, granted or paid, with the payment provider's ids); `usage_counters` (the house assistant's messages, reports and audio minutes, per person and month)

Columns holding sensitive content are flagged for **application-layer encryption**. Every table carries an indexed, mandatory `user_id` scope.

## Security and privacy

- **Envelope encryption**: per user, an AES-256-GCM data key (DEK); the DEK is wrapped by a master KEK (KMS/env). Sensitive fields are encrypted in the app before INSERT; a database dump reveals no content.
- **In transit**: TLS everywhere, HSTS. **At rest**: encrypted volume (LUKS self-host).
- **Logs**: never contain entry/chat content; redaction is mandatory.
- **Auth**: Argon2id passwords; optional TOTP MFA; rotating sessions; rate limiting.
- **MCP tokens**: scoped (read/write per data type), revocable, stored hashed.
- **Consent**: explicit, versioned, auditable record per send to the therapist.
- **LGPD**: consent-based legal basis; purpose limitation; minimisation; retention (configurable chat, e.g. 30/90 days; ledger while the account exists); export (JSON/Markdown) and hard delete.
- **Provider retention**: ZDR / training-off routes on the managed path; BYOK when self-hosted; documented.
- **Tenant isolation**: strict `user_id` scoping plus automated tests proving one user cannot read another's data.
- **CSP, CORS, CSRF**, enumeration protection, secure headers.
- **Crisis**: the agent stops the journaling flow and points to human help.

## Use cases

1. Record a situation (thought record) by talking to the embedded agent.
2. Record over MCP inside the agent you already use (Claude, ChatGPT, Gemini, Hermes).
3. Quick check-in (mood, energy, anxiety, sleep).
4. Pre-session report: automatic digest, review, PDF, approved send to the therapist.
5. Configure therapy (session day/time, therapist contact, channel).
6. Connect an external agent (MCP token flow).
7. Review history and insights.
8. Export / delete data (LGPD).
9. See your plan and this month's use of the assistant; subscribe, change seats or cancel on Stripe's pages.
10. Self-host: install, configure BYOK, use.
11. The therapist receives the report by email (no account in the product), or in their practice on sintr.
12. Give your therapist access: invite them, or accept their invite; choose "ask me for each report" or "send what I approve"; see when they opened a report; stop sharing in one action.
13. A therapist opens a practice, invites patients, accepts a patient's invite, reads shared reports in place and downloads their PDF, and disconnects when needed.
14. (future) Mobile app.

## Non-functional requirements

- One codebase for self-host and SaaS (environment flags).
- Free tier bounded: 100 messages and 4 reports by the assistant a month (DECISIONS 72), never a limit on the diary itself.
- Future vision: optional E2EE with a user-held key (zero-knowledge). Recorded, not built now.
- App i18n (the site already carries 8 languages).
- Accessibility and light performance.

## Milestones

- **F0 Foundation**: repo + monorepo, local Postgres, `core` (schema, crypto, repositories), auth, base layout on the design system, CI, minimal self-host compose, tests.
- **F1 Capture**: embedded agent (BYOK/provider), create/edit entries and check-ins, timeline.
- **F2 Report**: digest, generation, preview, PDF, approval, email send.
- **F3 MCP**: MCP server + tokens + connection docs (Claude Desktop, ChatGPT, Gemini).
- **F4 The therapist**: practices on one account kind, invites both ways with double opt-in, the link with its consent and revocation, sharing approved reports, the therapist's dashboard, seats by configuration, notifications, audit in both accounts.
- **F5 The house model and the plan**: the house assistant configured on the server and used by default, bring your own key behind a small door, plans and entitlements for both sides with a monthly meter, the plan screen, the subscription modelled with Stripe behind configuration, limits that never hold the diary hostage.
- **F6 The narrative home** (next): the narrative onboarding and the agentic home, built on F5.
- **Later**: the public landing page, multi-tenant hardening, app on the domain and the deploy, LGPD export and delete in the UI, the audit view, MFA.

Each milestone is delivered by an Orca/Claude Code session (`claude-opus-5-5 --effort xhigh`) with its own brief, branch, PR, and verification.

## Decisions taken

1. **Domain**: `app.sintr.tiagomoraes.cloud` now; a dedicated sintr domain later.
2. **Hosting**: this VPS for now; keep it deployable to Railway or AWS (Terraform) later.
3. **Billing**: none in the first milestones; from F5, the house assistant is paid by plans (Free, Personal, Practice), with Stripe behind configuration. Self-host stays free, on the person's own key or a house assistant of its own.
4. **Licence**: AGPL-3.0 for the app; the pack stays MIT.
5. **Repository**: a new repo `tiagomoraes/sintr-app`; the pack stays isolated and the app talks to it over MCP.

## Risks and trade-offs

- **Scope**: a full SaaS is big; mitigate with incremental-value milestones (self-host + F1/F2 is already a useful product).
- **Sensitive data**: application-layer encryption complicates search and aggregation; mitigate by encrypting free text and keeping aggregable metadata (dates, 0-100 scales) in the clear.
- **LLM cost**: the house key pays for every conversation that does not bring its own; the monthly meter bounds it per person (DECISIONS 72 and 75), and BYOK removes it.
- **Pack vs app divergence**: keep the pack as an optional MCP client so the two do not fragment.
