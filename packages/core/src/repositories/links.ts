import { randomUUID } from "node:crypto";
import { and, count, eq, gt, isNull, ne, sql } from "drizzle-orm";
import {
  createFieldCipher,
  generateDataKey,
  unwrapLinkKey,
  wrapLinkKey,
  type FieldCipher,
  type MasterKey,
} from "../crypto";
import type { Executor } from "../db/client";
import { SEALED, openValues } from "../db/sealed";
import { auditLog, consents, invites, links, notifications, practices, sharedReports } from "../db/schema";
import {
  AuditInput,
  PRACTICE_LINK_CONSENT_VERSION,
  type InviteStatus,
  type LinkParty,
  type NoticeKind,
  type PracticeCard,
  type PracticePlan,
  type SeatUse,
} from "../domain";
import { DataAccessError, InvalidStateError, parseInput } from "../errors";
import type { ScopeContext } from "./context";
import { loadDataKey } from "./data-keys";

/**
 * What the person's side and the practice's side share: the link's own key,
 * the practice as people see it, seats, the audit of both accounts, notices,
 * and ending a link. These cross from one account to another by nature; each
 * caller scopes the row it acts on before it gets here.
 */

export interface SharingContext extends ScopeContext {
  /** The master key: link keys are wrapped by it, and the practice's names opened for the people it invites. */
  readonly kek: MasterKey;
  /** The plan and seats of a practice that has no grant of its own. */
  readonly practiceDefaults: PracticePlan;
}

type LinkRow = typeof links.$inferSelect;
type PracticeRow = typeof practices.$inferSelect;
type InviteRow = typeof invites.$inferSelect;

/** A new link's id and key, the key wrapped and bound to that id. */
export function newLinkKey(kek: MasterKey): {
  id: string;
  cipher: FieldCipher;
  kekId: string;
  wrappedKey: Buffer;
} {
  const id = randomUUID();
  const key = generateDataKey();
  return { id, cipher: createFieldCipher(key, id), kekId: kek.id, wrappedKey: wrapLinkKey(kek, key, id) };
}

/** The cipher of what travels through one open link. An ended link has no key left to open. */
export function linkCipher(kek: MasterKey, row: Pick<LinkRow, "id" | "kekId" | "wrappedKey">): FieldCipher {
  if (!row.wrappedKey || !row.kekId) throw new InvalidStateError("the link has ended");
  // Rotation is not implemented yet: a key wrapped by another KEK cannot be opened.
  if (row.kekId !== kek.id) throw new DataAccessError("kek_mismatch");
  return createFieldCipher(unwrapLinkKey(kek, row.wrappedKey, row.id), row.id);
}

/** The name the person chose to be seen as, opened with the link's key. */
export function linkPersonName(kek: MasterKey, row: LinkRow): string | null {
  if (!row.personName) return null;
  return linkCipher(kek, row).openText(SEALED.links.columns.personName, row.personName);
}

/**
 * The practice as the people it invites see it. Its names are sealed with
 * the professional's own key, and opened here for exactly the audience they
 * were written for: someone holding its invite, or linked to it.
 */
export async function practiceCard(db: Executor, kek: MasterKey, row: PracticeRow): Promise<PracticeCard> {
  const cipher = createFieldCipher(await loadDataKey(db, kek, row.userId), row.userId);
  const open = openValues(cipher, SEALED.practices, row);
  return {
    id: row.id,
    professionalName: open.professionalName as string,
    practiceName: open.practiceName as string | null,
    registration: open.registration as string | null,
  };
}

/** One line naming the practice, as a consent records whom it was given to. */
export function practiceLine(
  card: Pick<PracticeCard, "professionalName" | "practiceName" | "registration">,
): string {
  return [card.professionalName, card.practiceName, card.registration].filter(Boolean).join(", ");
}

/**
 * A consent names the practice as the person saw it. When the page sends
 * back what it showed, refuse if the practice changed its names since, so
 * the person is asked again rather than consenting to names they never read.
 */
export function requireShown(card: PracticeCard, shown: string | undefined): void {
  if (shown !== undefined && shown !== practiceLine(card)) {
    throw new InvalidStateError("the practice changed since it was shown");
  }
}

/** The name a person chose for their own invite, opened with their key for the professional who holds the code. */
export async function invitePersonName(db: Executor, kek: MasterKey, row: InviteRow): Promise<string | null> {
  if (!row.personName) return null;
  const cipher = createFieldCipher(await loadDataKey(db, kek, row.userId), row.userId);
  return cipher.openText(SEALED.invites.columns.personName, row.personName);
}

export function planOf(
  row: Pick<PracticeRow, "seatSource" | "plan" | "seats">,
  defaults: PracticePlan,
): PracticePlan {
  return row.seatSource === "grant" ? { plan: row.plan ?? defaults.plan, seats: row.seats } : defaults;
}

export function inviteStatus(row: InviteRow, now: Date): InviteStatus {
  if (row.revokedAt) return "revoked";
  if (row.acceptedAt) return "accepted";
  if (row.expiresAt <= now) return "expired";
  return "pending";
}

/** A practice invite still holds its seat: not accepted, not revoked, not expired. */
export function pendingPracticeInvites(practiceId: string, now: Date) {
  return and(
    eq(invites.practiceId, practiceId),
    eq(invites.direction, "practice_to_person"),
    isNull(invites.acceptedAt),
    isNull(invites.revokedAt),
    gt(invites.expiresAt, now),
  );
}

