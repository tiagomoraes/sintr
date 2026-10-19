/**
 * A check-in: the quick one as a few taps, the list, one check-in, the form
 * that changes it, and the draft the assistant proposes. Its dated changes
 * and the draft card's own words are in the entry's file.
 */
export const checkin = {
  title: "A quick check-in.",
  lede: "Only what you want to give. Each question can be skipped, and nothing here is a score.",
  /** The new check-in page's name, in the browser's tab. */
  newTitle: "New check-in",
  progress: (step: number, of: number) => `${step} of ${of}`,
  scales: {
    mood: { question: "How is your mood?", hint: "0 is the lowest, 5 the best." },
    energy: { question: "How much energy do you have?", hint: "0 is none at all, 5 plenty." },
    anxiety: { question: "How anxious do you feel?", hint: "0 is not at all, 5 the most." },
  },
  sleep: {
    question: "How did you sleep?",
    hours: "Hours of sleep",
    hoursPlaceholder: "7.5",
    quality: "How you slept",
    qualityPlaceholder: "In your words",
  },
  note: {
    question: "Anything about the day?",
    label: "Note",
    hint: "A line is plenty, or nothing at all.",
    when: "When",
    now: "Now.",
    change: "Another time",
    whenHint: "In your time zone.",
  },
  next: "Next",
  skip: "Skip",
  back: "Back",
  saveNow: "Save it now",
  save: "Save check-in",
  cancel: "Cancel",
  /** Hidden from sight once JavaScript runs: every question at once is still a form that works. */
  allAtOnce: "Every question of the check-in",
  /** The fields' names, as the form and the notebook card show them. */
  labels: {
    occurredAt: "When",
    mood: "Mood",
    energy: "Energy",
    anxiety: "Anxiety",
    sleepHours: "Sleep",
    sleepQuality: "How you slept",
    note: "Note",
  },
  /** The same fields inside a sentence: "Corrected the mood and the note." */
  inASentence: {
    occurredAt: "when it happened",
    mood: "the mood",
    energy: "the energy",
    anxiety: "the anxiety",
    sleepHours: "the hours of sleep",
    sleepQuality: "how you slept",
    note: "the note",
  },
  /** After a scale's value: "4 of 5". */
  of5: "of 5",
  /** After the hours of sleep, already written as a number: "7.5 hours". */
  hours: (count: number) => (count === 1 ? "hour" : "hours"),
  list: {
    title: "Check-ins",
    lede: "One line about the day: mood, energy, anxiety, sleep. Only what you give.",
    new: "New check-in",
    /** A page further back that holds nothing. */
    earlierNone: "Nothing earlier than this.",
    latest: "Back to the latest check-ins",
    empty: "No check-ins yet.",
    emptyHint:
      "A check-in takes a few seconds and nothing in it is required. Quiet days are fine, and nothing here is a score.",
    earlier: "Earlier check-ins",
  },
  /** One check-in, on its own page. */
  record: {
    title: "Check-in",
    all: "All check-ins",
    /** For a screen reader: the page's heading. */
    heading: (when: string) => `Check-in of ${when}`,
    tag: "Check-in",
    tagChanged: "Check-in, changed later",
    change: "Change this check-in",
  },
  edit: {
    title: "Change a check-in",
    heading: "Change this check-in",
    lede: "It will show the new values. The old ones are kept with the date of the change.",
    save: "Save the change",
  },
  /** Every question at once: the form that changes a check-in, and the draft card's. */
  form: {
    /** Where every scale starts: no value is chosen for the person. */
    notGiven: "Not given",
    hints: {
      mood: "0 is the lowest, 5 the best.",
      energy: "0 is none at all, 5 plenty.",
      anxiety: "0 is none, 5 the most.",
    },
    noteHint: "Optional. A line about the day is plenty.",
    whenHint: "In your time zone. Leave it empty for right now.",
  },
  /** The draft card in the conversation, as a check-in. */
  draft: {
    label: "Draft check-in, waiting for you",
    saved: "Saved check-in",
    /** The card's head when the draft has no time of its own. */
    head: "A check-in for today",
    edit: "Edit this check-in",
    save: "Save check-in",
    savedTo: "Saved to your check-ins.",
  },
  problems: {
    scale: "Choose a value from 0 to 5.",
    sleepHours: "Use a number of hours from 0 to 24.",
    when: "Check the date and time.",
    invalid: "Some of it could not be kept as it is. Check the fields and try again.",
    empty: "Give at least one value. Everything else can stay empty.",
    /** On the draft card, where the other way out is discarding it. */
    emptyDraft: "Give at least one value, or discard the draft.",
  },
} as const;
