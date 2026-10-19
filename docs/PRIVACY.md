# Privacy and data protection

This describes what sintr does with personal data **as implemented today** (milestones F0 to F5), so it can be checked against the code. Where something is planned but not built, it says so. The product rules behind it are in [`PRODUCT.md`](PRODUCT.md) (Security and privacy, Invariants) and [`CONVENTIONS.md`](CONVENTIONS.md) (Non-negotiable rules).

A diary kept in sintr is sensitive personal data: health data under LGPD art. 11. The posture is built around four ideas: the person's specific consent, encryption by the application before anything is stored, strict separation between people, and nothing sent anywhere without approval.

## Legal basis: specific consent

- An account cannot be created without the consent to process health data. The sign-up form asks for it in plain words, and the server refuses a sign-up without it (`CONSENT_REQUIRED`), whatever the client sends.
- The consent is recorded in `consents` with its purpose (`health_data_processing`), the version of the wording, and the time. The log is append-only: a withdrawal is a new row with `granted = false`, never an edit.
- When the wording changes, its version (`HEALTH_DATA_CONSENT_VERSION` in `packages/core`) changes too, and every person is asked again before the diary opens.
- Sending a report to a therapist needs a separate, per-report consent (`report_send`, versioned by `REPORT_SEND_CONSENT_VERSION`) that names the report and the recipient. It is given by an explicit "Approve and send" on that report, after the person approved its words, and the browser must send back the address the person was shown: if the settings changed in between, nothing is sent. The consent and an audit event are recorded before the email leaves; the report is marked sent, with the recipient and the time, only after the mail server accepted it. The repository refuses to mark a report sent without the consent, and so does the database: a check constraint rejects `status = 'sent'` without one, and a composite key rejects a consent that belongs to another person. Nothing is ever sent by the scheduler, and approval before sending cannot be turned off.
- Giving a therapist access in sintr (F4) rests on two more consents, both specific and versioned. A `practice_link` consent, given once per practice, records that the person agrees to share the reports they approve with that professional, naming the practice as it was shown to them; ending the link adds a withdrawal. A `report_share` consent, given for each report and practice, records that one approved report goes to that one practice. The database refuses a shared report, or an active link, without the person's own consent. See "Your therapist in sintr" below.

## Encryption at the application layer

**Envelope encryption.** Each person has their own 256-bit data key (DEK). It is stored only wrapped (AES-256-GCM) by the master key (KEK) from `SINTR_MASTER_KEY`, which never reaches the database. The wrapped key is bound to the person's id and to the KEK id, so it cannot be moved to another account.

**Every sensitive field is sealed before INSERT** with the person's DEK (AES-256-GCM, a fresh random IV per value, the authentication tag checked on every read). Each value is also bound to its column and owner as associated data: a ciphertext copied to another column or another person's row fails to open instead of decrypting. The sealed columns, declared once in `packages/core/src/db/sealed.ts`:

