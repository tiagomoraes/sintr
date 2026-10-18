#!/bin/sh
# Create .env from .env.example with fresh secrets. POSIX sh only, so a
# self-host needs no Node. Never overwrites an existing .env and never
# prints a secret.
set -eu
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  echo ".env already exists, leaving it as it is"
  exit 0
fi

random_base64() { head -c "$1" /dev/urandom | base64 | tr -d '\n'; }
random_hex() { od -An -tx1 -N"$1" /dev/urandom | tr -d ' \n'; }

auth_secret=$(random_base64 48 | tr '+/' '-_' | tr -d '=')
master_key=$(random_base64 32)
postgres_password=$(random_hex 24)
# A dev database port per checkout, stable for its path.
dev_db_port=$((54000 + $(pwd | cksum | cut -d' ' -f1) % 900))

umask 077
awk -v auth="$auth_secret" -v master="$master_key" -v pg="$postgres_password" -v port="$dev_db_port" '
  BEGIN { FS = OFS = "=" }
  /^[A-Z0-9_]+=/ { key = $1; value = substr($0, length(key) + 2); values[key] = value }
  { lines[NR] = $0 }
  END {
    if (values["SINTR_AUTH_SECRET"] == "") values["SINTR_AUTH_SECRET"] = auth
    if (values["SINTR_MASTER_KEY"] == "") values["SINTR_MASTER_KEY"] = master
    if (values["POSTGRES_PASSWORD"] == "") values["POSTGRES_PASSWORD"] = pg
    if (values["SINTR_DEV_DB_PORT"] == "") values["SINTR_DEV_DB_PORT"] = port
    if (values["DATABASE_URL"] == "")
      values["DATABASE_URL"] = "postgres://" values["POSTGRES_USER"] ":" values["POSTGRES_PASSWORD"] \
        "@localhost:" values["SINTR_DEV_DB_PORT"] "/" values["POSTGRES_DB"]
    for (i = 1; i <= NR; i++) {
      line = lines[i]
      if (match(line, /^[A-Z0-9_]+=/)) {
        key = substr(line, 1, RLENGTH - 1)
        line = key "=" values[key]
      }
      print line
    }
  }
' .env.example > .env

echo "wrote .env with fresh secrets (mode 600)"
