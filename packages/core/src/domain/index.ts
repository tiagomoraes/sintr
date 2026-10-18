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
  reviewedAt: Date | null;
  sentAt: Date | null;
  consentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/* Consents */

export const ConsentPurpose = z.enum(["health_data_processing", "report_send"]);
export type ConsentPurpose = z.infer<typeof ConsentPurpose>;

export const ConsentInput = z.object({
  purpose: ConsentPurpose,
  version: z.string().min(1).max(40),
  granted: z.boolean(),
  reportId: z.uuid().nullable().optional(),
  recipient: z.string().min(1).max(320).nullable().optional(),
});
export type ConsentInput = z.input<typeof ConsentInput>;

export interface Consent {
  id: string;
  purpose: ConsentPurpose;
  version: string;
  granted: boolean;
  reportId: string | null;
  recipient: string | null;
  createdAt: Date;
}

/** The current version of the consent to process health data (LGPD art. 11). */
export const HEALTH_DATA_CONSENT_VERSION = "2026-10-18";

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

export interface ApiToken {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: ApiTokenScope[];
  lastUsedAt: Date | null;
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
  "report.sent",
  "data.exported",
  "data.deleted",
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
