/** The assistant everywhere: the corner of every page, and the conversation it opens beside the page. */
export const assistant = {
  /** The corner's button, and the open conversation's name for a screen reader. */
  open: "Talk to sintr",
  /** The corner's name while the assistant is doing something: "Talk to sintr. A draft is waiting for you". */
  openWhile: (state: string) => `Talk to sintr. ${state}`,
  /** Beside the corner while a pointer or the keyboard rests on it. */
  hint: "Speak or write, without leaving this page",
  close: "Close",
  /** Under "Tell me what happened." in the conversation opened beside a page. */
  lede: "Speak or write, right here. I will ask a question or two and draft an entry for you to check. Nothing is kept until you confirm it.",
  ledeWriteOnly:
    "Write it here, as much or as little as you want. I will ask a question or two and draft an entry for you to check. Nothing is kept until you confirm it.",
} as const;
