/** A practice: the professional's side, its patients, its invites and the reports they share. */
export const practice = {
  title: "Your practice",
  /** Before a practice is opened: what it is, and the form that opens it. */
  open: {
    lede: "For therapists: receive the reports your patients choose to share with you, in one calm place.",
    promises: [
      "Your patients decide what you see: the reports they approve and share with you, nothing else.",
      "Each report is read as the person approved it. No scores, and nothing added up across patients.",
      "Either of you can end a link at any time, and it ends at once on both sides.",
    ],
    submit: "Open my practice",
    diary: "Your own diary stays as it is. Opening a practice adds this dashboard; nothing else changes.",
  },
  /** A patient without a chosen name, told apart by a number. */
  patient: (number: number) => `Patient ${number}`,
  aPatient: "A patient",
  /** "3 active patients. 4 of 10 seats in use, 1 of them waiting for an acceptance." */
  seats: {
    active: (count: number) => `${count} active ${count === 1 ? "patient" : "patients"}.`,
    unlimited: "Unlimited seats.",
    inUse: (used: number, seats: number, held: number) =>
      `${used} of ${seats} ${seats === 1 ? "seat" : "seats"} in use${held ? `, ${held} of them waiting for an acceptance` : ""}.`,
  },
  /** The built-in plan names; a plan granted under any other name is shown as it was given. */
  plans: { selfHosted: "Self-hosted", free: "Free", practice: "Practice" },
  /** What changed in the practice's links lately (the person's side says its own, in sharing). */
  notices: {
    active: (who: string) => `${who} linked with your practice.`,
    declined: "A person you accepted chose not to link. Nothing was shared.",
    ended: "A patient ended their link with your practice. Their reports are no longer here.",
    shared: (who: string) => `${who} shared a report with you.`,
    other: (who: string) => `${who} updated their link.`,
  },
  /** The dashboard. */
  gone: "That report is not here any more: the link it came through has ended.",
  code: { label: "A code a patient gave you", button: "Open it" },
  /** A report opened beside the list. */
  report: {
    all: "All reports",
    shared: (day: string) => `Shared with you on ${day}. This is the report exactly as they approved it.`,
    pdf: "Download the PDF",
    close: "Close it",
  },
  reports: {
    title: "Reports",
    new: "New",
    shared: (day: string) => `Shared on ${day}`,
    none: "No reports yet. When a patient approves a report and shares it with you, it appears here.",
  },
  patients: {
    title: "Patients",
    waiting: "Waiting for them to confirm.",
    since: (day: string) => `Linked since ${day}.`,
    last: (day: string) => `Last report ${day}.`,
    none: "No patients yet. Invite one, or open the code a patient gave you.",
    /** A link the person has not confirmed yet is withdrawn; an active one is disconnected. */
    withdraw: "Withdraw",
    withdrawLabel: (who: string) => `Withdraw from ${who}`,
    withdrawConfirm: "Yes, withdraw",
    withdrawExplanation: (who: string) => `The link with ${who} will not start. They are told.`,
    disconnect: "Disconnect",
    disconnectLabel: (who: string) => `Disconnect ${who}`,
    disconnectConfirm: "Yes, disconnect",
    disconnectExplanation: (who: string) =>
      `${who} stops sharing with your practice at once, and their reports leave this dashboard. They are told.`,
    keep: "Keep the link",
    ending: "Ending the link",
  },
  invites: {
    title: "Invites waiting",
    until: (day: string) => `Works until ${day}.`,
    /** What its copy button copies: "Copy the link for K7QD-2MXP-9F4R". */
    copy: (code: string) => `the link for ${code}`,
    cancel: "Cancel it",
    cancelLabel: (code: string) => `Cancel the invite ${code}`,
  },
  /** The practice's names, to open it and later to change them. */
  form: {
    name: "Your name, as the people you see know it",
    nameHint: "Shown to the people you invite, with what follows.",
    place: "Practice or clinic",
    optional: "Optional.",
    registration: "Registration you want to show",
    registrationHint: "Optional, such as CRP 06/123456.",
    notify: "Email me when a report arrives",
    saved: "Saved.",
  },
  problems: {
    name: "Write your name as the people you see know it.",
    tooLong: (max: number) => `Use at most ${max} characters.`,
    check: "Check the fields.",
    noSeat:
      "Every seat of your practice is in use. Cancel an invite you no longer need, or ask for more seats.",
    invites: "You have many invites waiting already. Cancel the ones you no longer need first.",
  },
  details: {
    title: "Practice details",
    lede: "What the people you invite see, and how you hear about new reports.",
    save: "Save",
    /** Under "Email me when a report arrives". */
    emailOff: "Email is not set up on this sintr. New reports show in your practice.",
    emailTo: (email: string) => `To ${email}: a link and a count, never who shared it or what it says.`,
    emailVerify: "A link and a count, never who or what. Confirm your email in Settings first.",
    plan: {
      title: "Plan and seats",
      unlimited: "Unlimited seats.",
      seats: (seats: number) =>
        `${seats} ${seats === 1 ? "seat" : "seats"}: each patient linked, or invite waiting, uses one.`,
      subscription: "Paid through Stripe.",
      grant: "Granted for your practice by whoever runs this sintr.",
      config: "Set by this sintr's configuration; whoever runs it can change them.",
      change: "Change the seats",
      more: "More seats",
    },
  },
  /** "Invite a patient": the page, its steps and its form. */
  invite: {
    title: "Invite a patient",
    lede: "Give a patient a code or a link. Once they accept it, the reports they choose to share with you arrive in your practice.",
    steps: [
      { title: "Make the invite", text: "One code and one link. It works for seven days, once." },
      {
        title: "Send it",
        text: "Read them the code in a session, or send the link the way you usually talk.",
      },
      {
        title: "They accept",
        text: "They see your name and details first, give their consent, and choose how reports reach you.",
      },
    ],
    footer:
      "What you will see: the reports they approve and share, as they approved them. Never their entries, check-ins, conversations or drafts. Either of you can end the link at any time.",
    note: "Who it is for",
    noteHint: "Optional, and only for you: the person never sees it.",
    make: "Make an invite",
    making: "Making the invite",
    made: "Read them the code in a session, or send the link the way you usually talk. It holds one seat until it is accepted, cancelled or expires.",
    another: "Make another invite",
  },
} as const;
