# Self-hosting sintr

sintr runs on your own machine as four containers behind one command: Caddy (the only thing that listens on the host), the app, the worker and Postgres 16. Everything is configured by `.env`; every variable is explained in [`.env.example`](../.env.example).

## What you need

- Docker with Compose v2 (`docker compose version`)
- `make` and a POSIX shell (Linux, macOS, or WSL on Windows)
- about 1.5 GB of disk for the image (it includes Chromium, to print reports) and the database

Node is not needed to self-host; it is only needed for development.

## Start it

```bash
git clone https://github.com/tiagomoraes/sintr-app.git
cd sintr-app
make selfhost-up
```

On the first run this:

1. writes `.env` from `.env.example` with fresh random secrets (file mode 600);
2. builds the image (`sintr-app:local`);
3. starts Postgres, applies the database migrations (the `migrate` service runs once and exits), then the app, the worker and Caddy;
4. waits until every service is healthy and prints the address.

Open `http://localhost:3000`, create your account and give the consent it asks for. Then open Settings and choose the assistant's provider and key (see below), or give the whole installation a house assistant.

```bash
make selfhost-down   # stop the stack; the volumes (your data) are kept
make selfhost-up     # start it again, rebuilding the image if the code changed
```

## Make it yours

**Close sign-up.** After creating your account, set `SINTR_SIGNUP=closed` in `.env` and run `make selfhost-up` again. Nobody else can then create an account; your sign-in keeps working.

**Use a domain with TLS.** On a server with a public address and a DNS name pointing to it:

```bash
SINTR_URL=https://diary.example.com
SINTR_SITE_ADDRESS=diary.example.com
SINTR_BIND=0.0.0.0
SINTR_HTTP_PORT=80
SINTR_HTTPS_PORT=443
```

Caddy obtains and renews the certificate by itself and redirects HTTP to HTTPS. With an `https://` URL, cookies are marked Secure, HSTS is sent, and the CSP upgrades insecure requests. Ports 80 and 443 must be free and reachable.

**Keep it on localhost.** The default (`SINTR_BIND=127.0.0.1`) publishes nothing to the network. To use it from your phone on the same network, prefer a VPN such as Tailscale over binding to `0.0.0.0` without TLS.

**Choose its language.** sintr speaks English and Brazilian Portuguese. Each person reads it in the language they chose in Settings; else in the installation's language, if you set one; else in the one their browser asks for; else in English. For a sintr that is entirely in one language, set `SINTR_LANGUAGE=pt-BR` (or `en`) in `.env` and run `make selfhost-up` again: everyone who has not chosen reads that one, whatever their browser says. Adding another language is a folder of translated catalog files and one line of configuration, with no code to change; [`LANGUAGES.md`](LANGUAGES.md) says exactly how.

## The assistant

sintr's assistant talks to a model you choose, with your own key. Without a house assistant (below), the home says so and points to this door in Settings, "Your own key":

- **OpenAI-compatible** covers OpenAI (`https://api.openai.com/v1`), OpenRouter (`https://openrouter.ai/api/v1`) and anything that speaks the same API. For a model on the same machine (Ollama, LiteLLM), use `http://host.docker.internal:11434/v1` (or the port it listens on): inside the stack, `localhost` is the app container itself, and the compose file maps `host.docker.internal` to the host. A local endpoint needs no key.
- **Anthropic** and **Google** take a key and a model name.
- **Test the connection** makes one short request with the saved settings and tells you whether the key and the model work.

Speaking on the home works with OpenRouter, OpenAI, Groq and Google keys (each writes down what you say with your key; the recording is never kept); with Anthropic or a local model you write, and the home says so. It needs https, or localhost: a phone's browser opens the microphone only there.

The key is encrypted with your data key before it is stored and is never shown again. What the provider receives is described in [`PRIVACY.md`](PRIVACY.md). Conversations are kept until you delete them, unless you choose a retention in Settings; the worker removes older ones every hour.

**A house assistant for everyone on it.** On a sintr shared with a family or a practice, you can give the installation one provider, model and key in `.env` (`SINTR_HOUSE_PROVIDER`, `SINTR_HOUSE_MODEL`, `SINTR_HOUSE_KEY`, and `SINTR_HOUSE_BASE_URL` for an OpenAI-compatible endpoint), and nobody has to bring a key; a model on the same machine works too (`openai_compatible` at `http://host.docker.internal:11434/v1`). It then behaves like the hosted app: each person is on a plan that counts the assistant's messages and reports each month, Free by default (100 messages and 4 reports); for a family server that pays its own key, set `SINTR_PERSON_PLAN=unlimited`, or give one person more with `make person-plan EMAIL=... PLAN=personal`. Anyone can still use their own key instead. The house key is never stored or shown; [`OPS.md`](OPS.md) has the details. Nothing of this calls home: there is no licence check, and without `SINTR_HOUSE_*` and `SINTR_STRIPE_*` sintr works as before, offline.

