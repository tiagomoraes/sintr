import { and, count, desc, eq, gt, inArray, isNull, ne, sql } from "drizzle-orm";
import { inviteCodeHash } from "../crypto";
import type { Executor } from "../db/client";
import { SEALED } from "../db/sealed";
import { consents, invites, links, notifications, practices, reports, sharedReports } from "../db/schema";
import {
  MAX_PENDING_INVITES,
  PRACTICE_LINK_CONSENT_VERSION,
  PersonInviteInput,
  PersonName,
  REPORT_SHARE_CONSENT_VERSION,
  ShareMode,
  type Invite,
  type InvitePreview,
  type NoticeView,
  type PersonLink,
  type PracticeCard,
  type ShareSummary,
  type SharedReportSnapshot,
} from "../domain";
import { InvalidStateError, NotFoundError, parseInput } from "../errors";
import { generateInviteCode, normalizeInviteCode } from "../practice/code";
import { isId } from "./context";
import { inTransaction } from "./corrections";
import {
  auditAccounts,
  endLink,
  invitePersonName,
  inviteStatus,
  linkCipher,
  linkPersonName,
  lockPractice,
  newLinkKey,
  nextLinkNumber,
  notify,
  openLinkBetween,
  practiceCard,
  practiceLine,
  requireSeat,
  seatUse,
  type SharingContext,
} from "./links";
import { decodeInvite, inviteExpiry } from "./practice";

type LinkRow = typeof links.$inferSelect;

export interface AcceptInvite {
  /** The name the practice sees; none gives a neutral label. */
  personName?: string | null;
  shareMode?: ShareMode;
  /** The person's explicit yes to share approved reports with this practice. */
  consent: true;
}

/**
 * The person's side of sharing: the links they hold with practices, the
 * invites they make for their therapist, and what they share. Bound to the
 * person; a link is only ever theirs, and a report only ever leaves through
 * one of their own active links, with their consent naming that report.
 */
