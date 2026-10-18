// Create .env from .env.example with fresh secrets. Never overwrites an
// existing .env and never prints a secret.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const target = `${root}.env`;

if (existsSync(target)) {
  console.log(".env already exists, leaving it as it is");
  process.exit(0);
}

const generators = {
  SINTR_AUTH_SECRET: () => randomBytes(48).toString("base64url"),
  SINTR_MASTER_KEY: () => randomBytes(32).toString("base64"),
  POSTGRES_PASSWORD: () => randomBytes(24).toString("hex"),
};

const lines = readFileSync(`${root}.env.example`, "utf8").split("\n");
const values = {};
for (const line of lines) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
  if (match) values[match[1]] = match[2];
}
for (const [key, generate] of Object.entries(generators)) {
  if (!values[key]) values[key] = generate();
}
values.DATABASE_URL ||= `postgres://${values.POSTGRES_USER}:${values.POSTGRES_PASSWORD}@localhost:${values.SINTR_DEV_DB_PORT}/${values.POSTGRES_DB}`;

const output = lines.map((line) => {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
  return match ? `${match[1]}=${values[match[1]]}` : line;
});

writeFileSync(target, output.join("\n"), { mode: 0o600 });
console.log("wrote .env with fresh secrets (mode 600)");
