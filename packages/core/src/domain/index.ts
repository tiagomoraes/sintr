import { z } from "zod";
import { SESSION_REPEATS } from "../report/sessions";

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

const Language = z
  .string()
  .max(35)
  .refine((value) => {
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
    preferredName: z.string().min(1).max(80).nullable(),
    locale: Language.nullable(),
    seenLocale: Language.nullable(),
    reportLanguage: Language.nullable(),
    timezone: TimeZone,
  })
  .partial();
export type ProfilePatch = z.input<typeof ProfilePatch>;

export interface Profile {
  /** The name printed on reports, chosen in Therapy. */
  displayName: string | null;
  /**
   * How the person wants to be called in the app. Never printed on a report;
   * sent to their assistant only while their memory is on (DECISIONS 116).
   */
  preferredName: string | null;
  /** The language the person chose for sintr (a catalog's code, such as pt-BR); null until they choose. */
  locale: string | null;
  /** The language sintr last spoke to the person in: what it writes while they are away follows it. */
  seenLocale: string | null;
  /** The language the person chose for their reports in Therapy; null follows their language. */
  reportLanguage: string | null;
  timezone: string;
  /** When the welcome after signing up was finished or set aside; null until then. */
  onboardedAt: Date | null;
}

export const DeliveryChannel = z.enum(["download", "email"]);

export const TherapySettingsPatch = z
  .object({
    therapistName: z.string().min(1).max(200).nullable(),
    therapistContact: z.string().min(1).max(320).nullable(),
    reportLeadMinutes: z.number().int().min(0).max(10_080),
    deliveryChannel: DeliveryChannel,
    reportNoticeEmail: z.boolean(),
  })
  .partial();
export type TherapySettingsPatch = z.input<typeof TherapySettingsPatch>;

export interface TherapySettings {
  therapistName: string | null;
  therapistContact: string | null;
  reportLeadMinutes: number;
  requireApproval: true;
  deliveryChannel: z.infer<typeof DeliveryChannel>;
  reportNoticeEmail: boolean;
}

/* The therapy calendar (F11): sessions as days and times, never words */

const SessionDay = z.iso
  .date()
  .refine((day) => day >= "2000-01-01" && day <= "2100-12-31", "must be a day between 2000 and 2100");
const SessionTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "must be HH:MM");
export const SessionRepeat = z.enum(SESSION_REPEATS);
export type SessionRepeat = z.infer<typeof SessionRepeat>;

/** A session the person adds, or a rhythm they change from one session on. */
export const SessionSeriesInput = z
  .object({
    startsOn: SessionDay,
    time: SessionTime,
    repeat: SessionRepeat,
    weekdays: z.array(z.number().int().min(0).max(6)).max(7).default([]),
  })
  .refine((series) => (series.repeat === "weekdays") === series.weekdays.length > 0, {
    message: "weekdays are chosen for a rhythm on chosen weekdays, and only for it",
    path: ["weekdays"],
  });
export type SessionSeriesInput = z.input<typeof SessionSeriesInput>;

/** Where one session moves to. */
export const SessionMove = z.object({ on: SessionDay, time: SessionTime });
export type SessionMove = z.input<typeof SessionMove>;

/** Names one session: its series and its own day in it. */
export const SessionRef = z.object({ seriesId: z.uuid(), occursOn: SessionDay });
export type SessionRef = z.input<typeof SessionRef>;

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
  "memory",
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

/**
 * The current wording of the consent to keep a memory of the person, which
 * sends their diary to the providers it names (DECISIONS 115). The consent
 * records those providers as its recipient; another route needs a new yes.
 */
export const MEMORY_CONSENT_VERSION = "2026-10-19";

/* Memory (F10): what sintr remembers of a person, from their own diary */

export const MemoryKind = z.enum(["name", "about", "moment"]);
export type MemoryKind = z.infer<typeof MemoryKind>;

/** A memory's sentence, as sintr wrote it or the person corrected it. */
export const MemoryText = z.string().trim().min(1).max(300);
/** The person's own words a memory rests on, found word for word in its source. */
export const MemoryQuote = z.string().min(1).max(400);

/** Where a memory came from: an entry, a check-in, or the welcome (the name). */
export type MemorySource =
  { kind: "entry"; id: string } | { kind: "checkin"; id: string } | { kind: "welcome" };

