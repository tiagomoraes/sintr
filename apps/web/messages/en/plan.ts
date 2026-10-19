/**
 * The plan screen: what the included assistant means for this month, this
 * month's use, subscribing, a practice's seats; and the limit's words in a
 * conversation. Numbers are said as sentences, never as a score.
 */
export const plan = {
  title: "Your plan",
  lede: "Your diary is the same on every plan: your entries, check-ins and reports never depend on it. A plan is only about how much of the assistant you can use.",
  /** The person plans by id: the core's labels are identifiers, these are what the person reads. */
  names: { free: "Free", personal: "Personal", unlimited: "Unlimited" },
  /** Back from Stripe's Checkout. */
  subscribed:
    "Thank you. Your plan changes as soon as Stripe confirms the payment, usually within a minute; this page shows it once it has.",
  unavailable: "The payment page could not be opened just now. Nothing was charged; try again in a moment.",
  /** `name` is one of `names`. */
  on: (name: string) => `You are on ${name}.`,
  /** What a plan gives each month, in one sentence; `allowanceLine` puts it together. */
  allowance: {
    unlimited: "The assistant, with no monthly limit.",
    messages: (n: number | null) =>
      n === null
        ? "messages with the assistant without a limit"
        : `${n} ${n === 1 ? "message" : "messages"} with the assistant`,
    reports: (n: number | null) =>
      n === null
        ? "reports written by it without a limit"
        : `${n} ${n === 1 ? "report" : "reports"} written by it`,
    /** The two parts above; the sentence's first letter is made a capital where it starts one. */
    both: (messages: string, reports: string) => `${messages} and ${reports}, each month.`,
  },
  /** Where a plan came from, when it is not simply the one everyone starts on. */
  source: {
    grant: "Given to you by whoever runs this sintr.",
    practice: "Included with your practice's plan.",
  },
  /** Where a paid subscription stands. `end` is a day ("3 October 2026"), or null when Stripe gave none. */
  subscription: {
    /** `after` is `afterPlan(name)`, or `practice.after`. */
    ends: (end: string | null, after: string) =>
      `It ends${end ? ` on ${end}` : " at the end of this period"}. After that you are on ${after}, and your diary stays as it is.`,
    /** The plan a person goes back to, as `ends` says it. */
    afterPlan: (name: string) => name,
    paid: (end: string | null) => `Paid through Stripe${end ? `, renewing on ${end}` : ""}.`,
    pastDue:
      "The last payment did not go through. The plan stays while Stripe tries again; you can change the card on Stripe's page.",
    ended: "Your last subscription has ended.",
    manage: "Manage the subscription",
    receipts: "Your payments and receipts",
  },
  month: "This month",
  meters: {
    messages: "Messages with the assistant",
    reports: "Reports written by the assistant",
  },
  speaking: "Minutes of speaking written down",
  /** A meter's amount, beside its name. */
  meter: {
    soFar: (used: number) => `${used} so far`,
    of: (used: number, limit: number) => `${used} of ${limit}`,
  },
  /** `next` is a day without a year ("1 November"), when the count starts again. */
  startsAgain: (next: string) => `The count starts again on ${next}.`,
  runOut: (next: string) =>
    `When they run out, nothing is lost. You can still write on your home, and what you write is kept as a draft entry in your own words; check-ins and your report keep working, prepared from what you wrote. The count starts again on ${next}.`,
  own: {
    title: "You use your own key.",
    body: "Nothing is counted here, and your provider bills you directly.",
    back: "You can go back to the included assistant in",
    backLink: "Settings",
    backAfter: "whenever you want.",
  },
  /** An installation without an assistant of its own. */
  none: {
    title: "There is no plan to choose here.",
    body: "This sintr has no assistant of its own, so nothing is counted: you bring your own key, and your provider bills you directly.",
  },
  ownKey: "Use your own key",
  /** On the Free plan: what more there is. */
  more: {
    title: "More of the assistant",
    /** `name` is the plan's, `allowance` what it gives (lowercase first), `price` from `price` below. */
    personal: (name: string, allowance: string, price: string | null) =>
      `${name}: ${allowance}${price ? ` It costs ${price}.` : ""}`,
    practice: "As a therapist, the Practice plan below includes it for your own diary.",
    subscribe: (name: string) => `Subscribe to ${name}`,
    stripe:
      "You pay on Stripe's page and can cancel there at any time. Your diary stays as it is either way.",
    closed: "Subscriptions are not open on this sintr. Whoever runs it can give you a plan.",
    ownKey: "Or use your own key: free here, and your provider bills you.",
  },
  /** A therapist's practice and its seats. */
  practice: {
    title: "Your practice",
    /** `plan` is the practice's plan as this sintr names it, `seats` one of the two below. */
    summary: (plan: string, seats: string) =>
      `${plan}: ${seats}. Each seat is one patient linked to your practice, or an invite waiting for an answer.`,
    unlimited: (linked: number) =>
      `unlimited seats, ${linked} ${linked === 1 ? "patient" : "patients"} linked`,
    limited: (seats: number, inUse: number) => `${seats} ${seats === 1 ? "seat" : "seats"}, ${inUse} in use`,
    /** What a practice goes back to when its subscription ends, as `subscription.ends` says it. */
    after: "the defaults of this sintr",
    inUse: "Seats in use",
    offer: (price: string | null) =>
      `The Practice plan: the seats you choose${price ? `, at ${price} each` : ""}, and the assistant included for your own diary, as on Personal.`,
    seats: "Seats",
    subscribe: "Subscribe",
    range: (max: number) => `Choose between 1 and ${max} seats.`,
    grant: "Granted for your practice by whoever runs this sintr.",
    config: "Set by this sintr's configuration; whoever runs it can change them.",
    patients:
      "Your patients' plans are their own. Sharing with you never changes them, so stopping costs them nothing.",
  },
  /** A price as Stripe sets it: `money` written by Intl, every `count` `interval`s. */
  price: (money: string, interval: "day" | "week" | "month" | "year", count: number) =>
    count === 1 ? `${money} a ${interval}` : `${money} every ${count} ${interval}s`,
  /** In a conversation on the house assistant. `next` is a day without a year ("1 November"). */
  notes: {
    /** The notice above the composer once the month's messages are used. */
    used: "This month's messages with the assistant are used.",
    stillWrite: (next: string) =>
      `You can still write here: what you send is kept as a draft entry, in your own words, for you to confirm. Check-ins and your report keep working. The assistant answers again on ${next}.`,
    seePlan: "See your plan",
    /** The quiet line under the composer. */
    answersAgain: (next: string) =>
      `The assistant answers again on ${next}; until then, what you send is kept as a draft entry.`,
    left: (n: number, next: string) =>
      `${n} ${n === 1 ? "message" : "messages"} with the assistant left this month, until ${next}.`,
    yourPlan: "Your plan",
    included: "The assistant is included in your",
    includedLink: "plan",
    includedAfter: ".",
  },
  /** What sintr says, in place of the assistant, when the month's messages are used. */
  reply: {
    saved: (kind: "entry" | "checkin") =>
      `Saved: your ${kind === "entry" ? "entry" : "check-in"} is in your diary. This month's messages with the assistant are used, so I cannot say more than that.`,
    kept: "This month's messages with the assistant are used, so I cannot answer this one. Your words are kept: they are in the draft below, as an entry in your own words. Confirm it to save it, or change it first.",
    waiting:
      "This month's messages with the assistant are used, so I cannot answer this one. Your message is kept in this conversation.",
  },
} as const;
