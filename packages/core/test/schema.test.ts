import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns, getTableName, is, sql } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import { afterAll, describe, expect, it } from "vitest";
import { KEY_MATERIAL, SEALED } from "../src/db/sealed";
import * as schema from "../src/db/schema";
import { openTestDatabase } from "./support";

const tables = (Object.values(schema) as unknown[]).filter((value): value is PgTable => is(value, PgTable));

/** Auth-internal tables without a `user_id` column, and why. */
const UNSCOPED = new Map([
  ["users", "the user row itself: its id is the scope"],
  ["verification_tokens", "exists before a user does; holds no ledger content"],
]);

const sealedColumns = new Set(Object.values(SEALED).flatMap((spec) => Object.values<string>(spec.columns)));
const keyColumns = new Set(
  KEY_MATERIAL.map(({ table, column }) => {
    const sqlName = (getTableColumns(table) as Record<string, { name: string }>)[column]!.name;
    return `${getTableName(table)}.${sqlName}`;
  }),
);

describe("schema invariants", () => {
  it("covers every entity of the data model", () => {
    expect(tables.map(getTableName).sort()).toEqual(
      [
        "accounts",
        "agent_settings",
        "api_tokens",
        "audit_log",
        "checkins",
        "consents",
        "conversations",
        "corrections",
        "entries",
        "insights",
        "messages",
        "profiles",
        "proposals",
        "report_revisions",
        "reports",
        "sessions",
        "therapy_notes",
        "therapy_settings",
        "user_keys",
        "users",
        "verification_tokens",
      ].sort(),
    );
  });

  it.each(tables.map((t) => [getTableName(t), t] as const))(
    "%s carries a mandatory, indexed user_id referencing users",
    (name, table) => {
      if (UNSCOPED.has(name)) return;
      const config = getTableConfig(table);
      const userId = config.columns.find((c) => c.name === "user_id");
      expect(userId, `${name}.user_id`).toBeDefined();
      expect(userId!.notNull).toBe(true);
      const referencesUsers = config.foreignKeys.some((fk) => {
        const ref = fk.reference();
        return getTableName(ref.foreignTable) === "users" && ref.columns.some((c) => c.name === "user_id");
      });
      expect(referencesUsers, `${name}.user_id references users`).toBe(true);
      const leadsAnIndex = config.indexes.some((index) => {
        const first = index.config.columns[0] as { name?: string } | undefined;
        return first?.name === "user_id";
      });
      expect(userId!.primary || leadsAnIndex, `${name} indexes user_id`).toBe(true);
    },
  );

  it("declares sensitive columns only on bytea, and every bytea column is sealed or key material", () => {
    const byteaColumns = new Set<string>();
    for (const table of tables) {
      for (const column of getTableConfig(table).columns) {
        if (column.getSQLType() === "bytea") byteaColumns.add(`${getTableName(table)}.${column.name}`);
      }
    }
    for (const column of sealedColumns) expect(byteaColumns.has(column), column).toBe(true);
    for (const column of byteaColumns) {
      expect(sealedColumns.has(column) || keyColumns.has(column), `${column} must be classified`).toBe(true);
    }
  });

  it("keeps free-text fields of the ledger out of clear-text columns", () => {
    const freeText = [
      "situation",
      "thoughts",
      "emotions",
      "body",
      "behavior",
      "notes",
      "note",
      "content",
      "title",
      "recipient",
      "payload",
      "previous",
      "api_key",
    ];
    for (const table of tables) {
      for (const column of getTableConfig(table).columns) {
        if (freeText.includes(column.name)) {
          expect(column.getSQLType(), `${getTableName(table)}.${column.name}`).toBe("bytea");
        }
      }
    }
  });
});

describe("migrations", () => {
  const db = openTestDatabase();
  afterAll(() => db.close());

  it("are in sync with the schema (drizzle-kit finds nothing to generate)", () => {
    const root = fileURLToPath(new URL("..", import.meta.url));
    const scratch = mkdtempSync(join(tmpdir(), "sintr-migrations-"));
    try {
      cpSync(join(root, "drizzle"), join(scratch, "drizzle"), { recursive: true });
      const config = join(scratch, "drizzle.config.ts");
      writeFileSync(
        config,
        `export default { dialect: "postgresql", schema: ${JSON.stringify(join(root, "src/db/schema/index.ts"))}, out: ${JSON.stringify(join(scratch, "drizzle"))} };\n`,
      );
      const before = readdirSync(join(scratch, "drizzle")).length;
      execFileSync(join(root, "node_modules/.bin/drizzle-kit"), ["generate", `--config=${config}`], {
        cwd: root,
        stdio: "pipe",
      });
      expect(
        readdirSync(join(scratch, "drizzle")).length,
        "run `make db-generate` and commit the migration",
      ).toBe(before);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });

  it("created every sealed column as bytea in Postgres", async () => {
    const rows = await db.db.execute<{ table_name: string; column_name: string; data_type: string }>(
      sql`select table_name, column_name, data_type from information_schema.columns where table_schema = 'public'`,
    );
    const types = new Map(rows.map((r) => [`${r.table_name}.${r.column_name}`, r.data_type]));
    for (const column of sealedColumns) expect(types.get(column), column).toBe("bytea");
  });
});
