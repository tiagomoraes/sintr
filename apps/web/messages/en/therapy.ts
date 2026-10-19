/** Therapy: who the therapist is, when the sessions are, what happens to the report. Said as sentences first. */
const DAYS = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"] as const;

export const therapy = {
  title: "Your therapy",
  lede: "Who your therapist is, when you see them, and what happens to the report prepared before each session.",
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
    moved: "Has a session moved?",
    movedHint:
      "Give its new date and time. It takes the place of the regular session nearest to it, just once, and the report is prepared for it instead.",
    movedBack: "The session is back to its usual day",
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
    summary: (lead: string, language: string, name: string | null) =>
      `Prepared ${lead.toLowerCase()} each session, in ${language}${name ? `, with your name, ${name}` : ""}.`,
    lead: "When to prepare it",
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
} as const;