| Table | Sealed |
| --- | --- |
| `profiles` | display name |
| `therapy_settings` | therapist name, therapist email |
| `entries` | title, situation, thoughts, emotions, body, behaviour, context, tags, notes, hot thought, evidence for and against, alternative thought, emotions after |
| `checkins` | sleep quality, note |
| `therapy_notes` | body |
| `insights` | body |
| `reports` | content (the report's words, including the copied moments), PDF, recipient |
| `report_revisions` | what a report said before each change |
| `consents` | recipient |
| `conversations`, `messages` | title, message content |
| `proposals` | the draft the assistant prepared (every field of it) |
| `corrections` | what a changed field held before, the person's note |
| `agent_settings` | the API key of the person's assistant provider |
| `practices` | the professional's name, the practice's name, the registration they show (sealed with the professional's key) |
| `invites` | the code, the professional's own note on who it is for, the name a person chose for their invite (sealed with the creator's key) |
| `links` | the name the person chose to be seen as (sealed with the link's own key) |
| `shared_reports` | the shared report's page and its PDF (sealed with the link's own key) |

**Kept in the clear, on purpose,** so they can be counted and charted without decrypting anything: dates and times, the 0 to 100 intensities and the 0 to 5 check-in scales, sleep hours, statuses and kinds, ids. Also the therapy schedule (session day and time, a moved session's date, the report lead, the delivery choice), which the worker reads for everyone to know when a report is due, and the names of the sections a report revision changed (never their words). Also the names of the fields a correction changed (never their values), and which provider, address and model a person's assistant uses. Also in the clear: the email address (needed to sign in), session metadata (IP address and browser, which Better Auth stores for each session), API token labels and scopes, and audit events, which hold no content. For plans (F5): a person's or a practice's plan, its status and period, the payment provider's customer and subscription ids, and how many messages and reports the house assistant answered and wrote each month (counts, never what was said). For practices (F4): the plan, the seat count and whether the professional wants an email when a report arrives; for invites and links, their direction, status, dates, the practice's number for a person ("Patient 3") and how reports go ("ask each time" or "send what I approve"); for a shared report, its period and when it was shared and first opened; notices, which are a kind and ids. An invite code is stored only as a keyed hash (HMAC with a key derived from the master key) next to its sealed copy, so a dump alone cannot be searched for codes.

**What a database dump reveals.** Account emails, dates, scales and the shape of the data; none of the words. A test writes recognisable text into every sealed column and then scans a text dump of every table for it, in clear and as hex; it finds nothing. The test was also run with sealing removed, and it fails, as it should.

**Minimisation.** Sign-up asks for an email and a password, nothing else. Better Auth's `users.name` is always stored empty; a display name, if the person ever sets one, lives sealed in `profiles`.

**Key handling.** The master key is read from the environment at start and validated (32 bytes). Losing it makes every diary unreadable; there is no recovery and no backdoor. Key rotation is prepared (each wrapped key records the KEK id) but not implemented yet: today one KEK is active, and a key wrapped by another one is refused.

**At rest and in transit.** Self-host can run Docker on an encrypted volume (LUKS, FileVault); that is the operator's choice and is documented in [`SELFHOST.md`](SELFHOST.md). With a domain, Caddy serves TLS with automatic certificates, the app sends HSTS, and cookies are Secure.

## Separation between people

- Data access in `packages/core` starts from `repositories.forUser(userId)`. Every repository is bound to that one person and adds `user_id` to every query; none accepts another person's id. The web app cannot import the ORM or the schema (an ESLint rule), so it cannot go around this.
- Every table carries a mandatory, indexed `user_id`, except `users` (its id is the scope) and `verification_tokens` (it exists before an account does and holds no ledger content). Composite foreign keys make the database itself refuse a message, or a consent, that points at another person's conversation or report.
- Each person's data is encrypted with their own key, so even a query that forgot its scope would read ciphertext it cannot open.
- A practice is reached only through the account that opened it, and a shared report only through an active link of that practice. The practice side has no query that reaches a person's diary: only the copies the person shared. Tests prove that another practice, an account without a practice, and another person reach none of it, that a draft never travels, and that a link that is not active refuses at once; with the practice or the status condition removed from the query, a test fails.
- Two things cross from one account to another, both written for that reader: the practice's names, opened for the people holding its invite or linked to it, and the name a person chose for their invite, opened for the professional holding the code.
- A test has user A write to every repository and checks that user B cannot list, read, change or delete any of it. With the scope removed from one repository, four of those tests fail. An end-to-end test checks the same through the running app, with two separate browser sessions.

## Authentication

- Passwords are hashed with Argon2id (19 MiB, 2 passes, 1 lane), at least 10 characters.
- Sessions live in the database, last 7 days and are extended when used after a day; signing in always issues a new token, and signing out deletes the session on the server. There is no cookie cache, so a revoked session ends at once. Cookies are HTTP-only and SameSite=Lax.
- Sign-in is limited to 10 attempts a minute and sign-up to 10 every 10 minutes, per IP address (then HTTP 429). A wrong password and an unknown email get the same answer.
- Every page that shows data checks the session on the server; a forged or revoked cookie is redirected to sign in.
- Browser requests to the auth API from any origin other than `SINTR_URL` are refused (CSRF); browsers always send the origin on these requests. The app sends a nonce-based Content Security Policy (no third-party scripts, styles, fonts or frames), `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` and a restrictive `Permissions-Policy`.
- Connection keys for a person's own assistant (MCP, F3) are stored only as a SHA-256 hash, carry scopes per data type, can expire and are revoked with one click. The key itself is shown once. It is the only credential of the MCP endpoint, which never reads the session cookie, refuses browsers on other origins and sends no CORS headers. Wrong keys are limited per address, and calls per key.

## Logs and telemetry

- MCP requests are logged as their status, the key's id and their duration, and tool calls as their name and outcome; never the key, the address that carries it, or any word.
- Logs go through one boundary: a logger that writes only fields it knows to be operational (ids, counts, durations, codes). Anything else becomes `[redacted]`; errors keep only their name and code, because database messages can echo values. `console` is banned by lint in the code.
- Database errors are reduced to their SQLSTATE and constraint name before they leave the core.
- Caddy keeps no access log. Next.js and Better Auth telemetry are disabled. Fonts are self-hosted; the app loads nothing from third parties.

## The assistant and its provider

The embedded assistant talks to one of two providers, and Settings always says which.

**The house assistant** is the default wherever the installation has one: the provider, model and key its operator configured (`SINTR_HOUSE_*`). Settings names it ("It runs on a model from Anthropic, through sintr's own account").

- What it means: the words of a conversation, and the digest of a report's period, go to that provider under the operator's agreement with it, not the person's. The person has no account there and no key to manage. What the provider keeps, and for how long, is governed by that agreement; the hosted offer will use zero-data-retention routes, and this document will say which before it opens.
- The operator's key is a server secret: read from the environment, never stored in the database, never sent to a browser, never logged (tests check pages, logs and the person's stored settings for it).
- The person's plan counts how many messages the house assistant answered and how many reports it wrote that month: numbers in the clear, no words. A message the crisis screen stops is never counted and never sent to the provider.

**Your own key** (bring your own key) waits behind "Use your own key instead" in Settings, and is the way in on an installation without a house assistant: an OpenAI-compatible endpoint (OpenAI, OpenRouter, a local Ollama or LiteLLM), Anthropic or Google.

- What changes: the words go to the provider the person chose, under their own agreement with it, and nothing is counted toward a plan. A model on the person's own machine keeps them there.
- **The key** is sealed with the person's own data key before it is stored, like ledger content. It is never sent back to the browser (the settings screen shows its last four characters at most), never logged, and used only on the server for the call to that provider. Saving or removing it is recorded in the audit log, without the key. sintr never falls back to a key from the server's environment for it.
- sintr never moves a person between the two on its own: a key of theirs that stops working is reported, never replaced by the house's, because that would send their words somewhere they did not choose. Going back to the included assistant is the person's action, and removes their key.

**What the provider receives**, either way: the messages of the current conversation (the last 40) and, when the assistant asks for it, a summary of the last seven days: dates, entry titles (or the first 120 characters of the situation), emotions with their intensities, and check-in scales. Nothing else from the diary.

- **Nothing the assistant drafts is a record** until the person confirms it, on screen or by telling it to save. Drafts are stored sealed and go away with their conversation.
- **A message that signals acute risk** stops the diary before anything is sent to the provider: the reply that points to CVV 188 and SAMU 192 is written in advance, and works without a provider and whatever the plan.
- **At the plan's limit** the house assistant does not run, so nothing is sent; the person's message is kept, sealed, as always, and offered back as a draft entry in their own words.
- **For the weekly report** (F2), the assistant receives the digest of the period: every entry of the period in full (title, situation, thoughts, emotions with intensities, body, behaviour, context, tags, notes and the working of a thought), the check-in values and notes of those days, the averages, and the person's open "things to bring up" and tasks. That is what it needs to write the report; nothing outside the period, and nothing else from the diary. What it writes is checked before it is kept (quotes against the diary, no causes, no clinical labels), and a report is never sent by it. The worker prepares reports only for people whose consent to process their health data is granted in its current wording. Without an assistant, or past the plan's reports for the month, sintr prepares the parts it can alone and sends nothing to any model.

## Speaking instead of typing

On the home a person can speak instead of typing (F6). What happens to the voice:

- **Who hears it**: the same provider that answers them. On the house, the house's own provider and key (OpenRouter's Whisper by default) or the transcription endpoint its operator configured (`SINTR_HOUSE_STT_*`); on a person's own key, that provider, with their key. Never the house for someone on their own key. Settings names who writes it down, and so does a line under the box while they speak. Where the provider takes no audio (Anthropic), there is no microphone, only a line that says so.
- **The recording** is made in the browser only after the person taps Speak (the browser asks for the microphone; the page is the only one allowed to, `microphone=(self)`). It goes to sintr's server in one request, is held in memory for the one call to the transcriber, and is dropped: never written to disk, to the database or to a log, and nothing is kept on the device. Cancel keeps nothing and sends nothing.
- **The words** come back to the box, for the person to read and change; speaking creates no conversation, no message and no draft. Once they send them, they are a message like a typed one, sealed as always. The crisis screen runs on the words as soon as they come back, and again before any model when they are sent.
- **What is logged**: a code and the number of seconds, never a word.
- **The plan** counts the seconds the house wrote down that month (numbers only, in `usage_counters.audio_seconds`); a person's own key is never counted.
- **The language hint** given to the transcriber comes from the person's own messages, a language they chose, or the installation's default; it is a two-letter code.

