/** Words more than one screen uses: page titles, errors, buttons that ask twice. */
export const common = {
  description: "A private mood diary for the week between therapy sessions.",
  /** A page that failed on the server. No detail: messages are for logs. */
  error: {
    heading: "This page could not open.",
    body: "Something went wrong on our side. Try again in a moment.",
    retry: "Try again",
  },
  notFound: {
    heading: "There is nothing on this page.",
    /** The sentence is split around the link: before, link, after. */
    body: "The address may be mistyped, or the page has moved.",
    link: "Go back to the start",
    after: ".",
  },
  /** The second step of a decision that cannot be taken back: changing your mind. */
  keep: "Keep it",
  /** The public front page, for someone who has never seen sintr. */
  landing: {
    open: "Open your diary",
    signIn: "Sign in",
    create: "Create your diary",
    heading: "The week between sessions, kept in your own words.",
    lede: "sintr is a private mood diary. Write down what happened, what went through your mind and how strong it felt. Before each therapy session your week is waiting on one page, for you to read first and to share only if you choose to.",
    already: "I already have one",
    promise:
      "Everything you write is encrypted for you before it is stored. Nothing leaves without your approval of that specific report.",
    /** One heading in two lines. */
    record: "sintr keeps the record.",
    therapy: "Your therapist does the therapy.",
    limits:
      "It is not therapy, a diagnosis or an emergency service. It will not label you or tell you what to do. It keeps your words exactly as you wrote them.",
  },
} as const;
