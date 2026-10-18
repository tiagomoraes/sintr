import { runMigrations } from "@sintr/core/db";
import postgres from "postgres";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

const TEST_DATABASE = "sintr_test_worker";

/** A fresh database per run, migrated from the committed SQL files. */
export default async function setup(project: TestProject) {
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL is not set: run the tests with `make test`");
  const admin = postgres(base, { max: 1, onnotice: () => undefined });
  try {
    await admin.unsafe(`drop database if exists ${TEST_DATABASE} with (force)`);
    await admin.unsafe(`create database ${TEST_DATABASE}`);
  } finally {
    await admin.end();
  }
  const url = new URL(base);
  url.pathname = `/${TEST_DATABASE}`;
  await runMigrations(url.toString());
  project.provide("databaseUrl", url.toString());
}