## Plans and payments

Plans (F5) decide how much of the house assistant a person can use each month; the diary itself is the same on every plan.

- **What is stored**: in `subscriptions`, a person's plan and a practice's (the plan, its status, whether it was granted by the operator or paid, its period, the seats), and for a paid one the payment provider's customer and subscription ids; in `usage_counters`, per person and month, how many messages the house assistant answered, reports it wrote and seconds of speech it wrote down. No content, no card data. Changes of plan are in the audit log.
- **Payments** go through Stripe, and only when the operator configured it. A person subscribes on Stripe's own page and manages the subscription on Stripe's billing page; the card never reaches sintr. What sintr sends Stripe: the account's id and email (for the receipt), the plan and the number of seats. Never a word of the diary, the therapy settings, or anything about a practice's patients. What Stripe keeps is governed by Stripe's terms.
- **The webhook** is accepted only with Stripe's signature over its exact body, at most five minutes old; sintr then reads the subscription back from Stripe and applies its current state. It is logged as a code and the account's id, never an email.
- **Practices**: a practice's plan covers its seats and the professional's own use of the assistant. It never covers or shows a patient's use, and a person's plan never depends on sharing with a practice.
- Without payments configured, plans come from the installation's default (`SINTR_PERSON_PLAN`) and from grants (`make person-plan`, `make practice-plan`), and nothing reaches Stripe.

