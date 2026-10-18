# sintr

**A private mood diary you keep with your AI assistant.**

sintr is a psychological self-tracking product. You talk, it structures what happened the way cognitive-behavioural therapy taught us (thought records), keeps your therapy context, and turns the week into a short report you review and hand to your therapist only if you want to.

It ships in two forms, from the same codebase:

- **Self-host (open source, AGPL-3.0)** — run it on your own machine with Docker, bring your own LLM key. Your data never leaves your disk.
- **Hosted (SaaS)** — log in, or connect your own agent over MCP and keep using the assistant you already have.

There is **no filesystem dependency**: entries live in a Postgres database, encrypted at the application layer.

> sintr is not therapy, a diagnosis, or a crisis service. It is a documentation tool for work done in professional care.

## Why

The week between two therapy sessions is where the important things happen. By the time the session arrives, they are gone: the exact sentence, the situation that set it off, how strong it felt. sintr keeps the week in the person's own words and hands the week back, sharper, at the right moment.

## What it does

- **Capture** — a supportive conversation that turns a difficult moment into a structured CBT thought record, in the person's exact words.
- **Check-ins** — a one-line daily mood / energy / anxiety / sleep log, low ceremony.
- **Therapy context** — goals, themes, the task the therapist assigned, what to bring next.
- **Insights** — dated observations, labelled as observations, never diagnoses.
- **Weekly report** — prepared an hour before the session, covering exactly the days since the last one, reviewed by the person, rendered as a PDF, and sent to the therapist only after explicit approval.

## Two ways to use it

1. **Inside sintr** — talk to the assistant in the app.
2. **Inside the agent you already use** — connect sintr over MCP and keep working in Claude, ChatGPT, Gemini, Hermes, or any MCP-capable client.

Both write to the same ledger.

## Self-host

```bash
git clone https://github.com/tiagomoraes/sintr-app.git
cd sintr-app
make selfhost-up      # app + Postgres via Docker Compose
```

Then open `http://localhost:3000`, create your account, and paste your LLM API key in settings (Anthropic, OpenAI, Google, OpenRouter, or a local Ollama endpoint).

See [`docs/SELFHOST.md`](docs/SELFHOST.md) for the full walkthrough.

## Development

```bash
make setup            # install deps, prepare env
make dev              # run the app against a local Postgres
make test             # unit + integration
make lint             # typecheck + lint
```

`make` is the canonical interface. See [`AGENTS.md`](AGENTS.md) for the conventions this repo follows.

## Privacy

Your ledger is sensitive personal data (health data under LGPD art. 11). It is encrypted at the application layer per user, never logged, never shared without explicit per-instance consent, and exportable and deletable on demand. Read [`docs/PRIVACY.md`](docs/PRIVACY.md).

## Licence

AGPL-3.0 — see [LICENSE](LICENSE). The agent pack (`tiagomoraes/sintr`) stays MIT.