export interface Memory {
  id: string;
  kind: MemoryKind;
  text: string;
  /** The person's words it rests on; null for the name. */
  quote: string | null;
  source: MemorySource;
  /** When what it remembers happened (its source's time); for the name, when it was given. */
  occurredAt: Date;
  /** The space its vector is in ("text-embedding-3-small@1536"); null without one. */
  embeddingModel: string | null;
  /** When the person corrected it. */
  editedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** A memory found by reading one source, before it is kept. Its vector is the provider's; the repository turns it. */
export interface FoundMemory {
  kind: "about" | "moment";
  text: string;
  quote: string;
  embedding: number[] | null;
}

/** The model that made a set of vectors, and their length: vectors are compared only within one. */
export interface EmbeddingSpace {
  model: string;
  dimensions: number;
}

/** A source of the diary not read for the memory yet (or changed since it was). */
export type UnreadSource = { kind: "entry"; entry: Entry } | { kind: "checkin"; checkin: Checkin };

/** How far the reading of the diary has gone. */
export interface MemoryProgress {
  read: number;
  unread: number;
}

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

/**
 * Where a practice's seats come from: the installation's defaults, a grant
 * for this practice, or its subscription with the payment provider.
 */
export type SeatSource = "config" | "grant" | "subscription";

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
  /** The practice's neutral label for the person ("Patient 3"), shown when they chose no name. */
  number: number;
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

/**
 * The house assistant: the installation's own provider, model and key, from
 * the environment. Everyone without a key of their own talks to it, within
 * their plan. The key never leaves the server and is never logged.
 */
export interface HouseAssistant extends ProviderCredentials {
  /** Who people are told receives their conversations, such as "Anthropic". */
  name: string;
  /** How the house turns speech into text. */
  voice: HouseVoice;
  /** How the house places a memory by meaning. */
  memory: HouseMemory;
}

/**
 * How the house computes the vectors of a memory (SINTR_HOUSE_EMBED_*): by
 * default through the house assistant's own provider and key, when that
 * provider has embeddings; or through an OpenAI-compatible endpoint of its
 * own. Off: the house offers no memory.
 */
export interface HouseMemory {
  off: boolean;
  /** An embeddings endpoint of its own, for a house whose provider has none (Anthropic). */
  endpoint: { baseUrl: string; apiKey: string | null } | null;
  /** The embeddings model; null for the provider's default. */
  model: string | null;
}

/**
 * How the house transcribes what a person says (SINTR_HOUSE_STT_*): by
 * default through the house assistant's own provider and key, when that
 * provider transcribes; or through an OpenAI-compatible endpoint of its own.
 */
export interface HouseVoice {
  /** SINTR_HOUSE_STT_MODEL=off: the house offers no speaking. */
  off: boolean;
  /** A transcription endpoint of its own, for a house whose provider has none (Anthropic). */
  endpoint: { baseUrl: string; apiKey: string | null } | null;
  /** The transcription model; null for the provider's default. */
  model: string | null;
  /** The language to expect when the person's own writing says nothing (ISO 639-1). */
  language: string | null;
}

/* Plans: how much of the house assistant a person may use each month */

export const PlanId = z.enum(["free", "personal", "unlimited"]);
export type PlanId = z.infer<typeof PlanId>;

/** What the house assistant may be used for in one month. null is no limit. */
export interface Allowance {
  /** Messages the assistant answered. */
  assistantMessages: number | null;
  /** Reports the assistant wrote. */
  reports: number | null;
  /** Minutes of speech the house transcribes, counted to the second. */
  audioMinutes: number | null;
}
export type Meter = keyof Allowance;
export const METERS = ["assistantMessages", "reports", "audioMinutes"] as const satisfies readonly Meter[];

/**
 * The person plans, and their numbers (DECISIONS records why these). The
 * diary itself is the same on every plan: entries, check-ins and reports
 * never depend on the assistant.
 */
export const PERSON_PLANS: Record<PlanId, { label: string; allowance: Allowance }> = {
  free: { label: "Free", allowance: { assistantMessages: 100, reports: 4, audioMinutes: 15 } },
  personal: { label: "Personal", allowance: { assistantMessages: 600, reports: 12, audioMinutes: 120 } },
  unlimited: {
    label: "Unlimited",
    allowance: { assistantMessages: null, reports: null, audioMinutes: null },
  },
};

export type SubscriptionKind = "person" | "practice";
export const SubscriptionStatus = z.enum([
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "paused",
  "incomplete",
  "incomplete_expired",
  "canceled",
]);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatus>;
/** A grant made by whoever runs the installation, or a subscription with the payment provider. */
export type SubscriptionSource = "grant" | "stripe";

/** A status that keeps the plan: paid, in a trial, or a payment the provider is still retrying. */
export function isEntitling(status: SubscriptionStatus): boolean {
  return status === "active" || status === "trialing" || status === "past_due";
}

export interface Subscription {
  id: string;
  kind: SubscriptionKind;
  /** For a person, "personal" or "unlimited"; for a practice, "practice". */
  plan: string;
  status: SubscriptionStatus;
  source: SubscriptionSource;
  /** A practice's seats; null otherwise. */
  seats: number | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  /** The payment provider knows this account as a customer, so its billing page can open. */
  hasCustomer: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Where a person's plan comes from. */
export type PlanSource = "installation" | "grant" | "subscription" | "practice";

export interface PersonPlan {
  id: PlanId;
  label: string;
  source: PlanSource;
  allowance: Allowance;
}

/** One month of the meter, in the person's own calendar. */
export interface UsagePeriod {
  /** Its first day, YYYY-MM-DD. */
  start: string;
  /** The first day of the next month, when the count starts again. */
  next: string;
}

export interface Entitlements {
  plan: PersonPlan;
  /** The person's own subscription, if any, whatever its status. */
  subscription: Subscription | null;
  period: UsagePeriod;
  used: Record<Meter, number>;
  /** Speech transcribed by the house this month, to the second (`used.audioMinutes` rounds it up). */
  spokenSeconds: number;
}

/**
 * Seconds of speech taken from the month before the house transcribes a
 * recording: refused once the month's minutes are used, never halfway
 * through a recording that started with time left.
 */
export interface TakenAudio {
  ok: boolean;
  /** Seconds used this month, these included when they were taken. */
  usedSeconds: number;
  /** The month's allowance in seconds; null for no limit. */
  limitSeconds: number | null;
  /** What was taken, to settle against what the provider counted. */
  seconds: number;
  period: UsagePeriod;
}

/** The result of taking one unit of a meter: refused when the month's allowance is used. */
export interface Taken {
  ok: boolean;
  /** Units used this month, this one included when it was taken. */
  used: number;
  limit: number | null;
  period: UsagePeriod;
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
  "plan.changed",
  "memory.corrected",
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
