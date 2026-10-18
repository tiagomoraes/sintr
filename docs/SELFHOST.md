# Self-hosting sintr

sintr runs on your own machine as four containers behind one command: Caddy (the only thing that listens on the host), the app, the worker and Postgres 16. Everything is configured by `.env`; every variable is explained in [`.env.example`](../.env.example).

## What you need

- Docker with Compose v2 (`docker compose version`)
- `make` and a POSIX shell (Linux, macOS, or WSL on Windows)
- about 1 GB of disk for the image and the database

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

Open `http://localhost:3000`, create your account and give the consent it asks for. That is all.

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

**The app container is not healthy.** `docker compose -f docker/compose.yaml --env-file .env logs app` shows why. A message about `invalid configuration` names the variable to fix.

## What runs where

| Service | Image | Role |
| --- | --- | --- |
| `caddy` | `caddy:2-alpine` | the edge: HTTP or automatic HTTPS, compression, reverse proxy to the app |
| `app` | `sintr-app:local` | the Next.js app (UI, API, auth) on port 3000, inside the network only |
| `worker` | `sintr-app:local` | background jobs; today it removes expired sessions every hour |
| `migrate` | `sintr-app:local` | applies migrations, then exits |
| `db` | `postgres:16-alpine` | the database, on the `pgdata` volume |

The same code runs the hosted offer; `SINTR_MODE=saas` is the switch, and nothing is built separately.
