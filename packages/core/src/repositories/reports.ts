import { and, asc, desc, eq } from "drizzle-orm";
import { SEALED } from "../db/sealed";
import { consents, reportRevisions, reports } from "../db/schema";
import {
  ConsentInput,
  ReportDraftInput,
  type Consent,
  type ConsentPurpose,
  type Report,
  type ReportRevision,
  type ReportRevisionKind,
} from "../domain";
import {
  ConsentRequiredError,
  InvalidStateError,
  NotFoundError,
  ValidationError,
  parseInput,
} from "../errors";
import { changedSections, parseContent } from "../report/content";
import { isId, type ScopeContext } from "./context";
import { inTransaction } from "./corrections";

const CONTENT_MAX = 400_000;

function contentValue(value: string): string {
  if (value.length === 0 || value.length > CONTENT_MAX) throw new ValidationError(["content"]);
  return value;
}

export function consentsRepository({ db, userId, cipher }: ScopeContext) {
  const spec = SEALED.consents;
  const decode = (row: typeof consents.$inferSelect): Consent => ({
    id: row.id,
    purpose: row.purpose,
    version: row.version,
    granted: row.granted,
    reportId: row.reportId,
    recipient: row.recipient ? cipher.openText(spec.columns.recipient, row.recipient) : null,
    createdAt: row.createdAt,
  });

  return {
    /** Append a consent decision. The log is never updated in place. */
    async record(input: ConsentInput): Promise<Consent> {
      const value = parseInput(ConsentInput, input);
      const [row] = await db
        .insert(consents)
        .values({
          userId,
          purpose: value.purpose,
          version: value.version,
          granted: value.granted,
          reportId: value.reportId ?? null,
          recipient: value.recipient ? cipher.sealText(spec.columns.recipient, value.recipient) : null,
        })
        .returning();
      return decode(row!);
    },

    async list(): Promise<Consent[]> {
      const rows = await db
        .select()
        .from(consents)
        .where(eq(consents.userId, userId))
        .orderBy(desc(consents.createdAt));
      return rows.map(decode);
    },

    /** The most recent decision for a purpose, or null if never asked. */
    async latest(purpose: ConsentPurpose): Promise<Consent | null> {
      const [row] = await db
        .select()
        .from(consents)
        .where(and(eq(consents.userId, userId), eq(consents.purpose, purpose)))
        .orderBy(desc(consents.createdAt))
        .limit(1);
      return row ? decode(row) : null;
    },
  };
}

