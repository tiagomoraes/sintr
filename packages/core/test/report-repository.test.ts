import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type DataAccessError, InvalidStateError, NotFoundError } from "../src/errors";
import { draftContent } from "../src/report/draft";
import { buildDigest } from "../src/report/digest";
import { parseContent, serializeContent } from "../src/report/content";
import { createRepositories, type UserScope } from "../src/repositories";
import { DEMO_PERIOD, DEMO_TZ, demoRecords } from "./report-fixtures";
import { createUser, openTestDatabase, testMasterKey } from "./support";

describe("reports: changes keep what the report said before", () => {
  const handle = openTestDatabase();
  const repositories = createRepositories(handle.db, testMasterKey);
  let scope: UserScope;
  let other: UserScope;
  const { entries, checkins } = demoRecords();
  const content = draftContent({
    digest: buildDigest({ period: DEMO_PERIOD, timeZone: DEMO_TZ, entries, checkins }),
    language: "pt",
    toBring: [],
  });

  beforeAll(async () => {
    const id = await createUser(handle.db, "reports");
    const otherId = await createUser(handle.db, "other");
    await repositories.provision(id);
    await repositories.provision(otherId);
    scope = await repositories.forUser(id);
    other = await repositories.forUser(otherId);
  });

  afterAll(() => handle.close());

  it("creates a prepared draft, records the person's edit as a revision, and makes it a draft again", async () => {
    const report = await scope.reports.createDraft({
      periodStart: DEMO_PERIOD.start,
      periodEnd: DEMO_PERIOD.end,
      sessionAt: DEMO_PERIOD.session,
      content: serializeContent(content),
    });
    expect(report).toMatchObject({ status: "draft", editedAt: null, notifiedAt: null });
    expect(report.generatedAt).not.toBeNull();
    expect(parseContent(report.content)).toEqual(content);

    await scope.reports.markReviewed(report.id, { pdf: Buffer.from("%PDF-reviewed") });
    const edited = await scope.reports.edit(
      report.id,
      serializeContent({ ...content, week: "Uma semana puxada." }),
    );
    expect(edited).toMatchObject({ status: "draft", reviewedAt: null, hasPdf: false });
    expect(edited.editedAt).not.toBeNull();

    const [revision] = await scope.reports.revisions(report.id);
    expect(revision).toMatchObject({ kind: "edited", sections: ["week"] });
    expect(parseContent(revision!.previous)).toEqual(content);
  });

  it("prepares a report again for a moved session: same start, new end, the edit forgotten but kept", async () => {
    const report = await scope.reports.createDraft({
      periodStart: new Date("2026-09-01T00:00:00Z"),
      periodEnd: new Date("2026-09-08T00:00:00Z"),
      content: serializeContent(content),
    });
    await scope.reports.edit(report.id, serializeContent({ ...content, mood: "Escrito pela pessoa." }));
    const again = await scope.reports.prepareAgain(report.id, {
      content: serializeContent(content),
      periodEnd: new Date("2026-09-09T20:00:00Z"),
      sessionAt: new Date("2026-09-09T21:00:00Z"),
    });
    expect(again).toMatchObject({
      status: "draft",
      editedAt: null,
      periodStart: new Date("2026-09-01T00:00:00Z"),
      periodEnd: new Date("2026-09-09T20:00:00Z"),
      sessionAt: new Date("2026-09-09T21:00:00Z"),
    });
    const revisions = await scope.reports.revisions(report.id);
    expect(revisions.map((r) => [r.kind, r.sections])).toEqual([
      ["edited", ["mood"]],
      ["prepared_again", ["mood"]],
    ]);
    expect(parseContent(revisions[1]!.previous)?.mood).toBe("Escrito pela pessoa.");
  });

  it("never lets the scheduler rewrite a draft the person changed in the meantime", async () => {
    const report = await scope.reports.createDraft({
      periodStart: new Date("2026-06-01T00:00:00Z"),
      periodEnd: new Date("2026-06-08T00:00:00Z"),
      content: serializeContent(content),
    });
    await scope.reports.edit(report.id, serializeContent({ ...content, week: "Meu texto." }));
    await expect(
      scope.reports.prepareAgain(report.id, { content: serializeContent(content), untouched: true }),
    ).rejects.toBeInstanceOf(InvalidStateError);
    expect(parseContent((await scope.reports.get(report.id))!.content)?.week).toBe("Meu texto.");
  });

  it("approves a draft once, and refuses an end before the start", async () => {
    const report = await scope.reports.createDraft({
      periodStart: new Date("2026-08-01T00:00:00Z"),
      periodEnd: new Date("2026-08-08T00:00:00Z"),
      content: serializeContent(content),
    });
    await scope.reports.markReviewed(report.id);
    await expect(scope.reports.markReviewed(report.id)).rejects.toBeInstanceOf(InvalidStateError);
    await expect(
      scope.reports.prepareAgain(report.id, {
        content: serializeContent(content),
        periodEnd: new Date("2026-07-01"),
      }),
    ).rejects.toThrow();
  });

  it("never holds two reports ending at the same moment (a retried preparation)", async () => {
    const period = {
      periodStart: new Date("2026-07-01T00:00:00Z"),
      periodEnd: new Date("2026-07-08T00:00:00Z"),
    };
    await scope.reports.createDraft(period);
    await expect(scope.reports.createDraft(period)).rejects.toMatchObject({
      name: "DataAccessError",
      constraint: "reports_user_id_period_end_key",
    } satisfies Partial<DataAccessError>);
  });

  it("never holds two reports for the same session (two tabs preparing at once)", async () => {
    const sessionAt = new Date("2026-05-11T21:00:00Z");
    await scope.reports.createDraft({
      periodStart: new Date("2026-05-04T20:00:00Z"),
      periodEnd: new Date("2026-05-09T10:00:00Z"),
      sessionAt,
    });
    await expect(
      scope.reports.createDraft({
        periodStart: new Date("2026-05-04T20:00:00Z"),
        periodEnd: new Date("2026-05-09T10:00:01Z"),
        sessionAt,
      }),
    ).rejects.toMatchObject({ name: "DataAccessError", constraint: "reports_user_id_session_at_key" });
  });

  it("records the notice, and keeps all of it from another person", async () => {
    const [report] = await scope.reports.list();
    await scope.reports.markNotified(report!.id);
    expect((await scope.reports.get(report!.id))?.notifiedAt).not.toBeNull();

    expect(await other.reports.revisions(report!.id)).toEqual([]);
    expect(await other.reports.recent()).toEqual([]);
    expect(await other.reports.waiting()).toBeNull();
    expect((await scope.reports.recent()).map((r) => r.id)).toContain(report!.id);
    await expect(other.reports.markNotified(report!.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(other.reports.edit(report!.id, serializeContent(content))).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(await other.reports.list()).toEqual([]);
  });
});
