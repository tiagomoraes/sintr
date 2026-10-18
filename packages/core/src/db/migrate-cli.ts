import { createLogger } from "../log";
import { MIGRATIONS_FOLDER, runMigrations } from "./migrate";

/** `make migrate` and the self-host `migrate` service run this. */
const log = createLogger({ service: "migrate" });
const url = process.env.DATABASE_URL;

if (!url) {
  log.error("db.migrate.failed", { code: "DATABASE_URL_MISSING" });
  process.exit(1);
}

try {
  const started = Date.now();
  await runMigrations(url, process.env.SINTR_MIGRATIONS_DIR ?? MIGRATIONS_FOLDER);
  log.info("db.migrate.done", { durationMs: Date.now() - started });
} catch (error) {
  log.error("db.migrate.failed", { error });
  process.exit(1);
}
