/** The help lines: where to find a person right now, on every page a person might write on. */
export const crisis = {
  heading: "If you are in danger or thinking about harming yourself, please call someone now.",
  /** The lines are Brazil's; anywhere else, findahelpline.com (said under them). */
  lines: {
    cvv: { where: "Brazil", who: "CVV, Centro de Valorização da Vida", how: "Free, 24 hours" },
    samu: { where: "Brazil", who: "SAMU, medical emergencies", how: "Free, 24 hours" },
  },
  /** A screen reader's name for a line's button. */
  call: (who: string, number: string) => `Call ${who}, ${number}`,
  elsewhere: "Anywhere else, call your local emergency number or find a free, confidential line at",
  notService: "sintr is a diary: it is not therapy, a diagnosis or a crisis service.",
  /** Once the diary stops for a crisis, in that conversation. */
  panel: {
    label: "Human help, now",
    paused:
      "The diary is paused in this conversation. Nothing from it is being recorded. When you are ready to write again, you can start a new conversation.",
  },
} as const;
