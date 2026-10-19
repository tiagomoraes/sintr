/** The diary's frame: the sections, the menu on a phone, and the light. */
export const shell = {
  nav: {
    label: "Your diary",
    practiceLabel: "Your practice",
    something: ", something new",
    home: "Home",
    entries: "Entries",
    checkins: "Check-ins",
    therapy: "Therapy",
    reports: "Reports",
    sharing: "Sharing",
    connect: "Other assistants",
    settings: "Settings",
    plan: "Plan",
    practice: "Practice",
    dashboard: "Dashboard",
  },
  /** One line under each section in the phone's menu: what is there, in plain words. */
  about: {
    home: "Say what happened, by voice or in writing.",
    entries: "The moments you kept, in your words.",
    checkins: "A line about the day: mood, energy, sleep.",
    therapy: "Your therapist, and when your sessions are.",
    reports: "Your week on one page, before each session.",
    sharing: "Let your therapist read the reports you approve.",
    connect: "Keep your diary from ChatGPT, Claude or Gemini.",
    settings: "The assistant, your email, your time zone.",
    plan: "How much of the assistant you have this month.",
    practice: "The reports your patients share with you.",
  },
  menu: { open: "Menu", close: "Close", title: "Your diary" },
  /** The crisis lines in one line (the full block is in every page's footer). */
  strip: {
    before: "If you are in danger or thinking about harming yourself, call",
    or: "or",
    after: "sintr is a diary, not a crisis service.",
    callCvv: "Call CVV, 188",
    callSamu: "Call SAMU, 192",
  },
  signOut: "Sign out",
  /** A screen reader's name for the wordmark, which leads home. */
  homeLink: "sintr, home",
  skip: "Skip to content",
  /** One quiet line at the top of the diary's pages, with a link to where it leads. */
  notice: {
    openSharing: "Open Sharing",
    /** `when` is the session's day and time, as the page's language writes a date. */
    reportReady: (when: string) => `Your report for the session of ${when} is ready to read.`,
    weeklyReady: "Your weekly report is ready to read.",
    readIt: "Read it",
  },
  /** Asked before leaving a page with changes that are not saved. */
  unsaved: {
    /** `what` names them, as the page's language joins a list ("the time zone and the assistant"). */
    changes: (what: string) => `Your changes to ${what} are not saved yet, and leaving now would lose them.`,
    stay: "Stay on this page",
    leave: "Leave without saving",
  },
  /** Under a practice's pages, where a person's pages have the help lines. */
  practiceNote:
    "Reports arrive when a person approves and shares them, never in real time, and sintr does not watch over them: it is a diary people keep for themselves, not a clinical record, a monitoring tool or a crisis service. If something in a report worries you, reach the person the way you usually do.",
} as const;
