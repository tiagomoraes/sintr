# Privacy and data protection

This describes what sintr does with personal data **as implemented today** (milestone F0), so it can be checked against the code. Where something is planned but not built, it says so. The product rules behind it are in [`PRODUCT.md`](PRODUCT.md) (Security and privacy, Invariants) and [`CONVENTIONS.md`](CONVENTIONS.md) (Non-negotiable rules).

A diary kept in sintr is sensitive personal data: health data under LGPD art. 11. The posture is built around four ideas: the person's specific consent, encryption by the application before anything is stored, strict separation between people, and nothing sent anywhere without approval.

## Legal basis: specific consent

- An account cannot be created without the consent to process health data. The sign-up form asks for it in plain words, and the server refuses a sign-up without it (`CONSENT_REQUIRED`), whatever the client sends.
- The consent is recorded in `consents` with its purpose (`health_data_processing`), the version of the wording, and the time. The log is append-only: a withdrawal is a new row with `granted = false`, never an edit.
- When the wording changes, its version (`HEALTH_DATA_CONSENT_VERSION` in `packages/core`) changes too, and every person is asked again before the diary opens.
- Sending a report to a therapist needs a separate, per-report consent (`report_send`) that names the report and the recipient. The repository refuses to mark a report sent without one, and so does the database: a check constraint rejects `status = 'sent'` without a consent, and a composite key rejects a consent that belongs to another person. The send itself arrives in F2; the guard is already in place.

## Encryption at the application layer

**Envelope encryption.** Each person has their own 256-bit data key (DEK). It is stored only wrapped (AES-256-GCM) by the master key (KEK) from `SINTR_MASTER_KEY`, which never reaches the database. The wrapped key is bound to the person's id and to the KEK id, so it cannot be moved to another account.

**Every sensitive field is sealed before INSERT** with the person's DEK (AES-256-GCM, a fresh random IV per value, the authentication tag checked on every read). Each value is also bound to its column and owner as associated data: a ciphertext copied to another column or another person's row fails to open instead of decrypting. The sealed columns, declared once in `packages/core/src/db/sealed.ts`:

| Table | Sealed |
| --- | --- |
| `profiles` | display name |
| `therapy_settings` | therapist name, therapist contact |
| `entries` | title, situation, thoughts, emotions, body, behaviour, context, tags, notes, hot thought, evidence for and against, alternative thought, emotions after |
| `checkins` | sleep quality, note |
| `therapy_notes` | body |
| `insights` | body |
| `reports` | content, PDF, recipient |
| `consents` | recipient |
| `conversations`, `messages` | title, message content |

**Kept in the clear, on purpose,** so they can be counted and charted without decrypting anything: dates and times, the 0 to 100 intensities and the 0 to 5 check-in scales, sleep hours, statuses and kinds, ids. Also in the clear: the email address (needed to sign in), session metadata (IP address and browser, which Better Auth stores for each session), API token labels and scopes, and audit events, which hold no content.

**What a database dump reveals.** Account emails, dates, scales and the shape of the data; none of the words. A test writes recognisable text into every sealed column and then scans a text dump of every table for it, in clear and as hex; it finds nothing. The test was also run with sealing removed, and it fails, as it should.

**Minimisation.** Sign-up asks for an email and a password, nothing else. Better Auth's `users.name` is always stored empty; a display name, if the person ever sets one, lives sealed in `profiles`.

**Key handling.** The master key is read from the environment at start and validated (32 bytes). Losing it makes every diary unreadable; there is no recovery and no backdoor. Key rotation is prepared (each wrapped key records the KEK id) but not implemented yet: today one KEK is active, and a key wrapped by another one is refused.

**At rest and in transit.** Self-host can run Docker on an encrypted volume (LUKS, FileVault); that is the operator's choice and is documented in [`SELFHOST.md`](SELFHOST.md). With a domain, Caddy serves TLS with automatic certificates, the app sends HSTS, and cookies are Secure.

## Separation between people

- Data access in `packages/core` starts from `repositories.forUser(userId)`. Every repository is bound to that one person and adds `user_id` to every query; none accepts another person's id. The web app cannot import the ORM or the schema (an ESLint rule), so it cannot go around this.
- Every table carries a mandatory, indexed `user_id`, except `users` (its id is the scope) and `verification_tokens` (it exists before an account does and holds no ledger content). Composite foreign keys make the database itself refuse a message, or a consent, that points at another person's conversation or report.
- Each person's data is encrypted with their own key, so even a query that forgot its scope would read ciphertext it cannot open.
- A test has user A write to every repository and checks that user B cannot list, read, change or delete any of it. With the scope removed from one repository, four of those tests fail. An end-to-end test checks the same through the running app, with two separate browser sessions.

## Authentication

- Passwords are hashed with Argon2id (19 MiB, 2 passes, 1 lane), at least 10 characters.
- Sessions live in the database, last 7 days and are extended when used after a day; signing in always issues a new token, and signing out deletes the session on the server. There is no cookie cache, so a revoked session ends at once. Cookies are HTTP-only and SameSite=Lax.
- Sign-in is limited to 10 attempts a minute and sign-up to 10 every 10 minutes, per IP address (then HTTP 429). A wrong password and an unknown email get the same answer.
- Every page that shows data checks the session on the server; a forged or revoked cookie is redirected to sign in.
- Browser requests to the auth API from any origin other than `SINTR_URL` are refused (CSRF); browsers always send the origin on these requests. The app sends a nonce-based Content Security Policy (no third-party scripts, styles, fonts or frames), `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` and a restrictive `Permissions-Policy`.
- API tokens for external agents (F3) are stored only as a SHA-256 hash, carry scopes per data type, can expire and can be revoked. The token itself is shown once.

## Logs and telemetry

- Logs go through one boundary: a logger that writes only fields it knows to be operational (ids, counts, durations, codes). Anything else becomes `[redacted]`; errors keep only their name and code, because database messages can echo values. `console` is banned by lint in the code.
- Database errors are reduced to their SQLSTATE and constraint name before they leave the core.
- Caddy keeps no access log. Next.js and Better Auth telemetry are disabled. Fonts are self-hosted; the app loads nothing from third parties.

## Third parties

In F0, no personal data leaves the installation: there is no LLM call, no email, no analytics. When the embedded agent arrives (F1), self-host uses the operator's own provider key (or a local model), and the hosted offer will use zero-data-retention routes; this document will say which.

## Retention, export and deletion

- Expired sessions and verification tokens are removed every hour by the worker.
- Deleting an account removes every row the person owns, in every table, by cascade (tested in `packages/core`). There is no button for it in the app yet.
- Export (JSON and Markdown), deletion from the UI, configurable chat retention and the audit view arrive in F5. Until then, a self-host operator can run them directly; on the hosted offer they will exist before it opens.

## Known gaps

Recorded here so they are not mistaken for features:

- Better Auth 1.7 refreshes a session's expiry but does not rotate its token in place; a new token is issued at each sign-in.
- Without email delivery (it arrives with F2), there is no email verification, password reset or magic link, and sign-up still tells you when an email is already registered.
- The app connects to Postgres as the database owner; a least-privilege role is part of F4 hardening.
- Session IP addresses and user agents are kept for the life of the session.
- No MFA yet (F5).

This is a description of the software, not legal advice or a compliance claim.