export function reportsRepository({ db, userId, cipher }: ScopeContext) {
  const spec = SEALED.reports;
  const own = (id: string) => and(eq(reports.id, id), eq(reports.userId, userId));
  const decode = (row: typeof reports.$inferSelect): Report => ({
    id: row.id,
    status: row.status,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    sessionAt: row.sessionAt,
    content: row.content ? cipher.openText(spec.columns.content, row.content) : null,
    hasPdf: row.pdf !== null,
    recipient: row.recipient ? cipher.openText(spec.columns.recipient, row.recipient) : null,
    generatedAt: row.generatedAt,
    editedAt: row.editedAt,
    reviewedAt: row.reviewedAt,
    sentAt: row.sentAt,
    consentId: row.consentId,
    notifiedAt: row.notifiedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });

  const getRow = async (id: string) => {
    if (!isId(id)) return undefined;
    const [row] = await db.select().from(reports).where(own(id));
    return row;
  };

  /** Keep what the report said before a change, then apply the change. */
  const revise = async (
    id: string,
    kind: ReportRevisionKind,
    content: string,
    set: Partial<typeof reports.$inferInsert>,
  ): Promise<Report> =>
    inTransaction(db, async (tx) => {
      const [row] = await tx.select().from(reports).where(own(id)).for("update");
      if (!row) throw new NotFoundError("report");
      if (row.status === "sent") throw new InvalidStateError("a sent report cannot change");
      const previous = row.content ? cipher.openText(spec.columns.content, row.content) : null;
      if (previous !== null && previous !== content) {
        const before = parseContent(previous);
        const after = parseContent(content);
        await tx.insert(reportRevisions).values({
          userId,
          reportId: id,
          kind,
          sections: before && after ? changedSections(before, after) : [],
          previous: cipher.sealJson(SEALED.reportRevisions.columns.previous, previous),
        });
      }
      const now = new Date();
      const [updated] = await tx
        .update(reports)
        .set({
          ...set,
          content: cipher.sealText(spec.columns.content, content),
          // A change makes it a draft again: the person reviews this version.
          status: "draft",
          reviewedAt: null,
          pdf: null,
          updatedAt: now,
        })
        .where(own(id))
        .returning();
      return decode(updated!);
    });

  return {
    async createDraft(input: ReportDraftInput & { content?: string }): Promise<Report> {
      const value = parseInput(ReportDraftInput, input);
      const content = input.content === undefined ? null : contentValue(input.content);
      const [row] = await db
        .insert(reports)
        .values({
          userId,
          periodStart: value.periodStart,
          periodEnd: value.periodEnd,
          sessionAt: value.sessionAt ?? null,
          ...(content !== null
            ? { content: cipher.sealText(spec.columns.content, content), generatedAt: new Date() }
            : {}),
        })
        .returning();
      return decode(row!);
    },

    async get(id: string): Promise<Report | null> {
      const row = await getRow(id);
      return row ? decode(row) : null;
    },

    async list(): Promise<Report[]> {
      const rows = await db
        .select()
        .from(reports)
        .where(eq(reports.userId, userId))
        .orderBy(desc(reports.periodEnd))
        .limit(200);
      return rows.map(decode);
    },

    /**
     * The person's own change to the words. The previous version is kept as
     * a dated revision; the report is a draft again, to be reviewed as it
     * now reads, and the scheduler no longer rewrites it.
     */
    async edit(id: string, content: string): Promise<Report> {
      return revise(id, "edited", contentValue(content), { editedAt: new Date() });
    },

    /**
     * A new preparation of the same report (asked by the person, or the
     * scheduler following a moved session). The previous version is kept.
     */
    async prepareAgain(
      id: string,
      value: { content: string; periodEnd?: Date; sessionAt?: Date | null },
    ): Promise<Report> {
      const content = contentValue(value.content);
      const row = await getRow(id);
      if (!row) throw new NotFoundError("report");
      if (value.periodEnd && value.periodEnd <= row.periodStart) throw new ValidationError(["periodEnd"]);
      return revise(id, "prepared_again", content, {
        generatedAt: new Date(),
        editedAt: null,
        ...(value.periodEnd ? { periodEnd: value.periodEnd } : {}),
        ...(value.sessionAt !== undefined ? { sessionAt: value.sessionAt } : {}),
      });
    },

    async readPdf(id: string): Promise<Buffer | null> {
      const row = await getRow(id);
      return row?.pdf ? cipher.openBytes(spec.columns.pdf, row.pdf) : null;
    },

    /**
     * The person approves the words. `content` (with its numbers frozen) and
     * `pdf` are the version approved: what is sent is exactly this PDF.
     */
    async markReviewed(id: string, value: { content?: string; pdf?: Uint8Array } = {}): Promise<Report> {
      const row = await getRow(id);
      if (!row) throw new NotFoundError("report");
      if (row.status !== "draft") throw new InvalidStateError("only a draft can be reviewed");
      const [updated] = await db
        .update(reports)
        .set({
          status: "reviewed",
          reviewedAt: new Date(),
          ...(value.content !== undefined
            ? { content: cipher.sealText(spec.columns.content, contentValue(value.content)) }
            : {}),
          ...(value.pdf !== undefined ? { pdf: cipher.sealBytes(spec.columns.pdf, value.pdf) } : {}),
          updatedAt: new Date(),
        })
        .where(and(own(id), eq(reports.status, "draft")))
        .returning();
      if (!updated) throw new InvalidStateError("only a draft can be reviewed");
      return decode(updated);
    },

    /**
     * Record that a reviewed report was sent. Requires a granted
     * `report_send` consent of this user naming this report (invariant 3).
     * The recipient is the one the person approved, copied from the consent.
     */
    async markSent(id: string, consentId: string): Promise<Report> {
      const row = await getRow(id);
      if (!row) throw new NotFoundError("report");
      if (row.status !== "reviewed") throw new InvalidStateError("only a reviewed report can be sent");
      if (!isId(consentId)) throw new ConsentRequiredError("report_send");
      const [consent] = await db
        .select()
        .from(consents)
        .where(
          and(
            eq(consents.id, consentId),
            eq(consents.userId, userId),
            eq(consents.purpose, "report_send"),
            eq(consents.reportId, id),
            eq(consents.granted, true),
          ),
        );
      if (!consent?.recipient) throw new ConsentRequiredError("report_send");
      const recipient = cipher.openText(SEALED.consents.columns.recipient, consent.recipient);
      const [updated] = await db
        .update(reports)
        .set({
          status: "sent",
          sentAt: new Date(),
          consentId: consent.id,
          recipient: cipher.sealText(spec.columns.recipient, recipient),
          updatedAt: new Date(),
        })
        .where(and(own(id), eq(reports.status, "reviewed")))
        .returning();
      if (!updated) throw new InvalidStateError("only a reviewed report can be sent");
      return decode(updated);
    },

    /** The person was told (by email) that the report is ready. */
    async markNotified(id: string): Promise<void> {
      if (!isId(id)) throw new NotFoundError("report");
      const rows = await db
        .update(reports)
        .set({ notifiedAt: new Date() })
        .where(own(id))
        .returning({ id: reports.id });
      if (rows.length === 0) throw new NotFoundError("report");
    },

    /** What the report said before each change, oldest first. */
    async revisions(id: string): Promise<ReportRevision[]> {
      if (!isId(id)) return [];
      const rows = await db
        .select()
        .from(reportRevisions)
        .where(and(eq(reportRevisions.userId, userId), eq(reportRevisions.reportId, id)))
        .orderBy(asc(reportRevisions.createdAt))
        .limit(200);
      return rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        sections: row.sections,
        previous: cipher.openJson(SEALED.reportRevisions.columns.previous, row.previous) as string,
        createdAt: row.createdAt,
      }));
    },

    async remove(id: string): Promise<boolean> {
      if (!isId(id)) return false;
      const rows = await db.delete(reports).where(own(id)).returning({ id: reports.id });
      return rows.length > 0;
    },
  };
}
