/** The quick check-in, as a few taps. */
export const checkin = {
  title: "A quick check-in.",
  lede: "Only what you want to give. Each question can be skipped, and nothing here is a score.",
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
} as const;
