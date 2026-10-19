# Running sintr for other people

For whoever runs sintr for people other than themselves: the hosted offer, or a self-host shared with a family or a practice. It covers the house assistant, plans, and payments. Keeping a diary on your own machine needs none of this; [`SELFHOST.md`](SELFHOST.md) is enough. Every variable is also explained in [`.env.example`](../.env.example), and the reasons are in [`DECISIONS.md`](DECISIONS.md) 69 to 83 (the house and plans), 86 to 90 (speaking) and 113 to 119 (the memory).

## The house assistant

Give the installation one provider, one model and one key, and everyone on it can talk to the assistant without bringing a key of their own:

```bash
SINTR_HOUSE_PROVIDER=anthropic          # anthropic, google or openai_compatible
SINTR_HOUSE_MODEL=claude-haiku-5-5      # the model's name, as the provider writes it
SINTR_HOUSE_KEY=sk-ant-...              # a server secret; see below
SINTR_HOUSE_NAME=Anthropic              # who people are told receives their words
# For openai_compatible (OpenAI, OpenRouter, a LiteLLM gateway):
# SINTR_HOUSE_BASE_URL=https://openrouter.ai/api/v1
```

Then start again (`make selfhost-up`, or your deploy). A missing piece stops the start with the variable's name in the log.

- **The key** is read from the environment only. It is never stored in the database, never shown to anyone, and never logged; keep it out of the repository and out of chat. To rotate it, change the variable and restart: nothing else holds it.
- **Choose the route with care.** Everything people say to the assistant goes to that provider under your agreement with it, and Settings names it (`SINTR_HOUSE_NAME`). Prefer a route that does not train on what it receives and keeps it no longer than needed (zero data retention), and say which in your privacy notice. A gateway on your own private network is allowed (`http://litellm:4000/v1`), even in saas mode, where it must ask for a key (`SINTR_HOUSE_KEY`) and be named (`SINTR_HOUSE_NAME`): a gateway that answers anyone could be used as someone's "own" provider, uncounted. Nobody can save the house's own address as their key.
- **Choose the model for the cost.** A message with a draft is two calls of 3,000 to 4,000 tokens; on a small model that is about one cent, so a person using all of Personal costs in the order of 6 USD a month (DECISIONS 72).
- **People can still bring their own key**, in Settings behind "Use your own key instead". Then their words go to their provider, and nothing of theirs is counted.

## Speaking (speech to text)

People can speak on the home instead of typing; what they say is written down, handed back to them to read, and sent only when they send it. By default the house writes it down through its own provider and key, when that provider transcribes:

| House provider | Transcription | Model by default |
| --- | --- | --- |
| OpenRouter (`openai_compatible`, `https://openrouter.ai/api/v1`) | `/audio/transcriptions`, the house key | `openai/whisper-large-v3-turbo` |
| OpenAI (`https://api.openai.com/v1`) | `/audio/transcriptions`, the house key | `gpt-4o-mini-transcribe` |
| Groq (`https://api.groq.com/openai/v1`) | `/audio/transcriptions`, the house key | `whisper-large-v3-turbo` |
| Google | Gemini listens (the recording is sent as WAV) | the house model |
| Anthropic | none of its own: set an endpoint below, or speaking stays off | |
| another gateway (LiteLLM) | `/audio/transcriptions`, only if you name the model | `SINTR_HOUSE_STT_MODEL` |

```bash
SINTR_HOUSE_STT_MODEL=openai/whisper-large-v3-turbo   # another model, or "off" for no speaking
SINTR_HOUSE_STT_LANGUAGE=pt                          # what to expect when a person's writing says nothing
# A transcription endpoint of its own, for an Anthropic house (both together):
# SINTR_HOUSE_STT_BASE_URL=https://openrouter.ai/api/v1
# SINTR_HOUSE_STT_KEY=sk-or-...
```