## Your own assistant (MCP)

A person can connect the assistant they already use (Claude, ChatGPT, Gemini, Hermes) with a key made on the Connect screen. The full guide is [`MCP.md`](MCP.md).

- **What their assistant's provider receives** is decided by that assistant: everything said in that conversation, as always, plus what sintr answers its tools. With a key that may read: a summary of the last days (dates, titles or the start of the situation, emotions with intensities, check-in values), an entry it opens in full, the session schedule and open therapy notes (never the therapist's name or address), and the entries and check-in notes of the next report's period when it helps the person prepare. A "Save only" key reads nothing back. That provider's terms and retention apply, not sintr's.
- **What sintr receives** is what the assistant asks to save, checked against the person's own messages (`personWords`), which are read for the checks and dropped, never stored. What is saved is sealed like everything else.
- **Nothing is sent to anyone from MCP.** No tool approves or sends a report; the therapist only ever receives a report through the per-report consent above.
- **The crisis protocol** applies to every save: words that signal acute risk save nothing and answer with the fixed message that points to CVV 188 and SAMU 192.
- **The record of it**: making and revoking a key, and each entry or check-in an assistant saved, are in the audit log with the key's id; each key shows when it was last used and the name its client gave. The endpoint refuses every call until the current consent to process health data is on record.

## Your therapist in sintr

A person can give their own therapist access to the reports they approve, inside sintr, instead of or as well as the PDF by email. A therapist opens a practice on their account, invites the people they see (or accepts an invite one of them sent), and reads the reports those people share. The rules below are how the code behaves; DECISIONS 54 to 68 give the reasons.

