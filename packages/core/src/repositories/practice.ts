import { and, asc, count, desc, eq, inArray, isNull, max, ne } from "drizzle-orm";
import { inviteCodeHash, type FieldCipher } from "../crypto";
import type { Executor } from "../db/client";
import { SEALED, openValues } from "../db/sealed";
import { invites, links, practices, sharedReports } from "../db/schema";
import {
  INVITE_DAYS,
  MAX_PENDING_INVITES,
  PracticeInput,
  PracticeInviteInput,
  PracticePatch,
  type Invite,
  type Practice,
  type PracticeLink,
  type ReceivedReport,
  type SeatUse,
  type SharedReport,
  type SharedReportSnapshot,
} from "../domain";
import { InvalidStateError, NotFoundError, parseInput } from "../errors";
import { formatInviteCode, generateInviteCode, normalizeInviteCode } from "../practice/code";
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
  pendingPracticeInvites,
  planOf,
  requireSeat,
  seatUse,
  type SharingContext,
} from "./links";

const DAY = 24 * 60 * 60 * 1000;

type LinkRow = typeof links.$inferSelect;
type InviteRow = typeof invites.$inferSelect;
type ShareRow = Pick<
  typeof sharedReports.$inferSelect,
  "id" | "linkId" | "reportId" | "sessionAt" | "periodStart" | "periodEnd" | "createdAt" | "firstReadAt"
>;

/** An invite as its creator sees it, opened with the creator's own key. */
export function decodeInvite(cipher: FieldCipher, row: InviteRow, now: Date): Invite {
  const open = openValues(cipher, SEALED.invites, row);
  return {
    id: row.id,
    direction: row.direction,
    status: inviteStatus(row, now),
    code: formatInviteCode(open.code as string),
    note: open.note as string | null,
    personName: open.personName as string | null,
    expiresAt: row.expiresAt,
    acceptedAt: row.acceptedAt,
    revokedAt: row.revokedAt,
    linkId: row.linkId,
    createdAt: row.createdAt,
  };
}

export function inviteExpiry(now: Date): Date {
  return new Date(now.getTime() + INVITE_DAYS * DAY);
}

function practiceLinkView(row: LinkRow, personName: string | null, lastSharedAt: Date | null): PracticeLink {
  const accepted = [row.personAcceptedAt, row.practiceAcceptedAt];
  return {
    id: row.id,
    status: row.status === "active" ? "active" : "pending",
    number: row.number,
    personName,
    createdAt: row.createdAt,
    activeSince:
      row.status === "active" && accepted.every(Boolean)
        ? new Date(Math.max(...accepted.map((d) => d!.getTime())))
        : null,
    lastSharedAt,
  };
}

function receivedView(share: ShareRow, link: LinkRow, personName: string | null): ReceivedReport {
  return {
    id: share.id,
    reportId: share.reportId,
    linkId: link.id,
    number: link.number,
    personName,
    sessionAt: share.sessionAt,
    periodStart: share.periodStart,
    periodEnd: share.periodEnd,
    sharedAt: share.createdAt,
    firstReadAt: share.firstReadAt,
  };
}

const SHARE_COLUMNS = {
  id: sharedReports.id,
  linkId: sharedReports.linkId,
  reportId: sharedReports.reportId,
  sessionAt: sharedReports.sessionAt,
  periodStart: sharedReports.periodStart,
  periodEnd: sharedReports.periodEnd,
  createdAt: sharedReports.createdAt,
  firstReadAt: sharedReports.firstReadAt,
};

/**
 * The professional's side, for the one account that opened the practice.
 * Every query goes through that account's own practice, and a link's
 * reports only while the link is active: there is no way from here to
 * anything a person did not share, or to another practice.
 */
