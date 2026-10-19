# Languages

sintr speaks English and Brazilian Portuguese. The language is configuration, as on the site: every word the app shows lives in a catalog, one folder per language, and nothing in the code names a language. This page is for whoever runs a sintr: how the language of a page is decided, how to run an installation in one language, and how to add one.

## Who decides the language

For every page, in this order (DECISIONS 98):

1. **The person's own choice.** In Settings, "Your language", or the quiet link at the foot of a page ("Ler o sintr em português" on an English page, "Read sintr in English" on a Portuguese one). Signed in, it is kept on their profile and follows them to every device; before signing in it is kept in this browser (a cookie, `sintr_language`), and a person who chose before creating their account keeps that choice in it.
2. **The installation's language**, `SINTR_LANGUAGE` in `.env`, for a sintr that is entirely in one language.
3. **The browser's languages** (`Accept-Language`), the first one sintr speaks. A variant answers with the language sintr has: a browser in `pt-PT` reads Brazilian Portuguese.
4. **English.**

What follows the language: every screen, the help lines, the dates, the emails sintr sends the person and the language the assistant is told the person reads. What does not: the person's own words, which stay exactly as written in any language, and the assistant's replies, which follow the language the person writes in. The weekly report follows the person's language unless they chose another in Therapy ("The report's language").

## One language for the whole installation

In `.env`:

```bash
SINTR_LANGUAGE=pt-BR
```

and `make selfhost-up` again. Everyone who has not chosen a language reads that one, whatever their browser says; anyone can still choose another in Settings. The value must be a language this sintr has a catalog for (the `code` in `apps/web/messages/languages.json`); any other value stops the app with a message naming `SINTR_LANGUAGE`. The worker uses it too, for the reports and emails of people who have not opened sintr since.

## Adding a language

A language is a folder of catalog files and one line of configuration. No code changes.

1. **Copy English.** `apps/web/messages/en/` is the source: one file per screen or feature (`home.ts`, `welcome.ts`, `reports.ts`...). Copy the folder to the new language's code, a BCP 47 tag such as `es` or `fr`:

   ```bash
   cp -r apps/web/messages/en apps/web/messages/es
   ```

2. **Translate every file.** Each file keeps exactly the same keys and the same shape as English: lists the same length, sentences that carry a value (`(name: string) => ...`) the same parameters. Write the function bodies the way your language needs (gender, plural, word order); they need not mirror the English logic. Make each file check itself against English by ending it with `satisfies Messages["<feature>"]`, as the Portuguese files do (`apps/web/messages/pt-BR/home.ts` is a good model), with `import type { Messages } from "../types";` at the top. Translation rules and a glossary are below.

3. **List it.** Add one line to `apps/web/messages/languages.json`:

   ```json
   { "code": "es", "name": "Español", "intl": "es", "detect": ["es"] }
   ```

   `code` is the folder's name. `name` is the language in its own words, as the choice in Settings shows it. `intl` is how dates and numbers are written (an Intl locale, often the code itself; English uses `en-GB`). `detect` lists the browser languages it answers, by their first part (`es` answers `es-AR`, `es-MX` and `es`).

4. **Register and check it.**

   ```bash
   make languages   # writes the registry from languages.json (the build does it too)
   make test        # the parity test says, by key, anything missing or different from English
   make lint        # the copy rules, in every language: no em or en dashes, no emoji
   ```

5. **Run it.** `make selfhost-up` builds the image with the new language. Set `SINTR_LANGUAGE=es` too if the whole installation should speak it.

**Translating a little at a time.** A screen you have not translated yet can be left out of your folder's `index.ts` (keep the file list in it as in English, minus that screen): it is then read in English, whole. A screen is always either all in your language or all in English, never half, and never a key in place of a sentence. The parity test still fails until every screen is there, so you know what is left.

**What lives outside the catalog.** Three things sintr writes without a page live in its core, in the languages it already has:

- **The printed report** (headings, labels, the footnotes of the PDF) is in English, Portuguese and Spanish (`packages/core/src/report/strings.ts`). A person can choose any of those for their reports in Therapy. A language outside these three prints its reports in English until those strings exist there.
- **The emails to a person or a practice** (a report is ready, a new password, the address confirmation, a report shared) are in English and Portuguese (`packages/core/src/email/messages.ts`); any other language gets them in English. The email that carries a report to a therapist follows the report's language.
- **The message that stops the diary when someone writes about acute risk** is written in English, Portuguese and Spanish (`packages/agent/src/crisis.ts`), and the screen that recognises risk reads those three languages, before any model. It does not depend on the language of the page.

Adding these for a new language is a change to code, reviewed like any other: the crisis screen especially, since it must recognise how people say they are in danger in that language without stopping on idioms.

**The help lines** on every page are Brazil's (CVV 188, SAMU 192), with findahelpline.com for anywhere else, in every language. Their words are in the catalog (`crisis.ts`); the numbers are not, and change only by a decision recorded in `docs/DECISIONS.md`.

## How to translate

Read `apps/web/messages/en/` and the screens themselves before translating: each file starts with what the screen is for. Then:

1. **The person's words are sacred.** Nothing here translates what a person wrote; only what sintr says around it.
2. **The voice holds in every language.** Calm, private, precise. Plain words, no jargon, no clinical terms, no exclamation marks, no wellness-app empathy, nothing childish. Address the person as "you" in the form your language uses with someone you respect but are close to (Portuguese "você", Spanish "tú").
3. **No em dashes or en dashes, no emoji.** `make lint` and the parity test refuse them in every language. Use a comma, a colon or a full stop.
4. **Keep it about as short as the English.** The screens were cut to be short on purpose.
5. **Never translate:** `sintr` (always lowercase), CVV, SAMU, the names of other assistants and providers (ChatGPT, Claude, Gemini, Hermes, OpenRouter, OpenAI, Groq, Google, Anthropic), MCP, commands, addresses and keys.
6. **Consent.** The words a person agrees to (the consent at sign-up, linking with a practice, sending or sharing a report) say exactly what the English says, in your language: nothing softened, nothing added. A translation does not change the consent's version; a change of meaning does, in every language at once.
7. **Dates and numbers** are written by the browser's Intl in the language's `intl` locale: do not write month or weekday names into the catalog, except where English does.

Glossary of the languages sintr ships:

| English | Português (Brasil) |
| --- | --- |
| diary | diário |
| entry (thought record) | registro |
| check-in | check-in |
| report | relatório |
| session | sessão |
| therapist | terapeuta |
| practice (a therapist's) | consultório |
| patient | paciente |
| assistant | assistente |
| conversation | conversa |
| draft | rascunho |
| invite / link (with a practice) | convite / vínculo |
| Settings / Sharing / Home | Ajustes / Compartilhar / Início |
| Free / Personal / Unlimited plans | Gratuito / Pessoal / Ilimitado |
| "Tell me what happened." | "Me conta o que aconteceu." |

The Portuguese of the printed report (`packages/core/src/report/strings.ts`) uses the same words; keep the app and the report in step.
