import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns, getTableName, inArray, is, sql } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import { afterAll, describe, expect, it } from "vitest";
import { KEY_MATERIAL, ROTATED, SEALED } from "../src/db/sealed";
import * as schema from "../src/db/schema";
import { createRepositories } from "../src/repositories";
import { inSchedule, upcomingSession } from "../src/report/period";
import { addDays, localDay, localParts, zonedTime } from "../src/report/time";
import { createUser, openTestDatabase, testMasterKey } from "./support";

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
        "invites",
        "links",
        "memories",
        "memory_reads",
        "messages",
        "notifications",
        "practices",
        "profiles",
        "proposals",
        "report_revisions",
        "reports",
        "sessions",
        "shared_reports",
        "subscriptions",
        "therapy_notes",
        "therapy_series",
        "therapy_series_changes",
        "therapy_settings",
        "usage_counters",
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
      const leadsThePrimaryKey = config.primaryKeys.some((key) => key.columns[0]?.name === "user_id");
      expect(userId!.primary || leadsAnIndex || leadsThePrimaryKey, `${name} indexes user_id`).toBe(true);
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

  it("stores every vector turned by its owner's rotation: each vector column is declared", () => {
    const rotated = new Set(
      ROTATED.map(({ table, column }) => {
        const sqlName = (getTableColumns(table) as Record<string, { name: string }>)[column]!.name;
        return `${getTableName(table)}.${sqlName}`;
      }),
    );
    const vectors: string[] = [];
    for (const table of tables) {
      for (const column of getTableConfig(table).columns) {
        if (column.getSQLType() === "vector") vectors.push(`${getTableName(table)}.${column.name}`);
      }
    }
    expect(vectors).toEqual(["memories.embedding"]);
    for (const column of vectors)
      expect(rotated.has(column), `${column} must be declared in ROTATED`).toBe(true);
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
      "code",
      "person_name",
      "professional_name",
      "practice_name",
      "registration",
      "snapshot",
      "pdf",
      "text",
      "quote",
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

  it("send nobody who already kept a diary through the welcome (0006)", async () => {
    const root = fileURLToPath(new URL("..", import.meta.url));
    const backfill = readFileSync(join(root, "drizzle/0006_welcome_and_voice.sql"), "utf8")
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .find((statement) => statement.includes('INSERT INTO "profiles"'));
    expect(backfill, "the backfill statement").toBeDefined();
    const withRow = await createUser(db.db, "before-welcome");
    const withoutRow = await createUser(db.db, "before-welcome-bare");
    const done = new Date("2026-10-01T09:00:00Z");
    await db.db.insert(schema.profiles).values({ userId: withRow, timezone: "America/Sao_Paulo" });
    const finished = await createUser(db.db, "before-welcome-done");
    await db.db.insert(schema.profiles).values({ userId: finished, onboardedAt: done });
    await db.db.execute(sql.raw(backfill!));
    const rows = await db.db
      .select({
        userId: schema.profiles.userId,
        at: schema.profiles.onboardedAt,
        zone: schema.profiles.timezone,
      })
      .from(schema.profiles)
      .where(inArray(schema.profiles.userId, [withRow, withoutRow, finished]));
    const byId = new Map(rows.map((row) => [row.userId, row]));
    expect(byId.get(withRow)?.at).toBeInstanceOf(Date);
    // A profile the person set keeps what it held.
    expect(byId.get(withRow)?.zone).toBe("America/Sao_Paulo");
    expect(byId.get(withoutRow)?.at).toBeInstanceOf(Date);
    expect(byId.get(finished)?.at).toEqual(done);
  });

  it("keep a report language chosen before F7, and let the default follow the person (0007)", async () => {
    const root = fileURLToPath(new URL("..", import.meta.url));
    const backfill = readFileSync(join(root, "drizzle/0007_languages.sql"), "utf8")
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .find((statement) => statement.includes('UPDATE "profiles"'));
    expect(backfill, "the backfill statement").toBeDefined();
    const chose = await createUser(db.db, "report-pt");
    const spanish = await createUser(db.db, "report-es");
    const english = await createUser(db.db, "report-en");
    await db.db.insert(schema.profiles).values([
      { userId: chose, language: "pt-BR" },
      { userId: spanish, language: "es" },
      { userId: english, language: "en" },
    ]);
    await db.db.execute(sql.raw(backfill!));
    const rows = await db.db
      .select({ userId: schema.profiles.userId, report: schema.profiles.reportLanguage })
      .from(schema.profiles)
      .where(inArray(schema.profiles.userId, [chose, spanish, english]));
    const byId = new Map(rows.map((row) => [row.userId, row.report]));
    expect(byId.get(chose)).toBe("pt-BR");
    expect(byId.get(spanish)).toBe("es");
    // English was everyone's default, so it says nothing of a choice: their reports follow their language.
    expect(byId.get(english)).toBeNull();
  });

  it("carry pgvector, and stop with a readable message where it is missing (0009)", async () => {
    const rows = await db.db.execute<{ extversion: string }>(
      sql`select extversion from pg_extension where extname = 'vector'`,
    );
    expect(rows[0]?.extversion).toMatch(/^0\.8\./u);
    const root = fileURLToPath(new URL("..", import.meta.url));
    const [check, create] = readFileSync(join(root, "drizzle/0009_memory.sql"), "utf8")
      .split("--> statement-breakpoint")
      .map((part) => part.trim());
    expect(check).toContain("pg_available_extensions");
    expect(check).toContain("RAISE EXCEPTION");
    expect(create).toBe("CREATE EXTENSION IF NOT EXISTS vector;");
  });

  it("empty the one-off session date Therapy no longer asks, and keep its column (0008)", async () => {
    const root = fileURLToPath(new URL("..", import.meta.url));
    const statement = readFileSync(join(root, "drizzle/0008_no_moved_session.sql"), "utf8")
      .split("--> statement-breakpoint")
      .map((part) => part.trim())
      .find((part) => part.includes('UPDATE "therapy_settings"'));
    expect(statement, "the statement that empties it").toBeDefined();
    const moved = await createUser(db.db, "moved-session");
    await db.db.insert(schema.therapySettings).values({
      userId: moved,
      sessionDay: 1,
      sessionTime: "18:00",
      nextSessionAt: new Date("2026-10-22T22:30:00Z"),
    });
    await db.db.execute(sql.raw(statement!));
    const [row] = await db.db
      .select({ day: schema.therapySettings.sessionDay, once: schema.therapySettings.nextSessionAt })
      .from(schema.therapySettings)
      .where(inArray(schema.therapySettings.userId, [moved]));
    // The weekly schedule is the person's and stays; the one-off date is gone.
    expect(row).toEqual({ day: 1, once: null });
  });

  it("keep every weekly slot as a weekly rhythm, with the same next session, and empty the slot (0009)", async () => {
    const root = fileURLToPath(new URL("..", import.meta.url));
    const statements = readFileSync(join(root, "drizzle/0009_therapy_calendar.sql"), "utf8")
      .split("--> statement-breakpoint")
      .map((part) => part.trim())
      .filter(
        (part) => part.includes('INSERT INTO "therapy_series"') || part.includes('UPDATE "therapy_settings"'),
      );
    expect(statements, "the statements that move the slot").toHaveLength(2);
    const zone = "America/Sao_Paulo";
    const people = [
      // Set long ago, set yesterday, in two zones; and one person with no slot at all.
      {
        id: await createUser(db.db, "slot-old"),
        day: 2,
        time: "18:00",
        zone,
        updatedAt: new Date("2026-03-02T12:00:00Z"),
      },
      {
        id: await createUser(db.db, "slot-new"),
        day: 5,
        time: "07:30",
        zone: "Asia/Tokyo",
        updatedAt: new Date(Date.now() - 86_400_000),
      },
      { id: await createUser(db.db, "slot-none"), day: null, time: null, zone, updatedAt: new Date() },
    ];
    for (const person of people) {
      await db.db.insert(schema.profiles).values({ userId: person.id, timezone: person.zone });
      await db.db.insert(schema.therapySettings).values({
        userId: person.id,
        sessionDay: person.day,
        sessionTime: person.time,
        updatedAt: person.updatedAt,
      });
    }
    for (const statement of statements) await db.db.execute(sql.raw(statement));

    const repositories = createRepositories(db.db, testMasterKey);
    const now = new Date();
    for (const person of people) {
      const scope = await repositories.forUser(person.id);
      const schedule = await scope.sessions.schedule();
      const [settings] = await db.db
        .select({ day: schema.therapySettings.sessionDay, time: schema.therapySettings.sessionTime })
        .from(schema.therapySettings)
        .where(inArray(schema.therapySettings.userId, [person.id]));
      expect(settings, "the slot is emptied").toEqual({ day: null, time: null });
      if (person.day === null) {
        expect(schedule.series).toEqual([]);
        continue;
      }
      expect(schedule.series).toEqual([
        expect.objectContaining({ time: person.time, repeat: "weekly", stopsOn: null }),
      ]);
      // The next session is the one the weekly slot gave: the slot's day and time, after now, in their zone.
      let day = localDay(now, person.zone);
      let next: Date | null = null;
      for (let i = 0; i < 9 && !next; i += 1, day = addDays(day, 1)) {
        const [year, month, date] = day.split("-").map(Number) as [number, number, number];
        const at = zonedTime(
          {
            year,
            month,
            day: date,
            hour: Number(person.time.slice(0, 2)),
            minute: Number(person.time.slice(3)),
          },
          person.zone,
        );
        if (localParts(at, person.zone).weekday === person.day && at > now) next = at;
      }
      expect(upcomingSession(schedule, person.zone, now)).toEqual(next);
      // The week before is still a session of the rhythm, so a draft prepared for it stays where it is.
      expect(inSchedule(schedule, person.zone, new Date(next!.getTime() - 7 * 86_400_000))).toBe(true);
    }
  });
});
