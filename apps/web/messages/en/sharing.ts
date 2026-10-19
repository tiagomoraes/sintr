/** Sharing with a therapist: invites both ways, the link, what they see, stopping. */
export const sharing = {
  title: "Sharing",
  heading: "Who can see what you write",
  lede: "Your diary is yours alone. You can give your therapist access to the reports you approve, and take it back at any time.",
  /** The one sentence that says what a link allows, said the same way everywhere. */
  scope: "Your therapist can read the reports you approve; nothing else.",
  /** What never travels through a link, whatever the person chooses. */
  never: "Never your entries, check-ins, conversations or drafts.",
  /** The other two promises of a practice's invite, said the same way wherever it is answered. */
  eachReport:
    "You choose for each report, unless you decide otherwise. Nothing goes to them until you approve it.",
  stopAnyTime: "You can stop at any time, and they lose access at once.",
  /** How an approved report reaches the therapist: asked each time, or sent as it is approved. */
  modes: {
    ask: {
      label: "Ask me each time",
      sentence: "Each time you approve a report, you choose whether it goes to them.",
    },
    auto: {
      label: "Send what I approve",
      sentence: "Every report you approve goes to them as you approve it.",
    },
  },
  mode: {
    legend: "When you approve a report",
    later: "You can change this later.",
    /** Only for a browser without JavaScript: a choice is saved as it is made. */
    save: "Save",
  },
  /** The consent a person ticks to link, around the practice as the page shows it. */
  consent: {
    before: "I agree to share the reports I approve with",
    /** On the card of a practice that accepted the person's invite. */
    afterHere: ", as described here. I can stop at any time.",
    /** On the invite's page and in the welcome, under the three promises. */
    afterAbove: ", as described above. I can stop at any time.",
  },
  /** Who can see anything right now, under the heading. */
  seen: {
    nobody: "Right now nobody can see anything you write.",
    one: (who: string) => `${who} can read the reports you share with them. Nobody else can see anything.`,
    many: (count: number) =>
      `${count} therapists can read the reports you share with each of them. Nobody else can see anything.`,
  },
  give: {
    title: "Give your therapist access",
    code: {
      title: "They gave you a code",
      text: "Your therapist has a practice on sintr and sent you a code or a link.",
      label: "The code",
      button: "Continue",
    },
    invite: "sintr makes a link for you to send them. They accept it from their practice, then you confirm.",
    waiting: "Invites waiting for your therapist",
    /** After the invite's code. */
    worksUntil: (day: string) => `, works until ${day}`,
    cancel: "Cancel it",
    cancelLabel: (code: string) => `Cancel the invite ${code}`,
  },
  how: {
    title: "How sharing works",
    items: [
      {
        term: "Approved reports only",
        text: "A report reaches your therapist only after you approve it. Drafts, entries, check-ins and conversations never do.",
      },
      {
        term: "Read in sintr",
        text: "They read it in their practice on sintr and can download its PDF. A PDF they download stays with them, as an email would.",
      },
      {
        term: "One action to stop",
        text: "Stop sharing and they lose access at once to everything you shared through sintr.",
      },
      { term: "You can see it", text: "Each report you share says when they first opened it." },
    ],
  },
  /** "Invite your therapist": the page, its steps and its form. */
  invite: {
    title: "Invite your therapist",
    lede: "Give your therapist a way to read the reports you approve, in sintr, instead of or as well as the PDF by email.",
    steps: [
      { title: "Send them the link", text: "Or read them the code. It works for seven days, once." },
      {
        title: "They accept it",
        text: "From their practice on sintr. If they have none yet, the link helps them open one.",
      },
      {
        title: "You confirm",
        text: "You see their name and details, and say yes. Only then can you share.",
      },
    ],
    name: "How they will see you",
    nameHint: "Optional. The name your therapist knows you by; you can change it later.",
    make: "Make an invite for my therapist",
    making: "Making the invite",
    made: "Send it to your therapist the way you usually talk to them. When they accept it in their practice on sintr, you will see it in Sharing and confirm it is them. Nothing is shared before that.",
  },
  /** A fresh invite, on either side: the code, the link, how long it works. */
  panel: {
    /** The professional's own note on who it is for. */
    forNote: (note: string) => `For ${note}`,
    code: "The code",
    link: "Or the link",
    /** What a copy button copies: "Copy the code". */
    copyCode: "the code",
    copyLink: "the link",
    /** Around the day it works until. */
    until: { before: "It works until", after: ", once." },
  },
  /** A practice that accepted the person's invite, waiting for their yes. */
  pending: {
    label: (who: string) => `${who} is waiting for your confirmation`,
    title: (who: string) => `${who} accepted your invite`,
    body: "Confirm it is your therapist, and the link starts. Until you do, nothing can be shared with them.",
    each: "You choose for each report, unless you decide otherwise. You can stop at any time.",
    form: "Confirm the link",
    confirm: "Confirm, it is my therapist",
    confirming: "Confirming",
    decline: "It is not my therapist",
    declining: "Declining",
  },
  /** An active link, as the person sees it. */
  active: {
    label: (who: string) => `Sharing with ${who}`,
    since: (day: string) => `Linked since ${day}.`,
    shared: {
      label: (who: string) => `Reports shared with ${who}`,
      title: "What you shared with them",
      on: (day: string) => `Shared on ${day}.`,
      opened: (day: string) => `They opened it on ${day}.`,
      notOpened: "Not opened yet.",
      none: "Nothing yet. When you approve a report, you can share it with them from its page.",
    },
    stop: {
      label: "Stop sharing",
      aria: (who: string) => `Stop sharing with ${who}`,
      confirm: "Yes, stop sharing",
      keep: "Keep sharing",
      pending: "Stopping",
      explanation: (who: string) =>
        `${who} loses access at once to every report you shared here. A PDF they already downloaded stays with them, as an email would.`,
    },
  },
  /** The name the practice sees the person by, changed in place. */
  name: {
    /** Before the name, or the neutral label, in serif. */
    seenAs: "In their list they see you as",
    afterName: ".",
    afterNeutral: ", a neutral label.",
    change: "Change it",
    reportName: (name: string) =>
      `Your reports show the name you set in Therapy, ${name}, as their PDF does.`,
    label: "How they see you",
    save: "Save",
    cancel: "Cancel",
    empty: (neutral: string) => `Leave it empty and they see ${neutral}.`,
  },
  /** What changed in the account's links lately (the practice's own lines are in practice). */
  notices: {
    label: "What changed",
    new: "New.",
    /** When the practice is not known any more. */
    someone: "Your therapist's practice",
    pending: (who: string) => `${who} accepted your invite. Confirm it to start sharing.`,
    ended: (who: string) => `${who} ended the link. They no longer see your reports.`,
    declined: (who: string) => `${who} withdrew from your invite. Nothing was shared.`,
    other: (who: string) => `${who} updated the link.`,
  },
  problems: {
    code: "Check the code: 12 letters and digits, such as K7QD-2MXP-9F4R.",
    invites: "You have five invites waiting already. Cancel one you no longer need, then make a new one.",
    consent: "Tick the box to give your consent, or decline.",
    notWaiting: "This link is no longer waiting. Reload the page.",
    changed:
      "The practice changed its name or details since this page opened. Reload the page and read them again.",
    nameTooLong: "Use at most 80 characters.",
  },
  /** /join/<code>: an invite, opened by anyone with its link, signed in or not. */
  join: {
    title: "An invite",
    diary: "Your diary",
    signIn: "Sign in",
    invalid: {
      title: "This invite does not work any more.",
      body: "It may have expired, been cancelled or been used already. Ask the person who sent it for a new one.",
    },
    busy: { title: "Too many tries from here.", body: "Wait a few minutes, then open the link again." },
    backToDiary: "Back to your diary",
    whatIs: "What is sintr?",
    /** A practice invites a person. */
    fromPractice: {
      /** After the professional's name. */
      heading: "invites you to share your reports.",
      signedOut: (until: string) =>
        `sintr is a private diary for the week between sessions. To accept, create yours or sign in. The invite works until ${until}.`,
      create: "Create your diary",
      haveOne: "I already have one",
      own: "This is your practice's own invite. Send it to the person you want to invite.",
      back: "Back to your practice",
      notNow: (until: string) => `Not now? Leave this page; the invite works until ${until}.`,
    },
    /** A person invites their therapist. */
    fromPerson: {
      /** When the person gave no name. */
      someone: "Someone you see",
      /** After the person's name. */
      heading: "would like you to receive the reports they approve.",
      accept:
        "When you accept, they confirm on their side that it is you. Then each report they approve and choose to share appears in your practice on sintr.",
      only: "You see the reports they share, and nothing else. They can stop at any time.",
      signedOut: (until: string) =>
        `Sign in to accept it from your practice, or create an account and open a practice. The invite works until ${until}.`,
      create: "Create an account",
      haveOne: "I already have one",
      own: "This is your own invite. Send it to your therapist.",
      back: "Back to Sharing",
    },
    /** The person's acceptance of a practice's invite. */
    asPerson: {
      form: "Accept the invite",
      name: "How they will see you",
      nameHint:
        "Optional. The name they know you by, in their list. Left empty, they see a neutral label instead.",
      reportName: (name: string) => `Your reports themselves show the name you set in Therapy, ${name}.`,
      accept: "Accept and link",
      accepting: "Linking",
    },
    /** A professional's acceptance of a person's invite, opening the practice first when there is none. */
    asPractice: {
      form: "Accept for your practice",
      /** Around the practice it is accepted for, then how its seats stand. */
      forPractice: { before: "You accept it for", after: "." },
      open: "To accept, open your practice on sintr first. It takes one step.",
      accept: "Accept for my practice",
      openAndAccept: "Open my practice and accept",
      accepting: "Accepting",
    },
    problems: {
      gone: "This invite does not work any more: it may have expired, been cancelled or been used. Ask for a new one.",
      busy: "Too many tries from here. Wait a few minutes, then try again.",
      consent: "Tick the box to give your consent, or leave it for now.",
      nameTooLong: "Use at most 80 characters for your name.",
      linkedPractice: "You are already linked with this practice.",
      ownPractice: "This is your own practice's invite.",
      noSeat: "This practice has no free seat right now. Let your therapist know; nothing was shared.",
      tooLong: "Some of it is too long. Shorten it and try again.",
      linkedPerson: "You are already linked with this person.",
      ownInvite: "This is your own invite.",
      noSeatOwn: "Your practice has no free seat. Free one, or ask for more, then open this link again.",
    },
  },
} as const;
