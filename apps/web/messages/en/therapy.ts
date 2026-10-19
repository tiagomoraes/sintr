/** Therapy: who the therapist is, when the sessions are, what happens to the report. Said as sentences first. */
const DAYS = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"] as const;

export const therapy = {
  title: "Your therapy",
  lede: "Who your therapist is, when you see them, and what happens to the report prepared before each session.",
  /** Under the heading: when the next report is prepared. Parts, so the first moment can stand out. */
  next: (prepared: string, session: string) =>
    ["The next report will be prepared on ", prepared, `, for the session of ${session}.`] as const,
  noNext:
    "Without a session day and time, no report is prepared on its own. You can still prepare one from Reports whenever you want.",
  change: "Change",
  sessions: {
    title: "Your sessions",
    summary: (day: number | null, time: string | null, zone: string) =>
      day !== null && time ? `${DAYS[day]} at ${time}, in ${zone} time.` : "No fixed day yet.",
    day: "Day",
    noDay: "No fixed day",
    days: DAYS,
    short: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    time: "Time",
    zone: "Your time zone",
    zoneHint: "The day and time of your sessions are read in it.",
  },
  therapist: {
    title: "Your therapist",
    summary: (name: string | null, email: string | null, sends: boolean) =>
      [
        name ? (email ? `${name}, at ${email}.` : `${name}.`) : "Not named yet.",
        sends ? "Reports go to them only when you say so." : "Reports stay with you, to download and bring.",
      ].join(" "),
    name: "Name",
    email: "Email",
    emailHint: "Kept encrypted, like your diary. Used only to send a report you approved.",
    delivery: "What happens to the report",
    send: "Send it to my therapist",
    keep: "Keep it for me",
    sendHint: "When you approve a report, you can send its PDF to this address. Each send asks for your yes.",
    sendOff: "Email is not set up on this sintr yet, so you can download the PDF and share it yourself.",
    keepHint: "The PDF stays with you: download it to bring to the session or share it your way.",
  },
  report: {
    title: "The report before each session",
    /** `lead` is one of `leads` below, as offered. */
    summary: (lead: string, language: string, name: string | null) =>
      `Prepared ${lead.toLowerCase()} each session, in ${language}${name ? `, with your name, ${name}` : ""}.`,
    lead: "When to prepare it",
    /** How long before the session it is prepared, by minutes (the choices in lib/therapy.ts). */
    leads: {
      30: "30 minutes before",
      60: "1 hour before",
      120: "2 hours before",
      180: "3 hours before",
      360: "6 hours before",
      720: "12 hours before",
      1440: "A day before",
      2880: "Two days before",
    },
    leadHint: "It covers the days since the last report, up to that moment, so it is fresh for the session.",
    language: "The report's language",
    /** The first choice: the report follows the language the person reads sintr in, named. */
    languageFollow: (name: string) => `The language you read sintr in (${name})`,
    languageHint:
      "Headings and the assistant's words follow it. Your own words stay exactly as you wrote them.",
    name: "Your name, as the report shows it",
    nameHint: "Optional. Without it the report says “the week, in their own words”.",
    notice: "Email me when a report is ready to read",
    noticeOff: "Email is not set up on this sintr. You will see the report here when it is ready.",
    noticeOn: "A link only, never the report's words.",
    noticeVerify: "A link only, never the report's words. Confirm your email in Settings first.",
  },
  approval:
    "Every report waits for your approval. Nothing is sent to anyone without your yes for that report, and this cannot be turned off.",
  save: "Save",
  saved: "Saved.",
  /** What the person and their therapist keep in view between sessions, listed under the form. */
  notes: {
    title: "Goals, themes and things to bring up",
    kinds: {
      session: "Session note",
      goal: "Goal",
      theme: "Theme",
      task: "Task",
      to_bring: "To bring up",
    },
  },
  /** Said by the form when something it was given cannot be kept. */
  problems: {
    timezone: "Choose a time zone from the list.",
    language: "Choose the report's language.",
    sessionDay: "Choose a day of the week.",
    sessionTime: "Write the time as hours and minutes, such as 18:00.",
    dayAndTime: "Give both the day and the time of your sessions, or neither.",
    lead: "Choose when to prepare the report.",
    therapistEmail: "Check the address: one email, such as name@example.com.",
    delivery: "Choose what happens to the report.",
    sendNeedsEmail: "To send the report, sintr needs your therapist's email.",
    form: "Some of it could not be kept as it is. Check the fields.",
  },
} as const;
