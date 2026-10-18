import { and, desc, eq } from "drizzle-orm";
import { SEALED } from "../db/sealed";
import { consents, reports } from "../db/schema";
import { ConsentInput, ReportDraftInput, type Consent, type ConsentPurpose, type Report } from "../domain";
import { ConsentRequiredError, InvalidStateError, NotFoundError, parseInput } from "../errors";
import { isId, type ScopeContext } from "./context";

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
    reviewedAt: row.reviewedAt,
    sentAt: row.sentAt,
    consentId: row.consentId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });

  const getRow = async (id: string) => {
    if (!isId(id)) return undefined;
    const [row] = await db.select().from(reports).where(own(id));
    return row;
  };

  return {
    async createDraft(input: ReportDraftInput): Promise<Report> {
      const value = parseInput(ReportDraftInput, input);
      const [row] = await db
        .insert(reports)
        .values({
          userId,
          periodStart: value.periodStart,
          periodEnd: value.periodEnd,
          sessionAt: value.sessionAt ?? null,
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

    /** Replace the draft's Markdown and/or PDF. A sent report is final. */
    async setContent(id: string, value: { content?: string; pdf?: Uint8Array }): Promise<Report> {
      const row = await getRow(id);
      if (!row) throw new NotFoundError("report");
      if (row.status === "sent") throw new InvalidStateError("a sent report cannot change");
      const [updated] = await db
        .update(reports)
        .set({
          ...(value.content !== undefined
            ? { content: cipher.sealText(spec.columns.content, value.content) }
            : {}),
          ...(value.pdf !== undefined ? { pdf: cipher.sealBytes(spec.columns.pdf, value.pdf) } : {}),
          status: "draft",
          generatedAt: new Date(),
          reviewedAt: null,
          updatedAt: new Date(),
        })
        .where(own(id))
        .returning();
      return decode(updated!);
    },

    async readPdf(id: string): Promise<Buffer | null> {
      const row = await getRow(id);
      return row?.pdf ? cipher.openBytes(spec.columns.pdf, row.pdf) : null;
    },

    async markReviewed(id: string): Promise<Report> {
      const row = await getRow(id);
      if (!row) throw new NotFoundError("report");
      if (row.status !== "draft") throw new InvalidStateError("only a draft can be reviewed");
      const [updated] = await db
        .update(reports)
        .set({ status: "reviewed", reviewedAt: new Date(), updatedAt: new Date() })
        .where(own(id))
        .returning();
      return decode(updated!);
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
        .where(own(id))
        .returning();
      return decode(updated!);
    },

    async remove(id: string): Promise<boolean> {
      if (!isId(id)) return false;
      const rows = await db.delete(reports).where(own(id)).returning({ id: reports.id });
      return rows.length > 0;
    },
  };
}
