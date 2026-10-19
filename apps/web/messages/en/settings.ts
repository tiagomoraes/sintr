/** Settings, in the narrative voice: who answers you, how sintr reaches you, and your time. */
export const settings = {
  title: "Settings",
  lede: "Who answers you, how sintr reaches you, and your time.",
  assistant: {
    title: "Your assistant",
    included: (name: string) =>
      `The assistant is included. It runs on a model from ${name}, through sintr's own account: what you write in a conversation is sent there to be answered, and nowhere else. You do not need a key.`,
    plan: (label: string) => `You are on ${label}`,
    planNoLimit: ", with no monthly limit.",
    planUsed: (used: number, limit: string) => `: ${used} of ${limit} used this month.`,
    planLink: "Your plan",
    door: "Use your own key instead",
    doorBody:
      "Bring a key from a provider you choose, or a model on your own machine. Your conversations and reports then go to that provider, under your own agreement with it, and they do not count toward your plan: it is free here, and the provider bills you.",
    own: (provider: string, model: string, house: boolean) =>
      `You are using your own key, with ${provider} (${model}). What you write in a conversation goes to that provider, under your agreement with it${house ? ", and it does not count toward any plan." : ", and nowhere else."}`,
    back: "Go back to the included assistant",
    backNote: "Your key is removed from sintr.",
    ownDoor: "Your own key",
    none: "This sintr has no assistant of its own, so it talks to a model you choose, with your own key. What you write in a conversation is sent to that provider, and nowhere else.",
    keyNote:
      "The key is encrypted with your own data key before it is stored, is never shown again, and is used only to reach that provider.",
  },
  /** Speaking, said in Settings next to who answers. */
  voice: {
    ready: (who: string) =>
      `When you speak instead of typing, ${who} writes down what you said, and the recording is dropped once it has: sintr never keeps it. You read the words before they are sent.`,
  },
  others: {
    title: "Your other assistants",
    body: "ChatGPT, Claude, Gemini or Hermes can keep entries here for you, each with its own key.",
    more: "Connect another",
    first: "Connect one",
    none: "No assistant is connected.",
  },
  email: { title: "Your email" },
  practice: {
    titleOwn: "Your practice",
    titleNew: "Are you a therapist?",
    own: (name: string) => `Your practice, ${name}, receives the reports your patients share with you.`,
    ownLink: "Open the dashboard",
    open: "Open a practice on this account to receive the reports your patients choose to share with you. Your own diary stays as it is.",
    openLink: "Open a practice",
  },
  time: { title: "Your time and your conversations" },
} as const;
