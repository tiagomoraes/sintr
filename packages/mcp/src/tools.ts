/**
 * The tools a connected agent may call. Reads are small and bounded; the
 * two writes are held to the capture rules of the embedded assistant
 * (`@sintr/agent/rules`): the person's own words for thoughts and emotions,
 * only numbers the person gave, nothing invented, and the crisis screen
 * first. Everything goes through the person's `UserScope`, which seals and
 * scopes every value; nothing here sends anything to anyone.
 */
import {
  CRISIS_LINES,
  CheckinDraft,
  EntryDraft,
  checkCheckinDraft,
  checkEntryDraft,
  checkinInputFromDraft,
  crisisMessage,
  entryInputFromDraft,
  screenForRisk,
  type CrisisLanguage,
} from "@sintr/agent/rules";
import {
  NotFoundError,
  collectDigest,
  periodAgain,
  periodOf,
  planReportNow,
  preparationTime,
  upcomingSession,
  type ApiTokenScope,
  type Logger,
  type Report,
  type ReportPeriod,
  type TherapyNote,
  type UserScope,
} from "@sintr/core";
import { z } from "zod";
import { WEEKDAYS, checkinView, entryTitle, entryView, moment, rounded, wallClock } from "./views";

const DAY = 24 * 60 * 60 * 1000;

/** The bounds of every read, so a call stays small whatever the diary holds. */
export const LIMITS = {
  recentDays: 14,
  recentEntries: 20,
  recentCheckins: 28,
  notesPerKind: 20,
  sessionNotes: 5,
  reportEntries: 40,
  reportFrequencies: 20,
  personWords: 40,
} as const;

export interface ToolContext {
  scope: UserScope;
  /** The scopes of the token this call was made with. */
  scopes: ReadonlySet<ApiTokenScope>;
  tokenId: string;
  /** The app's address, for links the person can open. */
  appUrl: URL;
  log: Logger;
  now: () => Date;
}

/** What a token must hold: every scope in `all`, and one of `any` when given. */
export interface Needs {
  all?: readonly ApiTokenScope[];
  any?: readonly ApiTokenScope[];
}

/** A call the tool turned down, with reasons the agent can act on. Nothing was changed. */
export class Refusal extends Error {
  override readonly name = "Refusal";
  constructor(readonly problems: string[]) {
    super("refused");
  }
}

export interface SintrTool {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly needs: Needs;
  readonly input: z.ZodObject;
  /** Reads only: the MCP `readOnlyHint`. */
  readonly readOnly: boolean;
  /** Validates the raw input, then runs. Scope is checked by `callTool`. */
  run(raw: unknown, context: ToolContext): Promise<unknown>;
}

