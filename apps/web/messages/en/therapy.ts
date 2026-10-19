/** Therapy: who the therapist is, when the sessions are, what happens to the report. Said as sentences first. */
const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

/** "Tuesday and Thursday", "Monday, Wednesday and Friday". */
function andList(items: readonly string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

const on = (days: readonly number[]) => andList(days.map((day) => DAY[day] ?? ""));

export const therapy = {
  title: "Your therapy",
  lede: "Who your therapist is, when you see them, and what happens to the report prepared before each session.",
  /** Under the heading: when the next report is prepared. Parts, so the first moment can stand out. */
  next: (prepared: string, session: string) =>
    ["The next report will be prepared on ", prepared, `, for the session of ${session}.`] as const,
  noNext:
    "Without a session in your calendar, no report is prepared on its own. You can still prepare one from Reports whenever you want.",
  change: "Change",
  /**
   * The calendar of sessions (F11): each session a day and a time, alone or
   * in a rhythm, and any session of a rhythm moved or cancelled on its own.
   * Days are numbers (0 is Sunday) and dates come already written in the
   * page's language, so each language writes its own grammar around them.
   */
  calendar: {
    title: "Your sessions",
    /** Each rhythm (or single session still to come) as a sentence of its own. */
    summary: (rhythms: readonly string[]) =>
      rhythms.length === 0 ? "None in your calendar yet." : rhythms.map((rhythm) => `${rhythm}.`).join(" "),
    rhythm: {
      weekly: (day: number, time: string) => `Every week on ${DAY[day]} at ${time}`,
      fortnightly: (day: number, time: string) => `Every two weeks on ${DAY[day]} at ${time}`,
      every_15_days: (time: string) => `Every 15 days at ${time}`,
      weekdays: (days: readonly number[], time: string) => `Every week on ${on(days)} at ${time}`,
      once: (date: string, time: string) => `Once, on ${date} at ${time}`,
    },
    /** Under a session in a list: what it is part of, or what happened to it. */
    caption: {
      weekly: "Every week",
      fortnightly: "Every two weeks",
      every_15_days: "Every 15 days",
      weekdays: (days: readonly number[]) => `Every week on ${on(days)}`,
      once: "Does not repeat",
      moved: (from: string) => `Moved from ${from}`,
      cancelled: "Cancelled",
      passed: "Passed",
      next: "Next session",
    },
    add: "Add a session",
    addOn: (day: string) => `Add a session on ${day}`,
    comingUp: "Coming up",
    noneComing: "Nothing coming up. Add a session, and the report is prepared before it.",
    month: {
      grid: (month: string) => `Your sessions in ${month}`,
      previous: "Previous month",
      next: "Next month",
      today: "Today",
    },
    day: {
      empty: "No session on this day.",
      sessions: (count: number) => (count === 1 ? "1 session" : `${count} sessions`),
    },
    zone: (zone: string) => `Times are in ${zone} time.`,
    changeZone: "Change the time zone",
    zoneLabel: "Your time zone",
    zoneHint:
      "Every session keeps its day and time, read in this zone, and so does the hour each report is prepared.",
    saveZone: "Save the time zone",
    /** One session, opened from the calendar or the list. */
    session: {
      report: (moment: string) => `Its report is prepared on ${moment}.`,
      movedFrom: (from: string) => `Moved from ${from}. The rest of the rhythm is where it was.`,
      cancelled: "Cancelled. The rest of the rhythm goes on.",
      passed: "This session has passed.",
      change: "Change",
      cancel: "Cancel this session",
      putBack: (where: string) => `Put it back on ${where}`,
      close: "Close",
    },
    /** Adding a session, or changing one. */
    form: {
      addTitle: "Add a session",
      changeTitle: "Change this session",
      day: "Day",
      time: "Time",
      repeat: "Repeats",
      repeats: {
        once: "Does not repeat",
        weekly: (day: number) => `Every week on ${DAY[day]}`,
        fortnightly: (day: number) => `Every two weeks on ${DAY[day]}`,
        every_15_days: "Every 15 days",
        weekdays: "On days of the week I choose",
      },
      weekdays: "On these days",
      /** The short names of the days, Sunday first, for the day chips. */
      short: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      days: DAY,
      which: "Which sessions",
      onlyThis: "Only this one",
      onlyThisHint: "Every other session of the rhythm stays where it is.",
      fromThis: "This one and the ones after it",
      fromThisHint: "The rhythm changes from here. The sessions before it stay as they were.",
      onlyThisRhythm: "A new rhythm changes the sessions after this one too.",
      add: "Add the session",
      save: "Save",
      back: "Back",
    },
    /** Cancelling: one session, or a rhythm from one session on. */
    cancel: {
      title: "Cancel this session",
      onlyThis: "Only this one",
      onlyThisHint: "The rest of the rhythm goes on.",
      fromThis: "This one and every one after it",
      fromThisHint: "The rhythm stops here. The sessions before it stay as they were.",
      once: "It is taken out of your calendar.",
      confirm: "Cancel the session",
      keep: "Keep it",
    },
    /** Said once a change is kept, so the person knows exactly what moved. */
    done: {
      added: "Added to your calendar.",
      moved: "Moved. Only that session changed: the rest of the rhythm is where it was.",
      changed: "Changed from that session on. The sessions before it stay as they were.",
      cancelled: "Cancelled. Only that session: the rest of the rhythm goes on.",
      stopped: "The rhythm stops there. The sessions before it stay as they were.",
      removed: "Taken out of your calendar.",
      restored: "Put back where the rhythm has it.",
      zone: "Time zone saved.",
    },
    problems: {
      day: "Choose a day.",
      time: "Write the time as hours and minutes, such as 18:00.",
      repeat: "Choose how it repeats.",
      weekdays: "Choose at least one day of the week.",
      gone: "That session is no longer in your calendar. Here it is as it is now.",
      passed: "That session has passed, so it stays as it was.",
      timezone: "Choose a time zone from the list.",
      form: "That could not be kept just now. Try again in a moment.",
    },
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
  /** What is not saved yet, as the question before leaving names it inside `shell.unsaved.changes`. */
  unsaved: {
    therapist: "your therapist's details",
    report: "the report",
    timezone: "the time zone",
  },
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
    language: "Choose the report's language.",
    lead: "Choose when to prepare the report.",
    therapistEmail: "Check the address: one email, such as name@example.com.",
    delivery: "Choose what happens to the report.",
    sendNeedsEmail: "To send the report, sintr needs your therapist's email.",
    form: "Some of it could not be kept as it is. Check the fields.",
  },
} as const;