- **The recording is not kept.** It is held in memory for the one call and dropped; the log has a code and the seconds. Choose the route as for the assistant: OpenRouter's account privacy settings (zero data retention, no training) apply to transcription too.
- **It is counted.** Free has 15 minutes of speaking a month and Personal 120, counted to the second; at the end of the month's time the Speak button goes and the box stays.
- **Someone on their own key** is heard by their own provider (OpenRouter, OpenAI, Groq or Google), never the house; with Anthropic or a local model they write, and the home says why in one line.
- It needs the page to be served over https (a phone's browser only opens the microphone there, or on localhost).

## The memory (embeddings)

A person who turns on the memory in Memory has their diary read by the house's model and each memory placed by meaning by an embeddings model. By default the house uses its own provider and key, when that provider has embeddings:

| House provider | Embeddings | Model by default |
| --- | --- | --- |
| OpenRouter (`https://openrouter.ai/api/v1`) | `/embeddings`, the house key | `openai/text-embedding-3-small` (1536 numbers) |
| OpenAI (`https://api.openai.com/v1`) | `/embeddings`, the house key | `text-embedding-3-small` |
| Google | `batchEmbedContents`, the house key | `gemini-embedding-001`, at 1536 |
| Anthropic | none of its own: set an endpoint below, or the memory is not offered | |
| another gateway (LiteLLM) | `/embeddings`, only if you name the model | `SINTR_HOUSE_EMBED_MODEL` |

```bash
SINTR_HOUSE_EMBED_MODEL=openai/text-embedding-3-small   # another model, or "off" for no memory
# An embeddings endpoint of its own, for an Anthropic house (both together):
# SINTR_HOUSE_EMBED_BASE_URL=https://api.openai.com/v1
# SINTR_HOUSE_EMBED_KEY=sk-...
```

- **People are told who receives their diary**, and agree to exactly those: the house's name (`SINTR_HOUSE_NAME`) and, with an endpoint of its own, that endpoint's service (OpenAI, OpenRouter) or host. Changing either pauses everyone's memory until each person agrees again; changing the model alone re-places their memories with the new one, the next time the worker reads.
- **It is bounded, not counted.** At most 100 pages a person a day are read (one call to the house model per 8 pages, plus one embeddings call); it does not count on anyone's plan. Every message of a person whose memory is on also places their words (one embeddings call, a fraction of a cent per thousand messages).
- **Embeddings are not stored as the provider made them.** Each vector is turned by a rotation derived from the person's own data key (DECISIONS 114). Changing `SINTR_MASTER_KEY` is not a thing you do; if a person's data key ever changed, their memories would be placed again.
- **Postgres needs pgvector.** The bundled stack builds it in (`docker/postgres.Dockerfile`); a Postgres of your own needs the extension installed before migration 0009 ([`SELFHOST.md`](SELFHOST.md), "Upgrading to the memory").
- The worker logs `memory.read` (how many kept, after how many attempts), `memory.page_not_read` with `crisis_screen` (pages never sent), `memory.read_failed` and `memory.embedding_failed` with a code; never a word.

## Plans

With a house assistant, each person has a plan: how many of its messages and reports they can use a month. The diary itself never depends on it.

| Plan | Messages a month | Reports a month | Who |
| --- | --- | --- | --- |
| Free | 100 | 4 | everyone, by default (`SINTR_PERSON_PLAN=free`) |
| Personal | 600 | 12 | a subscription, a grant, or a practice with a plan of its own |
| Unlimited | no limit | no limit | a grant, or `SINTR_PERSON_PLAN=unlimited` for everyone (a family server) |

A practice has seats: one for each patient linked or invite waiting. Without a plan of its own it follows `SINTR_PRACTICE_SEATS` (unlimited on a self-host, one on the hosted offer). A practice with a plan of its own also gets Personal for the professional's own diary.

Without payments, plans are given by hand:

```bash
make person-plan EMAIL=ana@example.com PLAN=personal       # or unlimited
make person-plan EMAIL=ana@example.com PLAN=default        # back to SINTR_PERSON_PLAN
make practice-plan EMAIL=dr@example.com SEATS=10 PLAN="Practice 10"
```

Inside the self-host stack the same commands are in the image: `docker compose -f docker/compose.yaml --env-file .env exec -e SINTR_PLAN_EMAIL=ana@example.com -e SINTR_PLAN_NAME=personal worker node worker/person-plan.mjs`. Both refuse an account that already pays for its plan; that changes in Stripe. Every change is in the account's audit log.

## Payments

Payments are written and tested, and off until configured. A person subscribes to Personal on the plan screen, a therapist chooses seats for their practice, both pay on Stripe's own Checkout page and manage it on Stripe's billing page, and Stripe's webhook changes the plan. sintr never sees a card. No real charge has been made from this code yet.

### What is missing to turn payments on

1. **A Stripe account activated for live payments**: business details and a bank account (in Brazil, a CNPJ or CPF and a Brazilian account).
2. **Two recurring monthly prices**, in reais: Personal (one per person) and Practice seat (charged per seat; the seats are the quantity). Their ids go in `SINTR_STRIPE_PRICE_PERSONAL` and `SINTR_STRIPE_PRICE_PRACTICE_SEAT`. Either may be left out to sell only the other.
3. **A key** in `SINTR_STRIPE_SECRET_KEY`: the secret key, or better a restricted key allowed to write Checkout Sessions and Customer Portal sessions and to read Prices and Subscriptions.
4. **A webhook endpoint** at `https://your-domain/api/billing/webhook`, sending `customer.subscription.created`, `.updated`, `.deleted`, `.paused` and `.resumed`; its signing secret goes in `SINTR_STRIPE_WEBHOOK_SECRET`.
5. **The customer portal**, configured in Stripe's dashboard: allow cancelling, changing the payment method, and changing the quantity of the seat price (that is how a practice changes its seats).
6. Restart. The plan screen then shows the prices and the Subscribe buttons. Try it end to end in test mode first (`sk_test_` keys, a test card, and `stripe listen --forward-to localhost:3000/api/billing/webhook`).

Not built, and needed before charging real money: invoices and taxes (Stripe does not issue a Brazilian service invoice, NFS-e; that needs a separate service), terms of service and a public price page, and the handling of refunds and disputes (in Stripe's dashboard). Pix can be turned on as a payment method in Stripe's dashboard; no code changes.

### What the logs say

`billing.webhook` with a code: `applied` (the plan changed), `unchanged` (a repeat), `ignored` (not about a subscription), `unrelated` (a subscription sintr did not start), `unknown_account`, `unknown_price` (a price this installation does not sell), or `duplicate` (a second active subscription of the same kind for one account, kept apart: refund or cancel it in Stripe). `billing.webhook_refused` is a bad signature (check `SINTR_STRIPE_WEBHOOK_SECRET`); `billing.webhook_failed` answered 503, and Stripe delivers again. `billing.checkout_failed` and `billing.portal_failed` carry Stripe's answer as a code; the person was told nothing was charged. No log line holds an email, a key or a card.
