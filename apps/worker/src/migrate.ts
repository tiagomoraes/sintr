import { createLogger } from "@sintr/core";
import { runMigrations } from "@sintr/core/db";

/** The self-host `migrate` service: apply pending migrations, then exit. */
const log = createLogger({ service: "migrate" });
const url = process.env.DATABASE_URL;
const folder = process.env.SINTR_MIGRATIONS_DIR;

if (!url || !folder) {
  log.error("db.migrate.failed", { code: "DATABASE_URL_OR_SINTR_MIGRATIONS_DIR_MISSING" });
  process.exit(1);
}

try {
  const started = Date.now();
  await runMigrations(url, folder);
  log.info("db.migrate.done", { durationMs: Date.now() - started });
} catch (error) {
  log.error("db.migrate.failed", { error });
  process.exit(1);
}