function define<S extends z.ZodObject>(
  spec: Omit<SintrTool, "run" | "input"> & {
    input: S;
    run(input: z.output<S>, context: ToolContext): Promise<unknown>;
  },
): SintrTool {
  return {
    ...spec,
    async run(raw, context) {
      const parsed = spec.input.safeParse(raw ?? {});
      if (!parsed.success) {
        // Zod 4 messages describe the expectation, never the value received.
        throw new Refusal(parsed.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`));
      }
      return spec.run(parsed.data, context);
    },
  };
}

export function permits(needs: Needs, scopes: ReadonlySet<ApiTokenScope>): boolean {
  return (
    (needs.all ?? []).every((scope) => scopes.has(scope)) &&
    (!needs.any || needs.any.some((scope) => scopes.has(scope)))
  );
}

function describeNeeds(needs: Needs): string {
  const all = needs.all?.join(", ");
  const any = needs.any?.join(" or ");
  return [all, any].filter(Boolean).join(", and ");
}

/** Run one tool for one token: the scope gate first, then the tool itself. */
export async function callTool(tool: SintrTool, raw: unknown, context: ToolContext): Promise<unknown> {
  if (!permits(tool.needs, context.scopes)) {
    throw new Refusal([
      `this connection key cannot use ${tool.name}: it needs ${describeNeeds(tool.needs)}. The person can create a key that can, in sintr under Connect.`,
    ]);
  }
  return tool.run(raw, context);
}

/* Shared by the two writes */

const PersonWords = z
  .array(z.string().min(1).max(20_000))
  .min(1)
  .max(LIMITS.personWords)
  .describe(
    "The person's own messages this record comes from, exactly as they wrote them, one message per item. Never your summary. sintr checks the draft against them and does not keep them.",
  );

const PersonConfirmed = z
  .literal(true)
  .describe("true only after the person saw this draft and said to save it.");

/** The answer to words that signal acute risk: nothing saved, the fixed message, the lines. */
function crisisAnswer(language: CrisisLanguage) {
  return {
    saved: false,
    crisis: true,
    stopTheDiary:
      "The person's words signal acute risk. Nothing was saved. Stop the diary now: do not record, ask or analyse anything. Give them this message (or the same in your words, in their language) and stay with them warmly.",
    message: crisisMessage(language),
    lines: CRISIS_LINES,
  };
}

/** Every string in a value, however deep: each field a draft holds, so none is missed. */
function stringsIn(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value && typeof value === "object") return Object.values(value).flatMap(stringsIn);
  return [];
}

/**
 * The crisis screen of the embedded assistant, over the person's words and
 * every word of the draft, since an agent may write in any field.
 */
function screenAll(...values: unknown[]) {
  for (const text of values.flatMap(stringsIn)) {
    const screening = screenForRisk(text);
    if (screening.risk) return screening;
  }
  return null;
}

/* The tools */

const recentContext = define({
  name: "recent_context",
  title: "The last days, in short",
  description:
    "A compact view of the person's last days: each entry's date, title and emotions with intensities, and each check-in's values. Use it only when it helps, for example when the person mentions an earlier moment. read_entry opens one entry in full.",
  needs: { any: ["entries:read", "checkins:read"] },
  readOnly: true,
  input: z.object({
    days: z
      .number()
      .int()
      .min(1)
      .max(LIMITS.recentDays)
      .optional()
      .describe(`How many days back, 1 to ${LIMITS.recentDays}. 7 when left out.`),
  }),
  async run({ days = 7 }, { scope, scopes, now }) {
    const profile = await scope.profile.get();
    const timeZone = profile.timezone;
    const from = new Date(now().getTime() - days * DAY);
    const [entries, checkins] = await Promise.all([
      scopes.has("entries:read") ? scope.entries.list({ from, limit: LIMITS.recentEntries + 1 }) : null,
      scopes.has("checkins:read") ? scope.checkins.list({ from, limit: LIMITS.recentCheckins + 1 }) : null,
    ]);
    return {
      now: wallClock(now(), timeZone),
      timeZone,
      days,
      ...(entries
        ? {
            entries: entries.slice(0, LIMITS.recentEntries).map((entry) => ({
              id: entry.id,
              when: wallClock(entry.occurredAt, timeZone),
              title: entryTitle(entry),
              emotions: entry.emotions ?? [],
            })),
            moreEntries: entries.length > LIMITS.recentEntries,
          }
        : {}),
      ...(checkins
        ? {
            checkins: checkins.slice(0, LIMITS.recentCheckins).map((checkin) => ({
              id: checkin.id,
              when: wallClock(checkin.occurredAt, timeZone),
              mood: checkin.mood,
              energy: checkin.energy,
              anxiety: checkin.anxiety,
              sleepHours: checkin.sleepHours,
            })),
            moreCheckins: checkins.length > LIMITS.recentCheckins,
          }
        : {}),
    };
  },
});

const readEntry = define({
  name: "read_entry",
  title: "Open one entry",
  description:
    "One entry of the person's diary in full, in their words exactly as recorded. The id comes from recent_context, prepare_report or save_entry.",
  needs: { all: ["entries:read"] },
  readOnly: true,
  input: z.object({ id: z.string().min(1).max(100).describe("The entry's id.") }),
  async run({ id }, { scope, appUrl }) {
    const [entry, profile] = await Promise.all([scope.entries.get(id), scope.profile.get()]);
    if (!entry) throw new NotFoundError("entry");
    return entryView(entry, profile.timezone, appUrl);
  },
});

const saveEntry = define({
  name: "save_entry",
  title: "Save a thought record",
  description:
    "Save an entry (a thought record) in the person's diary, after they saw the draft and said yes. Include only what they actually said: thoughts and emotion words copied from their messages, numbers they gave. Pass their messages in personWords. sintr refuses a draft that paraphrases or invents, with the reasons, and saves nothing then. If their words signal acute risk, sintr saves nothing and answers with crisis: true.",
  needs: { all: ["entries:write"] },
  readOnly: false,
  input: EntryDraft.extend({ personWords: PersonWords, personConfirmed: PersonConfirmed }),
  async run(input, { scope, tokenId, appUrl, log }) {
    const { personWords, personConfirmed: _confirmed, ...draft } = input;
    const risk = screenAll(personWords, draft);
    if (risk) {
      log.info("mcp.crisis", { code: `screen_${risk.kind}`, tokenId });
      return crisisAnswer(risk.language);
    }
    const profile = await scope.profile.get();
    const checked = checkEntryDraft(draft, personWords, { timezone: profile.timezone });
    if (!checked.ok) throw new Refusal(checked.problems);
    const entry = await scope.transaction(async (tx) => {
      const created = await tx.entries.create(entryInputFromDraft(checked.draft));
      await tx.auditLog.record({
        action: "mcp.entry_saved",
        targetType: "entry",
        targetId: created.id,
        metadata: { token_id: tokenId },
      });
      return created;
    });
    return { saved: true, entry: entryView(entry, profile.timezone, appUrl) };
  },
});

const saveCheckin = define({
  name: "save_checkin",
  title: "Save a check-in",
  description:
    "Save a quick check-in after the person said yes: mood, energy and anxiety from 0 to 5, hours of sleep, how the sleep was, a note. Only what they gave; pass their messages in personWords. sintr refuses a number the person never wrote, and saves nothing then.",
  needs: { all: ["checkins:write"] },
  readOnly: false,
  input: CheckinDraft.extend({ personWords: PersonWords, personConfirmed: PersonConfirmed }),
  async run(input, { scope, tokenId, appUrl, log }) {
    const { personWords, personConfirmed: _confirmed, ...draft } = input;
    const risk = screenAll(personWords, draft);
    if (risk) {
      log.info("mcp.crisis", { code: `screen_${risk.kind}`, tokenId });
      return crisisAnswer(risk.language);
    }
    const profile = await scope.profile.get();
    const checked = checkCheckinDraft(draft, personWords, { timezone: profile.timezone });
    if (!checked.ok) throw new Refusal(checked.problems);
    const checkin = await scope.transaction(async (tx) => {
      const created = await tx.checkins.create(checkinInputFromDraft(checked.draft));
      await tx.auditLog.record({
        action: "mcp.checkin_saved",
        targetType: "checkin",
        targetId: created.id,
        metadata: { token_id: tokenId },
      });
      return created;
    });
    return { saved: true, checkin: checkinView(checkin, profile.timezone, appUrl) };
  },
});

function openNotes(notes: readonly TherapyNote[], kind: TherapyNote["kind"]) {
  return notes
    .filter((note) => note.kind === kind && note.doneAt === null)
    .slice(0, LIMITS.notesPerKind)
    .map((note) => ({ id: note.id, body: note.body }));
}

const therapyOverview = define({
  name: "therapy_overview",
  title: "The therapy, in short",
  description:
    "When the person's sessions are, when the next report will be prepared, and their open goals, themes, tasks and things they want to bring up, with their last session notes. The therapist's name and contact are not shared.",
  needs: { all: ["therapy:read"] },
  readOnly: true,
  input: z.object({}),
  async run(_input, { scope, now }) {
    const [settings, profile, notes] = await Promise.all([
      scope.therapySettings.get(),
      scope.profile.get(),
      scope.therapyNotes.list(),
    ]);
    const timeZone = profile.timezone;
    const session = upcomingSession(settings, timeZone, now());
    const prepared = session ? preparationTime(settings, session) : null;
    return {
      now: wallClock(now(), timeZone),
      timeZone,
      sessions: {
        weekly:
          settings.sessionDay !== null && settings.sessionTime
            ? `${WEEKDAYS[settings.sessionDay]} at ${settings.sessionTime}`
            : null,
        next: session ? moment(session, timeZone) : null,
        nextReportPrepared: prepared ? moment(prepared, timeZone) : null,
      },
      hasTherapist: settings.therapistName !== null || settings.therapistContact !== null,
      approvedReports:
        settings.deliveryChannel === "email"
          ? "sent to the therapist by email, only after the person approves and sends each one"
          : "kept for the person to download and bring",
      goals: openNotes(notes, "goal"),
      themes: openNotes(notes, "theme"),
      tasks: openNotes(notes, "task"),
      toBringUp: openNotes(notes, "to_bring"),
      lastSessionNotes: notes
        .filter((note) => note.kind === "session")
        .slice(0, LIMITS.sessionNotes)
        .map((note) => ({ id: note.id, sessionOn: note.sessionOn, body: note.body })),
    };
  },
});

function reportLink(report: Report, appUrl: URL) {
  return new URL(`/reports/${report.id}`, appUrl).toString();
}

const prepareReport = define({
  name: "prepare_report",
  title: "Get ready for the next session",
  description:
    "The material of the person's next report: the period it covers, its numbers (averages of mood, energy, anxiety and sleep), its entries in the person's words, the check-in notes, and what they want to bring up. Use it to help them prepare for the session. It changes nothing and never sends anything: the person reads, approves and sends the report in the sintr app.",
  needs: { all: ["reports:read", "entries:read", "checkins:read"] },
  readOnly: true,
  input: z.object({}),
  async run(_input, { scope, scopes, appUrl, now }) {
    const at = now();
    const [settings, profile, known] = await Promise.all([
      scope.therapySettings.get(),
      scope.profile.get(),
      scope.reports.recent(),
    ]);
    const timeZone = profile.timezone;
    const plan = planReportNow({ schedule: settings, timeZone, reports: known, now: at });
    let report: Report | null = null;
    let period: ReportPeriod;
    if (plan.action === "open") {
      report = await scope.reports.get(plan.reportId);
      const summary = known.find((item) => item.id === plan.reportId);
      if (!report || !summary) throw new NotFoundError("report");
      // A draft is prepared again up to now when the person opens it; a final one keeps its days.
      period =
        report.status === "draft" ? periodAgain(summary, settings, timeZone, at) : periodOf(report, timeZone);
    } else {
      period = plan.period;
    }
    const [digest, notes] = await Promise.all([
      collectDigest(scope, period, timeZone),
      scopes.has("therapy:read") ? scope.therapyNotes.list() : Promise.resolve([]),
    ]);
    const measure = (key: "mood" | "energy" | "anxiety" | "sleepHours") => ({
      average: rounded(digest.measures[key].average),
      days: digest.measures[key].days,
      weekBefore: rounded(digest.measures[key].previous),
    });
    return {
      sendsNothing:
        "Nothing is sent from here. The person reads, changes, approves and sends the report in the sintr app.",
      period: {
        kind: period.kind,
        from: moment(period.start, timeZone),
        to: moment(period.end, timeZone),
        session: period.session ? moment(period.session, timeZone) : null,
      },
      report: report
        ? { id: report.id, status: report.status, link: reportLink(report, appUrl) }
        : {
            status: "not prepared yet",
            note: "sintr prepares it before the session; the person can also prepare it now in the app, under Reports.",
          },
      numbers: {
        mood: measure("mood"),
        energy: measure("energy"),
        anxiety: measure("anxiety"),
        sleepHours: measure("sleepHours"),
        scales: "mood, energy and anxiety from 0 to 5; sleep in hours",
        counts: digest.counts,
      },
      days: digest.days.map((day) => ({
        day: day.day,
        weekday: WEEKDAYS[day.weekday],
        mood: rounded(day.mood),
        energy: rounded(day.energy),
        anxiety: rounded(day.anxiety),
        sleepHours: rounded(day.sleepHours),
        entries: day.entries,
      })),
      entries: digest.entries.slice(0, LIMITS.reportEntries).map((entry) => ({
        ...entry,
        link: new URL(`/entries/${entry.id}`, appUrl).toString(),
      })),
      moreEntries: Math.max(0, digest.entries.length - LIMITS.reportEntries),
      checkinNotes: digest.notes,
      emotions: digest.emotions
        .slice(0, LIMITS.reportFrequencies)
        .map((e) => ({ ...e, average: rounded(e.average) })),
      tags: digest.tags.slice(0, LIMITS.reportFrequencies),
      ...(scopes.has("therapy:read")
        ? { toBringUp: openNotes(notes, "to_bring"), tasks: openNotes(notes, "task") }
        : {}),
      howToUseIt:
        "Help the person see their period and choose what to bring to the session. Quote their words exactly as recorded. Describe; never diagnose, label or explain causes. Label patterns as observations for the session.",
    };
  },
});

export const TOOLS: readonly SintrTool[] = [
  recentContext,
  readEntry,
  saveEntry,
  saveCheckin,
  therapyOverview,
  prepareReport,
];

export function findTool(name: string): SintrTool | undefined {
  return TOOLS.find((tool) => tool.name === name);
}