export function sharingRepository(ctx: SharingContext) {
  const { db, userId, cipher, kek, practiceDefaults } = ctx;

  /** The person's open link with this id, locked, or nothing. */
  const ownLink = async (executor: Executor, linkId: string, status?: LinkRow["status"]) => {
    if (!isId(linkId)) return undefined;
    const [row] = await executor
      .select()
      .from(links)
      .where(
        and(
          eq(links.id, linkId),
          eq(links.userId, userId),
          status ? eq(links.status, status) : ne(links.status, "ended"),
        ),
      )
      .for("update");
    return row;
  };

  const practiceOf = async (executor: Executor, practiceId: string) => {
    const [row] = await executor.select().from(practices).where(eq(practices.id, practiceId));
    if (!row) throw new NotFoundError("practice");
    return row;
  };

  /** The consent that a link to this practice rests on, in the person's own consent log. */
  const recordLinkConsent = async (executor: Executor, linkId: string, card: PracticeCard) => {
    const [row] = await executor
      .insert(consents)
      .values({
        userId,
        purpose: "practice_link",
        version: PRACTICE_LINK_CONSENT_VERSION,
        granted: true,
        linkId,
        recipient: cipher.sealText(SEALED.consents.columns.recipient, practiceLine(card)),
      })
      .returning({ id: consents.id });
    await auditAccounts(executor, [userId], {
      action: "consent.recorded",
      targetType: "consent",
      targetId: row!.id,
      metadata: { purpose: "practice_link", version: PRACTICE_LINK_CONSENT_VERSION },
    });
    return row!.id;
  };

  const shareSummaries = async (linkIds: string[]): Promise<Map<string, ShareSummary[]>> => {
    const out = new Map<string, ShareSummary[]>();
    if (linkIds.length === 0) return out;
    const rows = await db
      .select({
        id: sharedReports.id,
        linkId: sharedReports.linkId,
        reportId: sharedReports.reportId,
        sessionAt: sharedReports.sessionAt,
        periodStart: sharedReports.periodStart,
        periodEnd: sharedReports.periodEnd,
        createdAt: sharedReports.createdAt,
        firstReadAt: sharedReports.firstReadAt,
      })
      .from(sharedReports)
      .where(and(eq(sharedReports.userId, userId), inArray(sharedReports.linkId, linkIds)))
      .orderBy(desc(sharedReports.createdAt));
    for (const row of rows) {
      const list = out.get(row.linkId) ?? [];
      list.push({
        id: row.id,
        reportId: row.reportId,
        sessionAt: row.sessionAt,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        sharedAt: row.createdAt,
        firstReadAt: row.firstReadAt,
      });
      out.set(row.linkId, list);
    }
    return out;
  };

  const links_ = async (onlyId?: string): Promise<PersonLink[]> => {
    const rows = await db
      .select({ link: links, practice: practices })
      .from(links)
      .innerJoin(practices, eq(practices.id, links.practiceId))
      .where(
        and(eq(links.userId, userId), ne(links.status, "ended"), onlyId ? eq(links.id, onlyId) : undefined),
      )
      .orderBy(desc(links.createdAt));
    const shares = await shareSummaries(rows.map((row) => row.link.id));
    return Promise.all(
      rows.map(async ({ link, practice }) => ({
        id: link.id,
        status: link.status === "active" ? ("active" as const) : ("pending" as const),
        practice: await practiceCard(db, kek, practice),
        personName: linkPersonName(kek, link),
        shareMode: link.shareMode,
        personAcceptedAt: link.personAcceptedAt,
        practiceAcceptedAt: link.practiceAcceptedAt,
        createdAt: link.createdAt,
        shares: shares.get(link.id) ?? [],
      })),
    );
  };

  const one = async (linkId: string): Promise<PersonLink> => {
    const [link] = await links_(linkId);
    if (!link) throw new NotFoundError("link");
    return link;
  };

  return {
    /** Every link that is open (active, or waiting for the person's confirmation), newest first. */
    links: () => links_(),

    /** Invite your therapist: a code and link to give them. They accept it from their practice. */
    async createInvite(input: PersonInviteInput = {}, now: Date = new Date()): Promise<Invite> {
      const value = parseInput(PersonInviteInput, input);
      return inTransaction(db, async (tx) => {
        const [pending] = await tx
          .select({ n: count() })
          .from(invites)
          .where(
            and(
              eq(invites.userId, userId),
              eq(invites.direction, "person_to_practice"),
              isNull(invites.acceptedAt),
              isNull(invites.revokedAt),
              gt(invites.expiresAt, now),
            ),
          );
        if ((pending?.n ?? 0) >= MAX_PENDING_INVITES.person) {
          throw new InvalidStateError("too many pending invites");
        }
        const code = generateInviteCode();
        const [row] = await tx
          .insert(invites)
          .values({
            userId,
            direction: "person_to_practice",
            codeHash: inviteCodeHash(kek, code),
            code: cipher.sealText(SEALED.invites.columns.code, code),
            personName: value.personName
              ? cipher.sealText(SEALED.invites.columns.personName, value.personName)
              : null,
            expiresAt: inviteExpiry(now),
          })
          .returning();
        await auditAccounts(tx, [userId], {
          action: "invite.created",
          targetType: "invite",
          targetId: row!.id,
          metadata: { direction: "person_to_practice" },
        });
        return decodeInvite(cipher, row!, now);
      });
    },

    /** The invites the person made for a therapist, newest first. */
    async invites(now: Date = new Date()): Promise<Invite[]> {
      const rows = await db
        .select()
        .from(invites)
        .where(and(eq(invites.userId, userId), eq(invites.direction, "person_to_practice")))
        .orderBy(desc(invites.createdAt))
        .limit(50);
      return rows.map((row) => decodeInvite(cipher, row, now));
    },

    async revokeInvite(id: string, now: Date = new Date()): Promise<boolean> {
      if (!isId(id)) return false;
      return inTransaction(db, async (tx) => {
        const rows = await tx
          .update(invites)
          .set({ revokedAt: now })
          .where(
            and(
              eq(invites.id, id),
              eq(invites.userId, userId),
              eq(invites.direction, "person_to_practice"),
              isNull(invites.acceptedAt),
              isNull(invites.revokedAt),
            ),
          )
          .returning({ id: invites.id });
        if (rows.length === 0) return false;
        await auditAccounts(tx, [userId], {
          action: "invite.revoked",
          targetType: "invite",
          targetId: id,
          metadata: { direction: "person_to_practice" },
        });
        return true;
      });
    },

    /**
     * Accept a practice's invite. The practice said yes when it made the
     * invite; this is the person's yes, with their consent to share the
     * reports they approve with this practice, and the link is active.
     */
    async acceptInvite(code: string, input: AcceptInvite, now: Date = new Date()): Promise<PersonLink> {
      if (input.consent !== true) throw new InvalidStateError("the consent is required");
      const personName = input.personName ? parseInput(PersonName, input.personName) : null;
      const shareMode = parseInput(ShareMode, input.shareMode ?? "ask");
      const normalized = normalizeInviteCode(code);
      if (!normalized) throw new NotFoundError("invite");
      const linkId = await inTransaction(db, async (tx) => {
        const [invite] = await tx
          .select()
          .from(invites)
          .where(eq(invites.codeHash, inviteCodeHash(kek, normalized)))
          .for("update");
        if (!invite || invite.direction !== "practice_to_person" || inviteStatus(invite, now) !== "pending") {
          throw new NotFoundError("invite");
        }
        const practice = (await lockPractice(tx, invite.practiceId!))!;
        if (practice.userId === userId) throw new InvalidStateError("this is your own practice");
        if (await openLinkBetween(tx, userId, practice.id)) throw new InvalidStateError("already linked");
        // The invite held a seat; that seat becomes the link's.
        requireSeat(await seatUse(tx, practice, practiceDefaults, now, invite.id));
        const card = await practiceCard(tx, kek, practice);
        const key = newLinkKey(kek);
        const consentId = await recordLinkConsent(tx, key.id, card);
        await tx.insert(links).values({
          id: key.id,
          userId,
          practiceId: practice.id,
          status: "active",
          number: await nextLinkNumber(tx, practice.id),
          personName: personName ? key.cipher.sealText(SEALED.links.columns.personName, personName) : null,
          shareMode,
          kekId: key.kekId,
          wrappedKey: key.wrappedKey,
          personAcceptedAt: now,
          practiceAcceptedAt: invite.createdAt,
          consentId,
        });
        await tx.update(invites).set({ acceptedAt: now, linkId: key.id }).where(eq(invites.id, invite.id));
        const metadata = { direction: "practice_to_person", practice_id: practice.id, link_id: key.id };
        await auditAccounts(tx, [userId, practice.userId], {
          action: "invite.accepted",
          targetType: "invite",
          targetId: invite.id,
          metadata,
        });
        await auditAccounts(tx, [userId, practice.userId], {
          action: "link.activated",
          targetType: "link",
          targetId: key.id,
          metadata: { practice_id: practice.id, actor: "person", share_mode: shareMode },
        });
        await notify(tx, practice.userId, "link_active", { linkId: key.id });
        return key.id;
      });
      return one(linkId);
    },

    /**
     * Confirm a practice that accepted the person's invite: their yes, with
     * the consent naming this practice. Until then nothing can be shared.
     */
    async confirm(linkId: string, input: { consent: true }, now: Date = new Date()): Promise<PersonLink> {
      if (input.consent !== true) throw new InvalidStateError("the consent is required");
      await inTransaction(db, async (tx) => {
        const row = await ownLink(tx, linkId, "pending");
        if (!row) throw new NotFoundError("link");
        const practice = await practiceOf(tx, row.practiceId);
        const consentId = await recordLinkConsent(tx, row.id, await practiceCard(tx, kek, practice));
        await tx
          .update(links)
          .set({ status: "active", personAcceptedAt: now, consentId, updatedAt: now })
          .where(eq(links.id, row.id));
        await auditAccounts(tx, [userId, practice.userId], {
          action: "link.activated",
          targetType: "link",
          targetId: row.id,
          metadata: { practice_id: practice.id, actor: "person", share_mode: row.shareMode },
        });
        await notify(tx, practice.userId, "link_active", { linkId: row.id });
      });
      return one(linkId);
    },

    /** Say no to a practice that accepted the person's invite. */
    async decline(linkId: string, now: Date = new Date()): Promise<boolean> {
      return inTransaction(db, async (tx) => {
        const row = await ownLink(tx, linkId, "pending");
        if (!row) return false;
        await endLink(tx, row, await practiceOf(tx, row.practiceId), "person", now);
        return true;
      });
    },

    /** Stop sharing, at once: the practice loses every report shared through the link. */
    async end(linkId: string, now: Date = new Date()): Promise<boolean> {
      return inTransaction(db, async (tx) => {
        const row = await ownLink(tx, linkId);
        if (!row) return false;
        await endLink(tx, row, await practiceOf(tx, row.practiceId), "person", now);
        return true;
      });
    },

    /** "Ask me for each report" or "anything I approve goes to them". */
    async setShareMode(linkId: string, mode: ShareMode): Promise<boolean> {
      const value = parseInput(ShareMode, mode);
      return inTransaction(db, async (tx) => {
        const row = await ownLink(tx, linkId);
        if (!row) return false;
        if (row.shareMode === value) return true;
        await tx.update(links).set({ shareMode: value, updatedAt: new Date() }).where(eq(links.id, row.id));
        await auditAccounts(tx, [userId], {
          action: "link.changed",
          targetType: "link",
          targetId: row.id,
          metadata: { field: "share_mode", share_mode: value },
        });
        return true;
      });
    },

    /** The name the practice sees, or none for a neutral label. */
    async rename(linkId: string, personName: string | null): Promise<boolean> {
      const value = personName === null ? null : parseInput(PersonName, personName);
      return inTransaction(db, async (tx) => {
        const row = await ownLink(tx, linkId);
        if (!row) return false;
        const sealed = value ? linkCipher(kek, row).sealText(SEALED.links.columns.personName, value) : null;
        await tx.update(links).set({ personName: sealed, updatedAt: new Date() }).where(eq(links.id, row.id));
        await auditAccounts(tx, [userId], {
          action: "link.changed",
          targetType: "link",
          targetId: row.id,
          metadata: { field: "person_name" },
        });
        return true;
      });
    },

    /**
     * Share one approved report through one active link: the person's
     * consent naming the report and the practice is recorded, and a copy of
     * what they approved (the page and its PDF) is sealed with the link's
     * key. The report's words are final from then on.
     */
    async deliver(
      input: { reportId: string; linkId: string; snapshot: SharedReportSnapshot; pdf: Uint8Array },
      now: Date = new Date(),
    ): Promise<ShareSummary> {
      if (!isId(input.reportId)) throw new NotFoundError("report");
      return inTransaction(db, async (tx) => {
        const link = await ownLink(tx, input.linkId, "active");
        if (!link) throw new NotFoundError("link");
        const [report] = await tx
          .select({
            id: reports.id,
            status: reports.status,
            sessionAt: reports.sessionAt,
            periodStart: reports.periodStart,
            periodEnd: reports.periodEnd,
          })
          .from(reports)
          .where(and(eq(reports.id, input.reportId), eq(reports.userId, userId)))
          .for("update");
        if (!report) throw new NotFoundError("report");
        if (report.status === "draft") throw new InvalidStateError("approve the report before sharing it");
        const [already] = await tx
          .select({ id: sharedReports.id })
          .from(sharedReports)
          .where(and(eq(sharedReports.linkId, link.id), eq(sharedReports.reportId, report.id)));
        if (already) throw new InvalidStateError("already shared with this practice");
        const practice = await practiceOf(tx, link.practiceId);
        const [consent] = await tx
          .insert(consents)
          .values({
            userId,
            purpose: "report_share",
            version: REPORT_SHARE_CONSENT_VERSION,
            granted: true,
            reportId: report.id,
            linkId: link.id,
            recipient: cipher.sealText(
              SEALED.consents.columns.recipient,
              practiceLine(await practiceCard(tx, kek, practice)),
            ),
          })
          .returning({ id: consents.id });
        await auditAccounts(tx, [userId], {
          action: "consent.recorded",
          targetType: "consent",
          targetId: consent!.id,
          metadata: { purpose: "report_share", version: REPORT_SHARE_CONSENT_VERSION },
        });
        const sealer = linkCipher(kek, link);
        const [share] = await tx
          .insert(sharedReports)
          .values({
            userId,
            linkId: link.id,
            reportId: report.id,
            consentId: consent!.id,
            sessionAt: report.sessionAt,
            periodStart: report.periodStart,
            periodEnd: report.periodEnd,
            snapshot: sealer.sealJson(SEALED.sharedReports.columns.snapshot, input.snapshot),
            pdf: sealer.sealBytes(SEALED.sharedReports.columns.pdf, input.pdf),
            createdAt: now,
          })
          .returning();
        await tx
          .update(reports)
          .set({ sharedAt: sql`coalesce(${reports.sharedAt}, ${now.toISOString()}::timestamptz)` })
          .where(eq(reports.id, report.id));
        await auditAccounts(tx, [userId, practice.userId], {
          action: "share.created",
          targetType: "shared_report",
          targetId: share!.id,
          metadata: { link_id: link.id, practice_id: practice.id, consent_id: consent!.id },
        });
        await notify(tx, practice.userId, "report_shared", { linkId: link.id, sharedReportId: share!.id });
        return {
          id: share!.id,
          reportId: report.id,
          sessionAt: share!.sessionAt,
          periodStart: share!.periodStart,
          periodEnd: share!.periodEnd,
          sharedAt: share!.createdAt,
          firstReadAt: null,
        };
      });
    },
  };
}

