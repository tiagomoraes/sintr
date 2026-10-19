/** The home: the first screen, which is the input. */

const PARTS = { morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening" } as const;

export const home = {
  title: "Tell me what happened.",
  greeting: (part: keyof typeof PARTS, name: string | null) =>
    name ? `${PARTS[part]}, ${name}.` : `${PARTS[part]}.`,
  lede: "Speak or write, as much or as little as you want. I will listen, ask a question or two, and draft an entry for you to check. Nothing is kept until you confirm it.",
  ledeWriteOnly:
    "In your own words, as much or as little as you want. I will listen, ask a question or two, and draft an entry for you to check. Nothing is kept until you confirm it.",
  ledeAtLimit:
    "In your own words, as much or as little as you want. Nothing is kept as an entry until you confirm it.",
  placeholder: { first: "What happened?", next: "Write here", atLimit: "Write what happened" },
  messageLabel: "Your message",
  send: "Send",
  keys: "Enter sends. Shift and Enter for a new line.",
  /** Quiet doors under the input: everything else is one tap away. */
  doors: {
    label: "Or",
    checkin: "a quick check-in",
    report: "this week's report",
    entries: "what you kept",
    between: ", ",
    last: ", or ",
    after: ".",
  },
  unfinished: "You stopped partway through setting up.",
  unfinishedLink: "Pick it up where you left off",
  earlier: "Earlier conversations",
  untitled: "A conversation",
  started: (when: string) => `Started ${when}`,
  newConversation: "New conversation",
  deleteTitle: "Delete this conversation",
  deleteBody:
    "This removes its messages and any draft you did not save, for good. Entries and check-ins you saved from it stay in your diary.",
  deleteIt: "Delete it",
  /** What the pool of light is doing, said for screen readers. */
  status: {
    resting: "",
    listening: "Listening",
    transcribing: "Writing down what you said",
    thinking: "sintr is thinking",
    proposing: "A draft is waiting for you",
    paused: "The diary is paused",
  },
  you: "You: ",
  them: "sintr: ",
  writing: "sintr is writing",
  log: "Conversation",
  paused: "The diary is paused here.",
  pausedLink: "Start a new conversation",
  pausedAfter: "whenever you are ready.",
  noAssistant: "This sintr has no assistant of its own. Use your own key in",
  noAssistantLink: "Settings",
  noAssistantAfter: "to continue this conversation.",
  tryAgain: "Try again",
  checkSettings: "Check the assistant in Settings",
  heardRisk:
    "If you are in danger, please call someone now. Your words are in the box below, and nothing is sent until you choose to.",
  rehearsal:
    "Rehearsal mode: replies and transcripts come from a scripted, offline assistant (SINTR_FAKE_AGENT). Nothing is sent to a provider.",
} as const;