/**
 * How a practice's seats stand. A seat is taken by an active link, and held
 * by a link waiting for the person's confirmation or a practice invite not
 * yet accepted. `exceptInvite` leaves out the invite being accepted, whose
 * held seat becomes the link's.
 */
export async function seatUse(
  db: Executor,
  practice: PracticeRow,
  defaults: PracticePlan,
  now: Date,
  exceptInvite?: string,
): Promise<SeatUse> {
  const [linkCounts] = await db
    .select({
      active: sql<number>`count(*) filter (where ${links.status} = 'active')`.mapWith(Number),
      pending: sql<number>`count(*) filter (where ${links.status} = 'pending')`.mapWith(Number),
    })
    .from(links)
    .where(and(eq(links.practiceId, practice.id), ne(links.status, "ended")));
  const [inviteCount] = await db
    .select({ n: count() })
    .from(invites)
    .where(
      exceptInvite
        ? and(pendingPracticeInvites(practice.id, now), ne(invites.id, exceptInvite))
        : pendingPracticeInvites(practice.id, now),
    );
  const { plan, seats } = planOf(practice, defaults);
  const active = linkCounts?.active ?? 0;
  const held = (linkCounts?.pending ?? 0) + (inviteCount?.n ?? 0);
  return { plan, seats, active, held, free: seats === null ? null : Math.max(0, seats - active - held) };
}

/** Refuse when no seat is free. */
export function requireSeat(use: SeatUse): void {
  if (use.free !== null && use.free < 1) throw new InvalidStateError("no seat is free");
}

/** The next number of a practice's links. Call with the practice row locked. */
export async function nextLinkNumber(db: Executor, practiceId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`coalesce(max(${links.number}), 0)`.mapWith(Number) })
    .from(links)
    .where(eq(links.practiceId, practiceId));
  return (row?.n ?? 0) + 1;
}

/** One event in the audit log of each account it concerns (the person's and the professional's). */
export async function auditAccounts(
  db: Executor,
  userIds: readonly string[],
  input: AuditInput,
): Promise<void> {
  const value = parseInput(AuditInput, input);
  const rows = [...new Set(userIds)].map((userId) => ({
    userId,
    action: value.action,
    targetType: value.targetType ?? null,
    targetId: value.targetId ?? null,
    metadata: value.metadata ?? {},
  }));
  if (rows.length > 0) await db.insert(auditLog).values(rows);
}

export async function notify(
  db: Executor,
  userId: string,
  kind: NoticeKind,
  ids: { linkId?: string; sharedReportId?: string },
): Promise<void> {
  await db.insert(notifications).values({
    userId,
    kind,
    linkId: ids.linkId ?? null,
    sharedReportId: ids.sharedReportId ?? null,
  });
}

/**
 * End a link, from either side, at once: the shared reports go, the notices
 * about the link go, the link's key and the name the person chose are
 * destroyed (so nothing sealed with them can be opened again, even from a
 * copy), and the other side is told. The person ending an active link is a
 * withdrawal of their consent, recorded as such. `row` must be locked.
 */
export async function endLink(
  db: Executor,
  row: LinkRow,
  practice: PracticeRow,
  by: LinkParty,
  now: Date,
): Promise<void> {
  if (row.status === "ended") throw new InvalidStateError("the link has ended");
  // A link that never started was declined (by the person) or withdrawn (by the practice): nothing was shared.
  const declined = row.status === "pending";
  await db.delete(sharedReports).where(eq(sharedReports.linkId, row.id));
  await db.delete(notifications).where(eq(notifications.linkId, row.id));
  await db
    .update(links)
    .set({
      status: "ended",
      endedAt: now,
      endedBy: by,
      wrappedKey: null,
      kekId: null,
      personName: null,
      updatedAt: now,
    })
    .where(eq(links.id, row.id));
  if (by === "person" && row.status === "active") {
    const [withdrawal] = await db
      .insert(consents)
      .values({
        userId: row.userId,
        purpose: "practice_link",
        version: PRACTICE_LINK_CONSENT_VERSION,
        granted: false,
        linkId: row.id,
      })
      .returning({ id: consents.id });
    await auditAccounts(db, [row.userId], {
      action: "consent.recorded",
      targetType: "consent",
      targetId: withdrawal!.id,
      metadata: { purpose: "practice_link", version: PRACTICE_LINK_CONSENT_VERSION, granted: false },
    });
  }
  await auditAccounts(db, [row.userId, practice.userId], {
    action: declined ? "link.declined" : "link.ended",
    targetType: "link",
    targetId: row.id,
    metadata: { practice_id: practice.id, actor: by, was: row.status },
  });
  const other = by === "person" ? practice.userId : row.userId;
  await notify(db, other, declined ? "link_declined" : "link_ended", { linkId: row.id });
}

/** The practice row, locked for the rest of the transaction. */
export async function lockPractice(db: Executor, practiceId: string): Promise<PracticeRow | undefined> {
  const [row] = await db.select().from(practices).where(eq(practices.id, practiceId)).for("update");
  return row;
}

/** The link the person holds with a practice, if one is open. */
export async function openLinkBetween(
  db: Executor,
  userId: string,
  practiceId: string,
): Promise<LinkRow | undefined> {
  const [row] = await db
    .select()
    .from(links)
    .where(and(eq(links.userId, userId), eq(links.practiceId, practiceId), ne(links.status, "ended")));
  return row;
}
