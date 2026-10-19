import { runMigrations } from "@sintr/core/db";
import postgres from "postgres";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
    /** A database of its own for the house assistant's test, whose scheduler must see only its people. */
    houseDatabaseUrl: string;
  }
}

const TEST_DATABASES = {
  databaseUrl: "sintr_test_worker",
  houseDatabaseUrl: "sintr_test_worker_house",
} as const;

/** Fresh databases per run, migrated from the committed SQL files. */
export default async function setup(project: TestProject) {
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL is not set: run the tests with `make test`");
  for (const [key, name] of Object.entries(TEST_DATABASES) as [keyof typeof TEST_DATABASES, string][]) {
    const admin = postgres(base, { max: 1, onnotice: () => undefined });
    try {
      await admin.unsafe(`drop database if exists ${name} with (force)`);
      await admin.unsafe(`create database ${name}`);
    } finally {
      await admin.end();
    }
    const url = new URL(base);
    url.pathname = `/${name}`;
    await runMigrations(url.toString());
    project.provide(key, url.toString());
  }
}