**Legal basis.** Health data under LGPD art. 11, shared with a named professional on the person's specific and highlighted consent (art. 11, I), for one purpose: that this professional can read the reports the person approves. The consent is given twice, at the two points where something could leave: once for the link, after the person has seen the professional's name and the details they chose to show (`practice_link`), and once for each report, by approving and sharing it (`report_share`). Each records the practice as the page showed it, and is refused if the practice changed its names in between. Both are versioned and recorded before anything is shared. No link is active without both sides' acceptance and the person's consent, which the database checks; a link the person's therapist accepted waits for the person to confirm that exact practice. "Send what I approve" does not remove the per-report yes: the approve button names the practice, and a consent is recorded for that report.

**Minimisation.** The professional receives approved reports and nothing else: never drafts, entries, check-ins, conversations, the audit log or any report the person did not share. What they receive is a copy of what the person approved (the page with its numbers and the approved PDF), not a view into the diary; the practice side has no way to query the diary at all. They also see the name the person chose for the link, or a neutral number ("Patient 3"), in their list, and the dates a report covers and was shared. A report shows the name the person put on their reports in Therapy, if any, exactly as its PDF does; Sharing and the invite page say so. The dashboard computes nothing across patients: it counts active patients and seats.

**Protection.** What travels through a link (the chosen name and the shared copies) is sealed with that link's own key, wrapped by the master key and bound to the link, and refused to anyone but the practice of an active link. Every reading and every download is in both accounts' audit logs, and the person sees on each shared report when it was first opened.

**Revocation.** The person stops sharing in one action ("Stop sharing"), and the professional can disconnect in one action too; either way the link ends at once on both sides. The shared copies are deleted, the link's key and the chosen name are destroyed (the database refuses an ended link that still holds them), the other side is told, and both audit logs record it. When the person ends a link, a withdrawal of the consent is added to their log (art. 8, paragraph 5). Refusal is immediate: the next request of the practice finds nothing, and tests check it.

**Retention.** Shared copies live in sintr while the link is active and are deleted when it ends. A PDF the professional downloaded is outside sintr: like an emailed report, it stays with them under their own professional duties (for example, the record keeping of their council), and the screen says so before the person stops sharing. An ended link keeps only ids and dates, so the audit logs still point at something. Invites are removed a month after they could no longer be used.

**The professional's own data.** The names and registration a practice shows are sealed with the professional's key and shown only to the people holding its invite or linked to it. An email when a report arrives is opt-in, goes to a confirmed address, and holds a link and a count: never who shared it or what it says.

**Who decides what.** sintr keeps the copies on behalf of the link the person consented to and ends them when the link ends. What the professional does with a report they downloaded, and how they keep their clinical records, is theirs to answer for; sintr is not a clinical record.

## Email

Email is off unless the operator configures an SMTP server (`SINTR_SMTP_*`). When it is on, sintr sends five kinds of message and nothing else:

- **the approved report to the therapist**: the PDF the person approved, as an attachment, with a subject and two sentences that name the person (their display name, if they set one) and the session's date. This is the only message that carries diary content, and only after the per-report consent above;
- **a "report ready" note to the person**: a link to the report and a sentence, never its words; sent only if the person asked for it in Therapy, and only to an address they confirmed;
- **a link to set a new password**, and **a link to confirm the address**, valid for an hour;
- **a "report shared" note to a professional** who asked for it in their practice, at a confirmed address: a link to the practice and a count, never who shared it or what it says.

What this means: email is not end-to-end encrypted. The SMTP provider the operator chose, and the therapist's mailbox provider, can read a sent report's PDF, and both see the addresses and the subject. The connection to the SMTP server uses TLS unless the operator chose a plain relay on their own network (refused in saas mode). The therapist's address is stored sealed (in `therapy_settings`, the consent and the report); it never appears in the audit log or the logs. Email addresses, links and tokens never reach the logs; a failed send is logged as a code, and the mail server's own words are dropped because they can repeat an address.

## The PDF

A report's PDF is printed inside the app by headless Chromium from a page sintr builds itself: every font and image is inline, JavaScript is off and every network request is refused, so printing reaches nothing outside. A draft's PDF is printed on demand from its current words and is marked as a draft; when the person approves the report, the final PDF is printed once and stored sealed, and that stored file is exactly what is sent and what stays available afterwards. A quoted span gets the peach highlighter ("the person's exact words") only when sintr found it in the diary word for word.

## The name you go by