export function practiceRepository(ctx: SharingContext) {
  const { db, userId, cipher, kek, practiceDefaults } = ctx;
  const spec = SEALED.practices;

  const decode = (row: typeof practices.$inferSelect): Practice => {
    const open = openValues(cipher, spec, row);
    return {
      id: row.id,
      professionalName: open.professionalName as string,
      practiceName: open.practiceName as string | null,
      registration: open.registration as string | null,
      notifyEmail: row.notifyEmail,
      seatSource: row.seatSource,
      ...planOf(row, practiceDefaults),
      createdAt: row.createdAt,
    };
  };

  const mine = async (executor: Executor = db) => {
    const [row] = await executor.select().from(practices).where(eq(practices.userId, userId));
    return row;
  };
  const requireMine = async (executor: Executor = db) => {
    const row = await mine(executor);
    if (!row) throw new NotFoundError("practice");
    return row;
  };

  /** The practice's open link with this id, locked, or nothing. */
  const ownLink = async (executor: Executor, practiceId: string, linkId: string) => {
    const [row] = await executor
      .select()
      .from(links)
      .where(and(eq(links.id, linkId), eq(links.practiceId, practiceId), ne(links.status, "ended")))
      .for("update");
    return row;
  };

  /** A shared report of one of this practice's active links, with its link. */
  const ownShare = async (executor: Executor, practiceId: string, shareId: string) => {
    const [row] = await executor
      .select({ share: sharedReports, link: links })
      .from(sharedReports)
      .innerJoin(links, eq(links.id, sharedReports.linkId))
      .where(
        and(eq(sharedReports.id, shareId), eq(links.practiceId, practiceId), eq(links.status, "active")),
      );
    return row;
  };

  return {
    async get(): Promise<Practice | null> {
      const row = await mine();
      return row ? decode(row) : null;
    },

    /** Open the practice: one per account. Its seats follow the installation's defaults until a grant. */
    async open(input: PracticeInput): Promise<Practice> {
      const value = parseInput(PracticeInput, input);
      return inTransaction(db, async (tx) => {
        const [row] = await tx
          .insert(practices)
          .values({
            userId,
            professionalName: cipher.sealText(spec.columns.professionalName, value.professionalName),
            practiceName: value.practiceName
              ? cipher.sealText(spec.columns.practiceName, value.practiceName)
              : null,
            registration: value.registration
              ? cipher.sealText(spec.columns.registration, value.registration)
              : null,
          })
          .onConflictDoNothing()
          .returning();
        if (!row) throw new InvalidStateError("a practice is already open");
        await auditAccounts(tx, [userId], {
          action: "practice.opened",
          targetType: "practice",
          targetId: row.id,
        });
        return decode(row);
      });
    },

    async update(patch: PracticePatch): Promise<Practice> {
      const value = parseInput(PracticePatch, patch);
      return inTransaction(db, async (tx) => {
        const own = await requireMine(tx);
        const [row] = await tx
          .update(practices)
          .set({
            ...(value.professionalName !== undefined
              ? { professionalName: cipher.sealText(spec.columns.professionalName, value.professionalName) }
              : {}),
            ...(value.practiceName !== undefined
              ? {
                  practiceName: value.practiceName
                    ? cipher.sealText(spec.columns.practiceName, value.practiceName)
                    : null,
                }
              : {}),
            ...(value.registration !== undefined
              ? {
                  registration: value.registration
                    ? cipher.sealText(spec.columns.registration, value.registration)
                    : null,
                }
              : {}),
            ...(value.notifyEmail !== undefined ? { notifyEmail: value.notifyEmail } : {}),
            updatedAt: new Date(),
          })
          .where(and(eq(practices.id, own.id), eq(practices.userId, userId)))
          .returning();
        await auditAccounts(tx, [userId], {
          action: "practice.updated",
          targetType: "practice",
          targetId: own.id,
          metadata: { fields: Object.keys(value).sort().join(",") },
        });
        return decode(row!);
      });
    },

    async seats(now: Date = new Date()): Promise<SeatUse> {
      return seatUse(db, await requireMine(), practiceDefaults, now);
    },

    /** A code and link for a person. It holds a seat until it is accepted, revoked or expires. */
    async createInvite(input: PracticeInviteInput = {}, now: Date = new Date()): Promise<Invite> {
      const value = parseInput(PracticeInviteInput, input);
      return inTransaction(db, async (tx) => {
        const practice = (await lockPractice(tx, (await requireMine(tx)).id))!;
        requireSeat(await seatUse(tx, practice, practiceDefaults, now));
        const [pending] = await tx
          .select({ n: count() })
          .from(invites)
          .where(and(eq(invites.userId, userId), pendingPracticeInvites(practice.id, now)));
        if ((pending?.n ?? 0) >= MAX_PENDING_INVITES.practice) {
          throw new InvalidStateError("too many pending invites");
        }
        const code = generateInviteCode();
        const [row] = await tx
          .insert(invites)
          .values({
            userId,
            direction: "practice_to_person",
            practiceId: practice.id,
            codeHash: inviteCodeHash(kek, code),
            code: cipher.sealText(SEALED.invites.columns.code, code),
            note: value.note ? cipher.sealText(SEALED.invites.columns.note, value.note) : null,
            expiresAt: inviteExpiry(now),
          })
          .returning();
        await auditAccounts(tx, [userId], {
          action: "invite.created",
          targetType: "invite",
          targetId: row!.id,
          metadata: { direction: "practice_to_person", practice_id: practice.id },
        });
        return decodeInvite(cipher, row!, now);
      });
    },

    async invites(now: Date = new Date()): Promise<Invite[]> {
      const rows = await db
        .select()
        .from(invites)
        .where(and(eq(invites.userId, userId), eq(invites.direction, "practice_to_person")))
        .orderBy(desc(invites.createdAt))
        .limit(100);
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
              eq(invites.direction, "practice_to_person"),
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
          metadata: { direction: "practice_to_person" },
        });
        return true;
      });
    },

    /**
     * Accept a person's invite (they invited their therapist). The practice
     * says yes here; the link then waits for the person to confirm this
     * practice, with their consent, before anything can be shared.
     */
    async acceptInvite(code: string, now: Date = new Date()): Promise<PracticeLink> {
      const normalized = normalizeInviteCode(code);
      if (!normalized) throw new NotFoundError("invite");
      return inTransaction(db, async (tx) => {
        const own = await requireMine(tx);
        const [invite] = await tx
          .select()
          .from(invites)
          .where(eq(invites.codeHash, inviteCodeHash(kek, normalized)))
          .for("update");
        if (!invite || invite.direction !== "person_to_practice" || inviteStatus(invite, now) !== "pending") {
          throw new NotFoundError("invite");
        }
        if (invite.userId === userId) throw new InvalidStateError("this is your own invite");
        const practice = (await lockPractice(tx, own.id))!;
        if (await openLinkBetween(tx, invite.userId, practice.id))
          throw new InvalidStateError("already linked");
        requireSeat(await seatUse(tx, practice, practiceDefaults, now));
        const personName = await invitePersonName(tx, kek, invite);
        const key = newLinkKey(kek);
        const [link] = await tx
          .insert(links)
          .values({
            id: key.id,
            userId: invite.userId,
            practiceId: practice.id,
            status: "pending",
            number: await nextLinkNumber(tx, practice.id),
            personName: personName ? key.cipher.sealText(SEALED.links.columns.personName, personName) : null,
            kekId: key.kekId,
            wrappedKey: key.wrappedKey,
            practiceAcceptedAt: now,
          })
          .returning();
        await tx
          .update(invites)
          .set({ acceptedAt: now, practiceId: practice.id, linkId: link!.id })
          .where(eq(invites.id, invite.id));
        await auditAccounts(tx, [invite.userId, userId], {
          action: "invite.accepted",
          targetType: "invite",
          targetId: invite.id,
          metadata: { direction: "person_to_practice", practice_id: practice.id, link_id: link!.id },
        });
        await notify(tx, invite.userId, "link_pending", { linkId: link!.id });
        return practiceLinkView(link!, personName, null);
      });
    },

    /** The people linked or waiting to confirm: the name each chose (or none), and dates. */
    async patients(): Promise<PracticeLink[]> {
      const own = await mine();
      if (!own) return [];
      const rows = await db
        .select()
        .from(links)
        .where(and(eq(links.practiceId, own.id), ne(links.status, "ended")))
        .orderBy(asc(links.number));
      if (rows.length === 0) return [];
      const last = await db
        .select({ linkId: sharedReports.linkId, at: max(sharedReports.createdAt) })
        .from(sharedReports)
        .where(
          inArray(
            sharedReports.linkId,
            rows.map((row) => row.id),
          ),
        )
        .groupBy(sharedReports.linkId);
      const lastBy = new Map(last.map((row) => [row.linkId, row.at]));
      return rows.map((row) => practiceLinkView(row, linkPersonName(kek, row), lastBy.get(row.id) ?? null));
    },

    /** Reports received through active links, newest first, without their words. */
    async reports(limit = 200): Promise<ReceivedReport[]> {
      const own = await mine();
      if (!own) return [];
      const rows = await db
        .select({ share: SHARE_COLUMNS, link: links })
        .from(sharedReports)
        .innerJoin(links, eq(links.id, sharedReports.linkId))
        .where(and(eq(links.practiceId, own.id), eq(links.status, "active")))
        .orderBy(desc(sharedReports.createdAt))
        .limit(Math.min(Math.max(limit, 1), 500));
      const names = new Map<string, string | null>();
      return rows.map(({ share, link }) => {
        if (!names.has(link.id)) names.set(link.id, linkPersonName(kek, link));
        return receivedView(share, link, names.get(link.id)!);
      });
    },

    /**
     * Read one received report in place. Recorded in both accounts' audit
     * logs, and the first reading is kept so the person can see it.
     */
    async readReport(id: string, now: Date = new Date()): Promise<SharedReport | null> {
      if (!isId(id)) return null;
      return inTransaction(db, async (tx) => {
        const own = await mine(tx);
        const row = own ? await ownShare(tx, own.id, id) : undefined;
        if (!own || !row) return null;
        const snapshot = linkCipher(kek, row.link).openJson(
          SEALED.sharedReports.columns.snapshot,
          row.share.snapshot,
        ) as SharedReportSnapshot;
        if (!row.share.firstReadAt) {
          await tx.update(sharedReports).set({ firstReadAt: now }).where(eq(sharedReports.id, id));
        }
        await auditAccounts(tx, [row.link.userId, userId], {
          action: "share.read",
          targetType: "shared_report",
          targetId: id,
          metadata: { link_id: row.link.id, practice_id: own.id },
        });
        const view = receivedView(row.share, row.link, linkPersonName(kek, row.link));
        return { ...view, firstReadAt: row.share.firstReadAt ?? now, snapshot };
      });
    },

    /** The approved PDF of a received report. Downloading it is recorded like reading it. */
    async reportPdf(
      id: string,
      now: Date = new Date(),
    ): Promise<{ report: ReceivedReport; pdf: Buffer; label: string } | null> {
      if (!isId(id)) return null;
      return inTransaction(db, async (tx) => {
        const own = await mine(tx);
        const row = own ? await ownShare(tx, own.id, id) : undefined;
        if (!own || !row) return null;
        const sealer = linkCipher(kek, row.link);
        const pdf = sealer.openBytes(SEALED.sharedReports.columns.pdf, row.share.pdf);
        const { period } = sealer.openJson(
          SEALED.sharedReports.columns.snapshot,
          row.share.snapshot,
        ) as SharedReportSnapshot;
        if (!row.share.firstReadAt) {
          await tx.update(sharedReports).set({ firstReadAt: now }).where(eq(sharedReports.id, id));
        }
        await auditAccounts(tx, [row.link.userId, userId], {
          action: "share.downloaded",
          targetType: "shared_report",
          targetId: id,
          metadata: { link_id: row.link.id, practice_id: own.id },
        });
        return {
          report: receivedView(row.share, row.link, linkPersonName(kek, row.link)),
          pdf,
          // The period as the person's report names it, in their time zone.
          label: period.label,
        };
      });
    },

    /** Disconnect a person, or withdraw from a link waiting for them: the same end as theirs. */
    async endLink(linkId: string, now: Date = new Date()): Promise<boolean> {
      if (!isId(linkId)) return false;
      return inTransaction(db, async (tx) => {
        const own = await mine(tx);
        const row = own ? await ownLink(tx, own.id, linkId) : undefined;
        if (!own || !row) return false;
        await endLink(tx, row, own, "practice", now);
        return true;
      });
    },
  };
}
