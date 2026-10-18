import { runMigrations } from "@sintr/core/db";
import postgres from "postgres";

/** A fresh database for this run, migrated from the committed SQL files. */
export default async function globalSetup() {
  const target = new URL(process.env.SINTR_E2E_DATABASE_URL!);
  const name = target.pathname.slice(1);
  const admin = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => undefined });
  try {
    await admin.unsafe(`drop database if exists ${name} with (force)`);
    await admin.unsafe(`create database ${name}`);
  } finally {
    await admin.end();
  }
  await runMigrations(target.toString());
}