/**
 * What /join shows about a code, for anyone holding it (signed in or not):
 * who is inviting, or nothing at all for a code that is unknown, expired,
 * revoked or used, so the answer never tells those apart.
 */
export async function previewInvite(
  db: Executor,
  ctx: Pick<SharingContext, "kek">,
  code: string,
  viewerId: string | null,
  now: Date = new Date(),
): Promise<InvitePreview> {
  const normalized = normalizeInviteCode(code);
  if (!normalized) return { status: "invalid" };
  const [invite] = await db
    .select()
    .from(invites)
    .where(eq(invites.codeHash, inviteCodeHash(ctx.kek, normalized)));
  if (!invite || inviteStatus(invite, now) !== "pending") return { status: "invalid" };
  const own = viewerId !== null && invite.userId === viewerId;
  if (invite.direction === "practice_to_person") {
    const [practice] = await db.select().from(practices).where(eq(practices.id, invite.practiceId!));
    if (!practice) return { status: "invalid" };
    return {
      status: "valid",
      direction: "practice_to_person",
      inviteId: invite.id,
      expiresAt: invite.expiresAt,
      practice: await practiceCard(db, ctx.kek, practice),
      own: own || practice.userId === viewerId,
    };
  }
  return {
    status: "valid",
    direction: "person_to_practice",
    inviteId: invite.id,
    expiresAt: invite.expiresAt,
    personName: await invitePersonName(db, ctx.kek, invite),
    own,
  };
}