The welcome after signing up asks how the person wants to be called. That name is sealed like the diary, used only to greet them on the home, never sent to the assistant and never printed on a report; the name on reports is a separate choice in Therapy.

## Retention, export and deletion

- Expired sessions and verification tokens are removed every hour by the worker.
- Deleting an account removes every row the person owns, in every table, by cascade (tested in `packages/core`). There is no button for it in the app yet.
- **Conversations** are kept until the person deletes them, unless they choose in Settings to keep them 30, 90 or 365 days after the last message; the worker then removes older ones every hour, with their messages and drafts. A conversation can also be deleted from its page. Entries and check-ins saved from a conversation are records of their own and stay.
- **Corrections** of an entry or check-in keep what the changed fields held before, dated, so nothing is rewritten silently. They are removed with the record.
- **Reports** are kept until the person's account is deleted, with their revisions (what each said before a change) and, once approved, their PDF. A sent report cannot change. Deleting a single report from the UI is still to come.
- **Shared reports** (F4) live while their link is active; ending the link deletes them and destroys the key they were sealed with. A link that ended keeps its ids and dates. Invites are removed 30 days after they were accepted, cancelled or expired.
- Export (JSON and Markdown), deleting entries and the account from the UI, and the audit view are still to come. Until then, a self-host operator can run them directly; on the hosted offer they will exist before it opens.

## Known gaps

Recorded here so they are not mistaken for features:

- Better Auth 1.7 refreshes a session's expiry but does not rotate its token in place; a new token is issued at each sign-in.
- Without an SMTP server configured, there is no email confirmation or password reset. With one, they work, but sign-up still tells you when an email is already registered (closing that needs required confirmation, left for F4), and there is no magic link.
- Email is not end-to-end encrypted (see Email above).
- Chromium prints PDFs without its own sandbox, as an unprivileged container requires; the page it prints is sintr's own escaped HTML, offline and without script.
- Entries cannot be marked as "not for the report" yet (the pack's `share: no`); the person removes a moment from a report instead.
- The app connects to Postgres as the database owner; a least-privilege role is part of F4 hardening.
- Session IP addresses and user agents are kept for the life of the session.
- No MFA yet.
- sintr offers no OAuth for MCP yet. ChatGPT cannot send a key of its own, so for it (and for Claude without request headers) the key travels inside the address, which makes the address a secret.
- Over MCP, the person's yes to a draft happens in their assistant's conversation, which sintr cannot see; sintr requires the assistant to declare it and checks the words, but cannot prove it.
- MCP rate limits are counted per web process, in memory, and so are invite code lookups.
- A database backup taken while a link was active still holds that link's key and copies; destroying the key reaches the live database, not old backups. Backups are the operator's to keep and expire.
- Anyone holding an invite code sees who it is from (the practice's names, or the name a person chose for their invite) before signing in. That is what the code is for, but a code forwarded beyond its recipient shows it too; it still cannot be used without an account, and a person's invite cannot receive anything without the person confirming the practice.
- A PDF a professional downloaded leaves sintr and is not deleted when a link ends.
- Deleting an account (not in the UI yet) ends its links by cascade without telling the other side; that should tell them.
- A practice cannot be closed from the app yet; its links can each be ended.
- The person sees when a shared report was first opened; the full audit view is still to come.
- At the plan's limit the house assistant does not run, so only the fixed crisis screen looks at a message (as without any provider); the help lines stay on every page.
- On the house assistant, what the provider keeps is governed by the operator's agreement with it; this document does not name the hosted offer's provider and its retention yet, and will before it opens.
- Monthly usage counts are kept while the account exists; they hold numbers only.
- Speaking sends the recording to the transcriber the person's route names; what that provider keeps is governed by its terms (and, on the house, the operator's agreement and account settings with it), as for the conversation. sintr cannot prove a provider dropped it.
- The length of a recording is measured by the browser before it is counted, never below what its size makes it (and exactly, for WAV); the provider's own count settles it afterwards where it gives one (OpenRouter does), and otherwise that measure stands.
- Stripe keeps the email, the payment details and the invoices of a person who subscribed, under its own terms; deleting a sintr account does not delete the Stripe customer (the operator does that in Stripe).

This is a description of the software, not legal advice or a compliance claim.
