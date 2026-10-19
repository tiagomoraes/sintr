import { randomUUID } from "node:crypto";
import { generateMasterKey, loadConfig, memoryTransport, type UserScope } from "@sintr/core";
import { createDatabase } from "@sintr/core/db";
import { createBaseRuntime } from "@sintr/core/runtime/base";
import { users } from "@sintr/core/schema";
import { afterAll, describe, expect, inject, it } from "vitest";
import { JOBS } from "../src/jobs";

/**
 * The practice notice, through the worker's own runtime: the configured
 * transport (in memory here), the app's address for the link, and the job
 * as the scheduler runs it. No network.
 */

const email = memoryTransport();
const runtime = createBaseRuntime(
  loadConfig({
    DATABASE_URL: inject("databaseUrl"),
    SINTR_AUTH_SECRET: randomUUID() + randomUUID(),
    SINTR_MASTER_KEY: generateMasterKey(),
    SINTR_URL: "https://diary.example.test",
    SINTR_LOG_LEVEL: "error",
  }),
  { service: "test", poolSize: 2, email },
);
const handle = createDatabase(inject("databaseUrl"), { max: 1 });

afterAll(async () => {
  await runtime.close();
  await handle.close();
});

async function account(label: string): Promise<UserScope> {
  const id = `${label}-${randomUUID()}`;
  await handle.db.insert(users).values({ id, email: `${id}@example.test`, emailVerified: true });
  await runtime.repositories.provision(id);
  return runtime.repositories.forUser(id);
}

describe("telling a practice that a report arrived", () => {
  it("emails a professional who asked for it, once, with a link to the practice and no name", async () => {
    const professional = await account("professional");
    await professional.practice.open({ professionalName: "Dr. Helena Prado" });
    await professional.practice.update({ notifyEmail: true });
    const person = await account("person");
    const invite = await professional.practice.createInvite();
    const link = await person.sharing.acceptInvite(invite.code, { consent: true, personName: "Iris" });
    const report = await person.reports.createDraft({
      periodStart: new Date("2026-10-05T00:00:00Z"),
      periodEnd: new Date("2026-10-12T00:00:00Z"),
      content: "{}",
    });
    await person.reports.markReviewed(report.id, { pdf: Buffer.from("%PDF-1.7 %%EOF") });
    await person.sharing.deliver({
      reportId: report.id,
      linkId: link.id,
      snapshot: {
        v: 1,
        content: {},
        period: { kind: "week", label: "2026-W41", start: "", end: "", session: null },
        verified: [],
        timeZone: "UTC",
        personName: null,
      },
      pdf: Buffer.from("%PDF-1.7 %%EOF"),
    });

    const job = JOBS.find((j) => j.name === "notify-practices")!;
    expect(await job.run(runtime, new Date())).toEqual({ sent: 1 });
    expect(await job.run(runtime, new Date())).toEqual({ sent: 0 });
    expect(email.sent).toHaveLength(1);
    const [message] = email.sent;
    expect(message!.to).toMatch(/^professional-/u);
    expect(message!.subject).toBe("A report was shared with you");
    expect(message!.text).toContain("https://diary.example.test/practice");
    expect(message!.text).not.toContain("Iris");
  });
});
