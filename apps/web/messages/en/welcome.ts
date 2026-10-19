/** The welcome after signing up: one question a screen, every one of them able to wait. */
export const welcome = {
  title: "Welcome",
  back: "Back",
  skip: "Skip",
  next: "Continue",
  progress: (step: number, of: number) => `Step ${step} of ${of}`,
  start: {
    heading: "This is your diary for the week between sessions.",
    body: "When something happens, tell it here, by voice or in writing. sintr keeps it in your own words, and before each session your week is waiting on one page, for you to read first and share only if you choose to.",
    promise: "Three short questions and you are set. Any of them can wait.",
    begin: "Begin",
    later: "Not now, take me to my diary",
  },
  name: {
    heading: "What should I call you?",
    body: "Only to greet you here. It is never sent to the assistant and never printed on a report.",
    label: "Your name, or what you like to be called",
    placeholder: "Your name",
    tooLong: "Use at most 80 characters.",
  },
  invite: {
    heading: (who: string) => `${who} invited you to share your reports.`,
    body: "You can link with them now, as part of setting up, or later from Sharing.",
    accept: "Accept and link",
    accepting: "Linking",
    later: "Not now",
    linked: (who: string) => `You are linked with ${who}. They see only the reports you approve and share.`,
    problems: {
      busy: "Too many tries from here. Wait a few minutes, then try again.",
      consent: "Tick the box to give your consent, or leave it for now.",
      changed:
        "The practice changed its name or details since this page opened. Reload the page and read them again.",
      gone: "This invite does not work any more: it may have expired, been cancelled or been used. You can ask for a new one later.",
      tooLong: "Use at most 80 characters for your name.",
      noSeat: "This practice has no free seat right now. Let your therapist know; nothing was shared.",
      own: "This is your own practice's invite.",
    },
  },
  therapist: {
    heading: "Who is your therapist?",
    body: "Just their name, so your reports know who they are for. Nothing goes to them without your yes for that report.",
    label: "Your therapist's name",
    placeholder: "Their name",
    none: "I do not have one right now",
    tooLong: "Use at most 200 characters.",
  },
  session: {
    heading: (therapist: string | null) =>
      therapist ? `When do you see ${therapist}?` : "When are your sessions?",
    body: "An hour before each session, your report is prepared for you to read first.",
    day: "Day",
    time: "Time",
    zone: (zone: string) => `In ${zone} time.`,
    changeZone: "Change",
    zoneLabel: "Your time zone",
    varies: "It changes from week to week",
    needBoth: "Choose the day and the time, or let it wait.",
    badTime: "Write the time as hours and minutes, such as 18:00.",
    days: ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"],
    short: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  },
  ready: {
    heading: (name: string | null) => (name ? `You are set, ${name}.` : "You are set."),
    sessions: (day: string, time: string) =>
      `Your sessions are on ${day} at ${time}. An hour before each one, your week will be waiting on one page.`,
    noSessions:
      "Whenever you want your week on one page, you can prepare it from Reports. If you tell Therapy when your sessions are, it is prepared before each one.",
    therapist: (who: string) => `Your reports are for ${who}, and go to them only when you say so.`,
    next: "Whenever something happens, tell me, by voice or in writing.",
    go: "Go to my diary",
  },
  problem: "That could not be saved just now. Try again in a moment.",
  /** Run again from Settings: the answers already given are filled in, and skipping keeps them. */
  again: {
    heading: "Here is the welcome again.",
    body: "What you told me before is already filled in. Change what you like and skip the rest: skipping keeps your answer as it is, and nothing you have written is erased.",
    later: "Not now, back to Settings",
  },
} as const;
