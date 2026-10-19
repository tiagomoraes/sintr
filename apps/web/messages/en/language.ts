/** The language sintr speaks: the person's choice, said in Settings and offered quietly elsewhere. */
export const language = {
  /** Offered on a page in another language, in this one's own words, for whoever reads it. */
  offer: "Read sintr in English",
  /** Said around the offers, in the page's language: what the buttons are. */
  offers: "Other languages",
  title: "Your language",
  /** `name` is the language's name in this one, such as "Portuguese". */
  summary: {
    person: (name: string) => `sintr speaks ${name} with you, as you chose.`,
    installation: (name: string) => `sintr speaks ${name} with you, as this sintr is set up to.`,
    browser: (name: string) => `sintr speaks ${name} with you, as your browser asks.`,
    default: (name: string) => `sintr speaks ${name} with you.`,
  },
  body: "The screens, the help lines and the emails sintr sends you follow it. The assistant answers in the language you write in, and your own words stay exactly as you wrote them.",
  label: "Language",
  automatic: "Let sintr choose",
  automaticHint: "Then it follows how this sintr is set up, and otherwise your browser.",
  save: "Save",
} as const;
