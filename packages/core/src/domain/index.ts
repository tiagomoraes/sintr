import { z } from "zod";

/**
 * Domain shapes, validated at the repository boundary. Content is never
 * trimmed, normalised or rewritten: the person's words are kept verbatim.
 * Limits only bound storage.
 */

const TEXT_MAX = 20_000;

export const Text = z.string().min(1).max(TEXT_MAX);
export const Intensity = z.number().int().min(0).max(100);
export const Scale5 = z.number().int().min(0).max(5);

export const Emotion = z.object({
  name: z.string().min(1).max(200),
  intensity: Intensity.nullable(),
});
export type Emotion = z.infer<typeof Emotion>;

const TimeZone = z.string().refine((value) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, "must be an IANA time zone");

const Language = z.string().refine((value) => {
  try {
    return Intl.getCanonicalLocales(value).length === 1;
  } catch {
    return false;
  }
}, "must be a BCP 47 language tag");

/* Profile and therapy settings */

export const ProfilePatch = z
  .object({
    displayName: z.string().min(1).max(200).nullable(),
    language: Language,
    timezone: TimeZone,
  })
  .partial();
export type ProfilePatch = z.input<typeof ProfilePatch>;

export interface Profile {
  displayName: string | null;
  language: string;
  timezone: string;
}

export const DeliveryChannel = z.enum(["download", "email"]);

export const TherapySettingsPatch = z
  .object({
    therapistName: z.string().min(1).max(200).nullable(),
    therapistContact: z.string().min(1).max(320).nullable(),
    sessionDay: z.number().int().min(0).max(6).nullable(),
    sessionTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "must be HH:MM")
      .nullable(),
    reportLeadMinutes: z.number().int().min(0).max(10_080),
    deliveryChannel: DeliveryChannel,
    /** A one-off date for the next session, when it moved; null clears it. */
    nextSessionAt: z.coerce.date().nullable(),
    reportNoticeEmail: z.boolean(),
  })
  .partial();
export type TherapySettingsPatch = z.input<typeof TherapySettingsPatch>;

export interface TherapySettings {
  therapistName: string | null;
  therapistContact: string | null;
  sessionDay: number | null;
  sessionTime: string | null;
  reportLeadMinutes: number;
  requireApproval: true;
  deliveryChannel: z.infer<typeof DeliveryChannel>;
  nextSessionAt: Date | null;
  reportNoticeEmail: boolean;
}

/* Entries (thought records) */

export const EntryContent = z.object({
  title: Text.nullable(),
  situation: Text.nullable(),
  thoughts: z.array(Text).max(50).nullable(),
  emotions: z.array(Emotion).max(30).nullable(),
  body: Text.nullable(),
  behavior: Text.nullable(),
  context: Text.nullable(),
  tags: z.array(z.string().min(1).max(100)).max(30).nullable(),
  notes: Text.nullable(),
  hotThought: Text.nullable(),
  evidenceFor: Text.nullable(),
  evidenceAgainst: Text.nullable(),
  alternative: Text.nullable(),
  emotionsAfter: z.array(Emotion).max(30).nullable(),
});

export const EntryInput = EntryContent.partial().extend({
  occurredAt: z.coerce.date().optional(),
  alternativeBelief: Intensity.nullable().optional(),
});
export type EntryInput = z.input<typeof EntryInput>;