## Connect your own assistant

The Connect screen makes a key for an assistant you already use and shows its setup with your address filled in; [`MCP.md`](MCP.md) is the full guide.

- **On this computer only** (the default, `http://localhost:3000`): Claude Code, Gemini CLI, Hermes and the Claude desktop app (from a file, through the bridge) work, since they reach sintr from your machine.
- **Claude's connectors and ChatGPT** call sintr from their own servers, so they need sintr at a public `https` address: use a domain with TLS as above. A VPN address is not reachable from those services.
- **The bridge** for local clients is served by your sintr at `/sintr-mcp.mjs`; it needs Node.js 20 or newer on the computer that runs the assistant.
- The endpoint is `/mcp` on the same address; Caddy passes it through like any other request and keeps no access log, so a key inside an address is never written down.

## Your therapist, and practices

A person can give their therapist access to the reports they approve, inside sintr, from Sharing. A therapist does it the other way round: in Settings, "Are you a therapist?" opens a practice on the same account, with a dashboard where the reports their patients share arrive. Both sides use the same sintr, so on a self-host the therapist needs an account on it (sign-up must be open while they create it). Nothing leaves the machine: invites, links and reports stay in this database, and it all works offline.

- **Invites** are a code (`XXXX-XXXX-XXXX`) and a link (`/join/<code>`) at `SINTR_URL`, so set it to the address people open sintr at. A practice invites a patient from its dashboard; a person invites their therapist from Sharing. Either way, nothing is shared until the person has said yes to that practice by name, and then each report goes only with their approval.
- **Seats.** A self-hosted practice has unlimited seats, under the plan "Self-hosted". To bound them, set `SINTR_PRACTICE_SEATS` (a number, or `unlimited`) and optionally `SINTR_PRACTICE_PLAN` in `.env`, and run `make selfhost-up` again. A practice with a plan of its own also gets the house assistant's Personal plan for the professional's own diary, if there is a house assistant. To give one practice its own seats:

  ```bash
  make practice-plan EMAIL=therapist@example.com SEATS=10 PLAN="Practice 10"
  make practice-plan EMAIL=therapist@example.com SEATS=default   # back to the .env defaults
  ```

  `make practice-plan` writes to the database in `DATABASE_URL` (the development one, unless you point it elsewhere). Inside the self-host stack the same command is in the image: `docker compose -f docker/compose.yaml --env-file .env exec -e SINTR_PLAN_EMAIL=therapist@example.com -e SINTR_PLAN_SEATS=10 worker node worker/practice-plan.mjs`. Seats are taken by linked patients and held by invites waiting for an answer; lowering them never ends a link.
- **Email for practices.** With email set up, a therapist can ask, in Practice details, to be told when a report arrives: a link and a count, never who or what. The worker sends it within a minute.

## Payments

A self-host needs none: plans come from `SINTR_PERSON_PLAN` and from `make person-plan` and `make practice-plan`. Selling plans through Stripe is written and off until configured; what is missing to turn it on (a Stripe account, two prices, a key, the webhook endpoint at `/api/billing/webhook` and the customer portal) is listed in [`OPS.md`](OPS.md), "What is missing to turn payments on".

## Email

Email is optional. Without it, sintr works the same except that nothing is ever emailed: you download a report's PDF and share it yourself, a forgotten password cannot be reset, and Settings says so. With it, sintr sends five kinds of message, and nothing else:

- an approved report, as a PDF attachment, to your therapist, when you say "send" for that report;
- a short note to you that a report is ready, if you ask for it in Therapy (a link, never the report's words);
- a link to set a new password, when you ask for one;
- a link to confirm your address, when you create your account or ask again in Settings;
- to a therapist who asked for it, a note that a report was shared with their practice (a link and a count).

Emails to a person or a practice are written in the language the person reads sintr in (English or Portuguese; any other language gets English), and the report to a therapist in the report's language.

Any provider that speaks SMTP works: your mail host, Fastmail, Gmail with an app password, Postmark, Amazon SES, a relay on your network. In `.env`:

```bash
SINTR_SMTP_HOST=smtp.example.com
SINTR_SMTP_PORT=587               # 587 with starttls (the default), or 465 with tls
SINTR_SMTP_SECURITY=starttls      # starttls, tls, or none for a relay on the same machine or network
SINTR_SMTP_USER=diary@example.com
SINTR_SMTP_PASSWORD=the-password-or-app-password
SINTR_EMAIL_FROM="sintr <diary@example.com>"
```

Then run `make selfhost-up` again. The sender must be an address your provider lets you send from, or messages will be refused or land in spam. Links in the messages point at `SINTR_URL`, so set it to the address you open sintr at.

To check it: in Settings, under Your email, send yourself the confirmation link. A failure is logged as `auth.email_failed` (or `report.send_failed` for a report) with a code, never with the address or the link; the server's own words are not logged either, because they can repeat the address. The usual causes are a wrong password, port 587 blocked by the network, or a sender the provider does not accept.

What email means for privacy: a report you send leaves sintr's encryption. Your SMTP provider and your therapist's mailbox can read the PDF, as with any email attachment. That is why each send is your explicit yes for that one report and that one address, recorded with the date. See [`PRIVACY.md`](PRIVACY.md).

## The weekly report

Set your sessions in Therapy: the day and time, your time zone, and when to prepare the report (an hour before, by default). The worker checks every minute and prepares each report at that moment, covering exactly the days since the previous report ended. If your sessions move for good, change the day and the preparation follows. If a single session falls on another day, prepare that week's report from Reports when you need it: you can prepare one by hand at any time.

The report is written by your assistant (the provider in Settings), which receives the period's entries and check-ins to do it. Without an assistant, sintr prepares what it can on its own (your moments, notes and topics, in your words) and leaves the prose to you. You read it, change what you want, approve it, and only then can you send it.

The PDF is printed inside the app container by Chromium (installed in the image), from a page that loads nothing from the network and runs no script. Nothing to configure.

## The keys, and backups

`.env` holds two secrets that matter:

- `SINTR_MASTER_KEY` wraps every person's data key. **Without it, nothing in the database can be read, ever.** There is no recovery.
- `SINTR_AUTH_SECRET` signs session cookies. Changing it signs everyone out, nothing more.

Back up the master key somewhere other than where your database backups go (a password manager is a good place). A backup that holds both the key and the database protects nothing.

Back up the database with:

```bash
docker compose -f docker/compose.yaml --env-file .env exec -T db \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' > sintr-$(date +%F).dump
```

The dump contains your entries only as ciphertext (see [`PRIVACY.md`](PRIVACY.md)), but it still contains your email address and dates, so keep it private. For encryption at rest of the whole disk, run Docker on an encrypted volume (LUKS on Linux, FileVault on macOS).

## Upgrades

```bash
git pull
make selfhost-up
```

The image is rebuilt and the `migrate` service applies any new migrations before the app starts. Migrations only move forward; take a database backup before upgrading.

If a new version adds a variable to `.env.example`, your existing `.env` is left as it is and the default from `docker/compose.yaml` applies; copy the variable over if you want to change it.

## Logs

```bash
docker compose -f docker/compose.yaml --env-file .env logs -f app worker
```

Logs are JSON lines with event names, ids, counts and error codes. They never contain what you wrote; fields that are not known to be safe are written as `[redacted]`. Caddy keeps no access log.

## Troubleshooting

**`all predefined address pools have been fully subnetted`.** Docker could not find a free private subnet for the stack's network, usually because a VPN routes `10.0.0.0/8` or `172.16.0.0/12`. Set a subnet that nothing else uses, for example `SINTR_DOCKER_SUBNET=10.253.17.0/24`, in `.env` and run `make selfhost-up` again.

**Port 3000 is already in use.** Something else (often `make dev`) is listening. Stop it, or change `SINTR_HTTP_PORT` and `SINTR_URL` together.

**Signing in fails with a 403.** The address in the browser must match `SINTR_URL` exactly (scheme, host and port); requests from any other origin are refused.

**The app container is not healthy.** `docker compose -f docker/compose.yaml --env-file .env logs app` shows why. A message about `invalid configuration` names the variable to fix (for email, `SINTR_EMAIL_FROM` is required as soon as `SINTR_SMTP_HOST` is set).

**"The PDF could not be printed just now".** The app logs `api.report_pdf_failed` or answers `pdf_unavailable`. Inside the stack, Chromium comes with the image; on a host with very little memory it can fail to start, so give the machine at least 1 GB.

**No report was prepared before a session.** Check that Therapy shows "The next report will be prepared on ...", that the time zone is yours, and that the worker is running (`logs worker` shows `job.done` for `prepare-reports` every minute). A report is never prepared for a session that already started.

## What runs where

| Service | Image | Role |
| --- | --- | --- |
| `caddy` | `caddy:2-alpine` | the edge: HTTP or automatic HTTPS, compression, reverse proxy to the app |
| `app` | `sintr-app:local` | the Next.js app (UI, API, auth, the MCP endpoint at `/mcp`) on port 3000, inside the network only; prints report PDFs with the Chromium in the image and sends approved reports |
| `worker` | `sintr-app:local` | background jobs: prepares each report before its session (checked every minute), sends the "report ready" note and the practices' "report shared" note (every minute), removes expired sessions, conversations past their retention and invites a month past use (hourly) |
| `migrate` | `sintr-app:local` | applies migrations, then exits |
| `db` | `postgres:16-alpine` | the database, on the `pgdata` volume |

The same code runs the hosted offer; `SINTR_MODE=saas` is the switch, and nothing is built separately.