/**
 * The account's notices, worded when shown: on the person's side, the
 * practice's names; on the practice's side, the name the person chose while
 * the link is open, and nothing of them once it has ended.
 */
export function noticesRepository(ctx: SharingContext) {
  const { db, userId, kek } = ctx;
  const sideOf = (link: LinkRow | null): "person" | "practice" =>
    link && link.userId === userId ? "person" : "practice";

  return {
    async list(limit = 30): Promise<NoticeView[]> {
      const rows = await db
        .select({ notice: notifications, link: links, practice: practices })
        .from(notifications)
        .leftJoin(links, eq(links.id, notifications.linkId))
        .leftJoin(practices, eq(practices.id, links.practiceId))
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(Math.min(Math.max(limit, 1), 100));
      return Promise.all(
        rows.map(async ({ notice, link, practice }) => {
          const side = sideOf(link);
          return {
            id: notice.id,
            kind: notice.kind,
            side,
            linkId: notice.linkId,
            sharedReportId: notice.sharedReportId,
            readAt: notice.readAt,
            createdAt: notice.createdAt,
            practice: side === "person" && practice ? await practiceCard(db, kek, practice) : null,
            personName:
              side === "practice" && link && link.status !== "ended" ? linkPersonName(kek, link) : null,
            number: side === "practice" && link ? link.number : null,
          };
        }),
      );
    },

    /** Unread notices, by side. */
    async unread(): Promise<{ person: number; practice: number }> {
      const [row] = await db
        .select({
          person: sql<number>`count(*) filter (where ${links.userId} = ${userId})`.mapWith(Number),
          all: count(),
        })
        .from(notifications)
        .leftJoin(links, eq(links.id, notifications.linkId))
        .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
      const person = row?.person ?? 0;
      return { person, practice: (row?.all ?? 0) - person };
    },

    /** Mark one side's notices read (they were shown). */
    async markRead(side: "person" | "practice", now: Date = new Date()): Promise<void> {
      const mineAsPerson = sql`exists (select 1 from ${links} where ${links.id} = ${notifications.linkId} and ${links.userId} = ${userId})`;
      await db
        .update(notifications)
        .set({ readAt: now })
        .where(
          and(
            eq(notifications.userId, userId),
            isNull(notifications.readAt),
            side === "person" ? mineAsPerson : sql`not ${mineAsPerson}`,
          ),
        );
    },
  };
}