export interface Entry extends z.infer<typeof EntryContent> {
  id: string;
  occurredAt: Date;
  alternativeBelief: number | null;
  peakIntensity: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/* Check-ins */

export const CheckinContent = z.object({
  sleepQuality: z.string().min(1).max(500).nullable(),
  note: Text.nullable(),
});

export const CheckinInput = CheckinContent.partial().extend({
  occurredAt: z.coerce.date().optional(),
  mood: Scale5.nullable().optional(),
  energy: Scale5.nullable().optional(),
  anxiety: Scale5.nullable().optional(),
  sleepHours: z.number().min(0).max(24).multipleOf(0.1).nullable().optional(),
});
export type CheckinInput = z.input<typeof CheckinInput>;

export interface Checkin extends z.infer<typeof CheckinContent> {
  id: string;
  occurredAt: Date;
  mood: number | null;
  energy: number | null;
  anxiety: number | null;
  sleepHours: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/* Corrections (the pack's correction rule: never rewrite history silently) */

export const CorrectionNote = z.string().min(1).max(2_000);

/** One dated change to an entry or a check-in, with what it replaced. */
export interface Correction {
  id: string;
  /** Names of the fields that changed. */
  fields: string[];
  /** What those fields held before the change; null where they were empty. */
  previous: Record<string, unknown>;
  note: string | null;
  createdAt: Date;
}

/** The result of correcting a record: the live record and the change, if any. */
export interface Corrected<T> {
  record: T;
  /** Null when nothing differed, so nothing was written. */
  correction: Correction | null;
}

/* Therapy notes */

export const TherapyNoteKind = z.enum(["session", "goal", "theme", "task", "to_bring"]);
export type TherapyNoteKind = z.infer<typeof TherapyNoteKind>;

export const TherapyNoteInput = z.object({
  kind: TherapyNoteKind,
  body: Text,
  sessionOn: z.iso.date().nullable().optional(),
});
export type TherapyNoteInput = z.input<typeof TherapyNoteInput>;

export interface TherapyNote {
  id: string;
  kind: TherapyNoteKind;
  body: string;
  sessionOn: string | null;
  doneAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/* Insights */

export const InsightKind = z.enum(["pattern", "helps", "question"]);
export type InsightKind = z.infer<typeof InsightKind>;

export const EvidenceRef = z.object({ kind: z.enum(["entry", "checkin"]), id: z.uuid() });

export const InsightInput = z.object({
  kind: InsightKind,
  body: Text,
  evidence: z.array(EvidenceRef).max(100).optional(),
  observedAt: z.coerce.date().optional(),
});
export type InsightInput = z.input<typeof InsightInput>;

export interface Insight {
  id: string;
  kind: InsightKind;
  body: string;
  evidence: z.infer<typeof EvidenceRef>[];
  observedAt: Date;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/* Reports */

export const ReportStatus = z.enum(["draft", "reviewed", "sent"]);
export type ReportStatus = z.infer<typeof ReportStatus>;

export const ReportDraftInput = z
  .object({
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
    sessionAt: z.coerce.date().nullable().optional(),
  })
  .refine((value) => value.periodEnd > value.periodStart, "period must end after it starts");
export type ReportDraftInput = z.input<typeof ReportDraftInput>;

export interface Report {
  id: string;
  status: ReportStatus;
  periodStart: Date;
  periodEnd: Date;
  sessionAt: Date | null;
  content: string | null;
  hasPdf: boolean;
  recipient: string | null;
  generatedAt: Date | null;
  editedAt: Date | null;
  reviewedAt: Date | null;
  sentAt: Date | null;
  consentId: string | null;
  notifiedAt: Date | null;
  /** First shared with a practice; the words are final from then on. */
  sharedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const ReportRevisionKind = z.enum(["edited", "prepared_again"]);
export type ReportRevisionKind = z.infer<typeof ReportRevisionKind>;

/** What a report said before one change (the person's edit, or a new preparation). */
export interface ReportRevision {
  id: string;
  kind: ReportRevisionKind;
  /** Names of the sections that changed. */
  sections: string[];
  /** The whole content before the change. */
  previous: string;
  createdAt: Date;
}

/* Consents */

export const ConsentPurpose = z.enum([
  "health_data_processing",
  "report_send",
  "practice_link",
  "report_share",
]);
export type ConsentPurpose = z.infer<typeof ConsentPurpose>;

export const ConsentInput = z.object({
  purpose: ConsentPurpose,
  version: z.string().min(1).max(40),
  granted: z.boolean(),
  reportId: z.uuid().nullable().optional(),
  recipient: z.string().min(1).max(600).nullable().optional(),
  linkId: z.uuid().nullable().optional(),
});
export type ConsentInput = z.input<typeof ConsentInput>;

export interface Consent {
  id: string;
  purpose: ConsentPurpose;
  version: string;
  granted: boolean;
  reportId: string | null;
  recipient: string | null;
  linkId: string | null;
  createdAt: Date;
}

/** The current version of the consent to process health data (LGPD art. 11). */
export const HEALTH_DATA_CONSENT_VERSION = "2026-10-18";

/** The current wording of the approval to send one report to one recipient. */
export const REPORT_SEND_CONSENT_VERSION = "2026-10-18";

/** The current wording of the consent to share approved reports with one practice (the link). */
export const PRACTICE_LINK_CONSENT_VERSION = "2026-10-18";

/** The current wording of the approval to share one report with one linked practice. */
export const REPORT_SHARE_CONSENT_VERSION = "2026-10-18";

/* Practices, invites and links (the therapist's side) */

/** A name or a line a professional shows: kept as typed, bounded for storage. */
const ShownLine = (max: number) => z.string().min(1).max(max);

export const PracticeInput = z.object({
  professionalName: ShownLine(120),
  practiceName: ShownLine(160).nullable().optional(),
  registration: ShownLine(120).nullable().optional(),
});
export type PracticeInput = z.input<typeof PracticeInput>;

export const PracticePatch = PracticeInput.partial().extend({ notifyEmail: z.boolean().optional() });
export type PracticePatch = z.input<typeof PracticePatch>;

/** Where a practice's seats come from: the installation's defaults, or a grant for this practice. */
export type SeatSource = "config" | "grant";

/** A plan and its seat count; `seats: null` is unlimited. */
export interface PracticePlan {
  plan: string;
  seats: number | null;
}

export interface Practice extends PracticePlan {
  id: string;
  professionalName: string;
  practiceName: string | null;
  registration: string | null;
  notifyEmail: boolean;
  seatSource: SeatSource;
  createdAt: Date;
}

/** What a person is shown of a practice: the names the professional chose to show. */
export interface PracticeCard {
  id: string;
  professionalName: string;
  practiceName: string | null;
  registration: string | null;
}

/** How a practice's seats stand: links open or waiting, and practice invites still pending. */
export interface SeatUse {
  plan: string;
  seats: number | null;
  /** Active links. */
  active: number;
  /** Links waiting for the person's confirmation, and practice invites not yet accepted. */
  held: number;
  /** Seats left for a new invite or acceptance; null when unlimited. */
  free: number | null;
}

/** How long an invite can be accepted. */
export const INVITE_DAYS = 7;
/** Invites one account may have waiting at once. */
export const MAX_PENDING_INVITES = { practice: 50, person: 5 } as const;

export const InviteDirection = z.enum(["practice_to_person", "person_to_practice"]);
export type InviteDirection = z.infer<typeof InviteDirection>;

/** The name a person chooses to be seen as by a practice. */
export const PersonName = z.string().min(1).max(80);

export const PracticeInviteInput = z.object({ note: z.string().min(1).max(120).nullable().optional() });
export type PracticeInviteInput = z.input<typeof PracticeInviteInput>;

export const PersonInviteInput = z.object({ personName: PersonName.nullable().optional() });
export type PersonInviteInput = z.input<typeof PersonInviteInput>;

export type InviteStatus = "pending" | "accepted" | "expired" | "revoked";

/** An invite as its creator sees it. */
export interface Invite {
  id: string;
  direction: InviteDirection;
  status: InviteStatus;
  /** The code as it is read aloud and typed: XXXX-XXXX-XXXX. */
  code: string;
  /** The professional's own note on who it is for. */
  note: string | null;
  /** For a person's invite: the name they chose to be seen as. */
  personName: string | null;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  linkId: string | null;
  createdAt: Date;
}

/** What /join shows about a code before anyone accepts it. Nothing about an invalid one. */
export type InvitePreview =
  | {
      status: "valid";
      direction: "practice_to_person";
      inviteId: string;
      expiresAt: Date;
      practice: PracticeCard;
      /** The viewer made it. */
      own: boolean;
    }
  | {
      status: "valid";
      direction: "person_to_practice";
      inviteId: string;
      expiresAt: Date;
      personName: string | null;
      own: boolean;
    }
  | { status: "invalid" };

export const ShareMode = z.enum(["ask", "auto"]);
export type ShareMode = z.infer<typeof ShareMode>;
export type LinkStatus = "pending" | "active" | "ended";
export type LinkParty = "person" | "practice";

/** A report shared through a link, without its words. */
export interface ShareSummary {
  id: string;
  reportId: string;
  sessionAt: Date | null;
  periodStart: Date;
  periodEnd: Date;
  sharedAt: Date;
  firstReadAt: Date | null;
}

/** A link as the person sees it. */
export interface PersonLink {
  id: string;
  status: "pending" | "active";
  practice: PracticeCard;
  personName: string | null;
  shareMode: ShareMode;
  personAcceptedAt: Date | null;
  practiceAcceptedAt: Date | null;
  createdAt: Date;
  shares: ShareSummary[];
}

/** A link as the practice sees it: the name the person chose, or none, and nothing else of them. */
export interface PracticeLink {
  id: string;
  status: "pending" | "active";
  number: number;
  personName: string | null;
  createdAt: Date;
  /** When both sides had accepted. */
  activeSince: Date | null;
  lastSharedAt: Date | null;
}

/** A report a practice received, without its words. */
export interface ReceivedReport extends ShareSummary {
  linkId: string;
  number: number;
  personName: string | null;
}

/**
 * The approved report as the practice reads it in place: the content with
 * its frozen numbers, the period, which quotes were found in the diary word
 * for word (the highlighter), the time zone and the name the report prints.
 */
export interface SharedReportSnapshot {
  v: 1;
  content: unknown;
  period: { kind: "session" | "week"; label: string; start: string; end: string; session: string | null };
  verified: string[];
  timeZone: string;
  personName: string | null;
}

export interface SharedReport extends ReceivedReport {
  snapshot: SharedReportSnapshot;
}

export type NoticeKind = "link_pending" | "link_active" | "link_declined" | "link_ended" | "report_shared";

/**
 * An in-app notice: a kind and ids, worded when it is shown. `side` says
 * which side of a link the account is on (an account can be both a person
 * and a professional). The person's side is shown the practice; the
 * practice's side the name the person chose, only while the link is open.
 */
export interface NoticeView {
  id: string;
  kind: NoticeKind;
  side: "person" | "practice";
  linkId: string | null;
  sharedReportId: string | null;
  readAt: Date | null;
  createdAt: Date;
  practice: PracticeCard | null;
  personName: string | null;
  number: number | null;
}

/* Conversations */

export const MessageRole = z.enum(["user", "assistant", "system", "tool"]);
export type MessageRole = z.infer<typeof MessageRole>;

export const MessageInput = z.object({ role: MessageRole, content: z.string().min(1).max(100_000) });
export type MessageInput = z.input<typeof MessageInput>;

export interface Conversation {
  id: string;
  title: string | null;
  lastMessageAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: Date;
}

/* The embedded agent: provider settings (bring your own key) */

export const ProviderKind = z.enum(["openai_compatible", "anthropic", "google"]);
export type ProviderKind = z.infer<typeof ProviderKind>;

export const AgentSettingsPatch = z
  .object({
    provider: ProviderKind.nullable(),
    baseUrl: z
      .url({ protocol: /^https?$/ })
      .max(500)
      .nullable(),
    model: z.string().min(1).max(200).nullable(),
    /** A new key, or null to remove the saved one. Absent keeps it. */
    apiKey: z.string().min(1).max(2_000).nullable(),
    conversationRetentionDays: z.number().int().min(1).max(3_650).nullable(),
  })
  .partial();
export type AgentSettingsPatch = z.input<typeof AgentSettingsPatch>;

/** What may be shown: the key itself never leaves the server once saved. */
export interface AgentSettings {
  provider: ProviderKind | null;
  baseUrl: string | null;
  model: string | null;
  hasKey: boolean;
  /** The last characters of a long key, to recognise it; null otherwise. */
  keyHint: string | null;
  conversationRetentionDays: number | null;
}

/** For the server-side model call only. Never rendered, never logged. */
export interface ProviderCredentials {
  provider: ProviderKind;
  baseUrl: string | null;
  model: string;
  apiKey: string | null;
}

/* Proposals: what the assistant drafted, waiting for the person */

export const ProposalKind = z.enum(["entry", "checkin"]);
export type ProposalKind = z.infer<typeof ProposalKind>;
export const ProposalStatus = z.enum(["proposed", "saved", "discarded"]);
export type ProposalStatus = z.infer<typeof ProposalStatus>;

interface ProposalBase {
  id: string;
  conversationId: string;
  status: ProposalStatus;
  edited: boolean;
  recordId: string | null;
  decidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Payload dates are ISO strings: a proposal is JSON until it is saved. */
export type Proposal =
  | (ProposalBase & { kind: "entry"; payload: EntryInput })
  | (ProposalBase & { kind: "checkin"; payload: CheckinInput });

export type ProposalInput =
  | { conversationId: string; kind: "entry"; payload: EntryInput }
  | { conversationId: string; kind: "checkin"; payload: CheckinInput };

/* API tokens */

export const DATA_TYPES = ["entries", "checkins", "therapy", "insights", "reports"] as const;
export const API_TOKEN_SCOPES = DATA_TYPES.flatMap((type) => [`${type}:read`, `${type}:write`] as const);
export const ApiTokenScope = z.enum(API_TOKEN_SCOPES as [string, ...string[]]);
export type ApiTokenScope = `${(typeof DATA_TYPES)[number]}:${"read" | "write"}`;

export const ApiTokenInput = z.object({
  name: z.string().min(1).max(80),
  scopes: z.array(ApiTokenScope).min(1),
  expiresAt: z.coerce.date().nullable().optional(),
});
export type ApiTokenInput = { name: string; scopes: ApiTokenScope[]; expiresAt?: Date | null };

/**
 * What a connection key may do, as the app offers it: three sets of the
 * per-data-type scopes, and only those the MCP tools use. "read" sees the
 * diary and saves nothing; "write" saves entries and check-ins and reads
 * nothing back.
 */
export const API_TOKEN_ACCESS = {
  read_write: [
    "entries:read",
    "checkins:read",
    "therapy:read",
    "reports:read",
    "entries:write",
    "checkins:write",
  ],
  read: ["entries:read", "checkins:read", "therapy:read", "reports:read"],
  write: ["entries:write", "checkins:write"],
} as const satisfies Record<string, readonly ApiTokenScope[]>;
export type ApiTokenAccess = keyof typeof API_TOKEN_ACCESS;
export const ApiTokenAccess = z.enum(Object.keys(API_TOKEN_ACCESS) as [ApiTokenAccess, ...ApiTokenAccess[]]);

/** The access a set of scopes matches exactly, or null for any other set. */
export function accessOf(scopes: readonly ApiTokenScope[]): ApiTokenAccess | null {
  const held = new Set(scopes);
  for (const [access, wanted] of Object.entries(API_TOKEN_ACCESS) as [ApiTokenAccess, readonly string[]][]) {
    if (wanted.length === held.size && wanted.every((scope) => held.has(scope as ApiTokenScope)))
      return access;
  }
  return null;
}

/** Keys a person may hold at once; revoked and expired ones do not count. */
export const MAX_ACTIVE_API_TOKENS = 20;

export interface ApiToken {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: ApiTokenScope[];
  lastUsedAt: Date | null;
  /** The name the connected client gave for itself when it last connected (MCP `clientInfo`). */
  lastClient: string | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

/* Audit log */

export const AuditAction = z.enum([
  "account.created",
  "session.created",
  "consent.recorded",
  "api_token.created",
  "api_token.revoked",
  "mcp.entry_saved",
  "mcp.checkin_saved",
  "report.prepared",
  "report.edited",
  "report.reviewed",
  "report.sent",
  "report.send_failed",
  "data.exported",
  "data.deleted",
  "agent_key.saved",
  "agent_key.removed",
  "practice.opened",
  "practice.updated",
  "practice.plan_changed",
  "invite.created",
  "invite.revoked",
  "invite.accepted",
  "link.activated",
  "link.declined",
  "link.ended",
  "link.changed",
  "share.created",
  "share.read",
  "share.downloaded",
]);
export type AuditAction = z.infer<typeof AuditAction>;

/** Identifiers and codes only: short keys, primitive values, short strings. */
export const AuditMetadata = z.record(
  z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
  z.union([z.string().max(100), z.number(), z.boolean(), z.null()]),
);

export const AuditInput = z.object({
  action: AuditAction,
  targetType: z
    .string()
    .regex(/^[a-z_]{1,40}$/)
    .nullable()
    .optional(),
  targetId: z.string().max(100).nullable().optional(),
  metadata: AuditMetadata.optional(),
});
export type AuditInput = z.input<typeof AuditInput>;

export interface AuditEvent {
  id: string;
  action: AuditAction;
  targetType: string | null;
  targetId: string | null;
  metadata: z.infer<typeof AuditMetadata>;
  createdAt: Date;
}
