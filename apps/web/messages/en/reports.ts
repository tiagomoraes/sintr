/** Reports: the list, a report and its page, changing it, approving it, sending and sharing it. */
export const reports = {
  title: "Reports",
  lede: "A short page about the days since your last session, prepared before the next one. You read it first; it goes to your therapist only if you approve that report.",
  /** A report's name in a list, with the moment or the day already written in the page's language. */
  titles: {
    session: (when: string) => `For the session of ${when}`,
    week: (day: string) => `Week of ${day}`,
  },
  /** The lifecycle, in the person's words. */
  status: {
    draft: "Draft, waiting for you",
    reviewed: "Approved by you, not sent",
    sent: "Sent with your approval",
  },
  /** The last of several names joined to the others, already joined by commas: "a, b and c". */
  and: (others: string, last: string) => `${others} and ${last}`,
  /** The sections, as the app names them inside a sentence. */
  sectionNames: {
    week: "how the week went",
    session: "the topics for the session",
    mood: "mood, energy and sleep",
    moments: "the moments",
    patterns: "what repeated",
    helped: "what helped",
  },
  list: {
    /** The words before and after the moment the next report is prepared, which the page sets apart. */
    next: (prepared: string, session: string): [string, string] => [
      "The next one is prepared on ",
      `, for your session of ${session}.`,
    ],
    noSession: "No session is in your calendar, so reports are prepared only when you ask.",
    setSessions: "Add your sessions",
    /** On the included assistant, once this month's reports are used; `next` is the day the month turns. */
    used: (next: string) =>
      `This month's reports written by the assistant are used, so until ${next} sintr prepares them from your own words: the moments, your notes and your topics.`,
    yourPlan: "Your plan",
    prepareNow: "Prepare it now",
    prepareWeek: "Prepare this week's report",
    empty: "No reports yet.",
    emptyBody:
      "Each report covers the days since the last one, in your own words, with the numbers from your check-ins. Nothing in it is a score, and quiet weeks are fine.",
    range: (start: string, end: string) => `${start} to ${end}`,
    /** `to` is the address it went to, when it is known. */
    sent: (to: string | null, day: string) => `Sent to ${to ?? "your therapist"} on ${day}`,
    shared: (day: string) => `Shared on ${day}`,
  },
  /** Preparing a report now, from the list. Nothing is sent. */
  prepare: {
    busy: "Preparing the report",
    wait: "Reading the days since the last report. This can take a minute when your assistant writes it.",
    failed: "The report could not be prepared just now. Try again in a moment.",
  },
  /** One report's page. */
  report: {
    title: "Report",
    all: "All reports",
    /** Before the session's moment, or before the week (`week` below). */
    heading: { session: "The report for", week: "The report for" },
    week: (label: string) => `week ${label}`,
    sent: (to: string | null, when: string) =>
      `Sent with your approval to ${to ?? "your therapist"} on ${when}.`,
    shared: (when: string) => `Approved by you and shared on ${when}.`,
    covers: (start: string, end: string) => `It covers ${start} to ${end}.`,
    seePlan: "See your plan",
    problems: "Worth a look before you approve it",
    /** With one practice: when it was shared, and whether they opened it. */
    sharedWith: (name: string, day: string, opened: string | null) =>
      `Shared with ${name} on ${day}. ${opened ? `They opened it on ${opened}.` : "Not opened yet."}`,
    pdf: {
      draftTitle: "The PDF, as a draft",
      title: "The PDF your therapist receives",
      open: "Open the PDF",
      download: "Download",
      draftNote: "Marked as a draft on its first page until you approve it.",
      note: "Printed when you approved it. This is exactly the file that is sent or shared.",
      preview: "PDF preview of the report",
    },
  },
  /** Why sintr, not the assistant, prepared a draft. */
  author: {
    notConfigured:
      "There is no assistant set up, so sintr prepared what it can on its own: the moments, your notes and your topics, in your own words. How the week went and the reading of the numbers are yours to write.",
    limitReached:
      "This month's reports written by the assistant are used on your plan, so sintr prepared what it can on its own: the moments, your notes and your topics, in your own words. How the week went is yours to write, or the assistant can prepare it again next month.",
    noReport:
      "Your assistant answered without writing the report, so sintr prepared what it can on its own. You can write the rest, or prepare it again.",
    /** No reason recorded. */
    none: "sintr prepared what it can on its own.",
    /** The assistant failed some other way. */
    unreachable:
      "Your assistant could not be reached to write this draft, so sintr prepared what it can on its own. You can write the rest, or prepare it again when the assistant answers.",
  },
  /** What the check found, for the person. `quoted` is their own words, in quotes (or empty). */
  problems: {
    quoteNotFound: (quoted: string) =>
      `${quoted} is not in your diary word for word, so it is shown without the highlight that marks your own words.`,
    statesACause: (quoted: string) =>
      `${quoted} reads as a cause. The report describes what happened together, not why.`,
    clinicalLabel: (quoted: string) =>
      `${quoted} reads as a clinical label. The report keeps to your own words.`,
    undatedObservation: (quoted: string) => `An observation under what repeated has no date: ${quoted}.`,
    momentEntryChanged: (quoted: string) =>
      `The entry ${quoted} changed after this report was prepared. Prepare it again to take the change.`,
    momentEntryMissing: (quoted: string) =>
      `The entry ${quoted} is no longer in your diary. Remove the moment or prepare the report again.`,
    noteChanged: (quoted: string) => `A check-in note changed after this report was prepared: ${quoted}.`,
    tooManyTopics: "There are more than six topics for the session; two to four read best.",
    tooManyMoments: "There are more than six moments; three to five read best.",
    longSummary: "How the week went is long for the first page; three to six lines read best.",
  },
  /** The person's decisions on a report: approve, change, prepare again, send, share. */
  actions: {
    change: "Change the words",
    approve: "Approve this report",
    approving: "Approving",
    /** `names` are the practices that receive what the person approves, joined. */
    approveAndShare: (names: string) => `Approve and share with ${names}`,
    again: "Prepare it again",
    preparing: "Preparing",
    approveNote: "Approving keeps this version and prints the final PDF, without the draft mark.",
    approveShares: (names: string, count: number) =>
      `You chose that what you approve goes to ${names}, so approving also shares it with ${
        count === 1 ? "them" : "each of them"
      }, and nothing else.`,
    approveSendsNothing: "Nothing is sent when you approve.",
    againReplaces: "Preparing it again replaces your changes; what they said is kept below.",
    send: {
      title: "Send it to your therapist",
      /** Before the address, which the page sets apart, and after it. */
      consent: (therapist: string | null): [string, string] => [
        `I approve sending this report, exactly as in the PDF below, to ${therapist ? `${therapist}, ` : ""}`,
        ".",
      ],
      button: "Approve and send",
      busy: "Sending",
      note: "An email cannot be taken back. Your yes is recorded with the date, the report and the address.",
    },
    share: {
      title: (name: string) => `Share it with ${name}`,
      /** Before the practice, which the page sets apart, and after it. */
      consent: ["I approve sharing this report, exactly as in the PDF below, with ", " on sintr."],
      button: (name: string) => `Share with ${name}`,
      busy: "Sharing",
      note: "They read it in their practice and can download the PDF. Your yes is recorded with the date. You can stop sharing in Sharing; a PDF they downloaded stays with them.",
    },
    /** When an approved report does not go by email, and why. */
    keepWithPractices:
      "Nothing goes by email: you chose to keep the PDF for yourself. You can download it below.",
    keep: "You chose to keep reports for yourself. Download the PDF to bring it or share it your way.",
    noAddress:
      "To send it, add your therapist's email in Therapy. You can also download the PDF and share it yourself.",
    emailOff: "Email is not set up on this sintr. Download the PDF to bring it or share it yourself.",
  },
  /** What went wrong with a decision, by the code the server answered. */
  failures: {
    pdfUnavailable: "The PDF could not be printed just now. Nothing changed; try again in a moment.",
    practiceChanged:
      "The practice changed its name or details since this page opened. Nothing was shared; reload the page and read them again.",
    sharingChanged:
      "Who receives what you approve changed since this page opened. Nothing was approved; reload the page and look again.",
    notFound: "That link is no longer active, so nothing was shared. Reload the page.",
    emailOff:
      "Email is not set up on this sintr, so nothing was sent. Download the PDF to share it yourself.",
    sendFailed: "The email could not be sent, so the report is not marked sent. Try again in a moment.",
    invalid: "Your therapist's email changed since this page opened. Read the address again before sending.",
    invalidState: "The report changed since this page opened. Reload it and look again.",
    invalidMessage: "Your therapist's email does not look right. Check it in Therapy.",
    /** Approved, but sharing with a practice that receives everything approved failed. */
    notShared: "Approved. It could not be shared with every practice just now; share it from below.",
    other: "Something went wrong. Nothing was sent. Try again in a moment.",
  },
  /** What a report said before each change. */
  changes: {
    title: "Changes since it was prepared",
    lede: "Each change is kept with its date and what the report said before.",
    /** `sections` are the section names above, joined; null when no section's words changed. */
    edited: (sections: string | null) =>
      sections === null ? "You changed nothing in its words." : `You changed ${sections}.`,
    preparedAgain: (sections: string | null) =>
      sections === null ? "Prepared again." : `Prepared again, changing ${sections}.`,
    before: "What it said before",
    labels: {
      week: "How the week went",
      session: "For the session",
      mood: "Mood, energy and sleep",
      moments: "The moments",
      patterns: "What repeated",
      helped: "What helped",
    },
  },
  /** Changing a report's words before approving it. */
  editor: {
    title: "Change the report",
    lede: "Rewrite what you want, remove what you would rather not share. Your words in the entries stay as they are.",
    week: {
      title: "How the week went",
      hint: "Three to six plain lines. Double quotes mark your own words: use them only for words in your diary as you wrote them.",
    },
    session: {
      title: "For the session",
      hint: "Your own topics first, in the order you want them.",
      topic: "A topic for the session",
      suggested: "Suggested by sintr. Keep it only if you want to talk about it.",
      remove: "Remove this topic",
      add: "Add a topic",
    },
    mood: {
      title: "Mood, energy and sleep",
      hint: "A few lines that read the numbers. The numbers, the chart and the day-by-day grid are computed from your check-ins.",
      notes: "In the day's own words",
    },
    moments: {
      title: "Moments that stood out",
      hint: "What went through your mind and how it felt come from each entry, word for word. To change them, change the entry and prepare the report again.",
      intro: "How they were chosen",
      momentTitle: "Title",
      remove: (title: string) => `Remove the moment ${title}`,
      happened: "What happened",
      context: "Context",
      did: "What you did",
      thoughts: "What went through your mind, from the entry",
      felt: "How it felt, from the entry:",
    },
    patterns: {
      title: "What repeated",
      hint: "Each observation with its dates. What happened together, never why.",
      when: "When",
      dates: "Dates",
      remove: "Remove this observation",
      add: "Add an observation",
    },
    helped: {
      title: "What helped",
      hint: "As you recorded it, with its date.",
      remove: "Remove this",
      add: "Add something that helped",
    },
    remove: "Remove",
    save: "Save the changes",
    saving: "Saving",
    cancel: "Cancel",
    note: "The report becomes a draft again, to read and approve as it then reads. What it said before is kept with the date.",
    sent: "This report was sent, so it cannot change any more.",
    failed: "Some of it could not be kept as it is. Check the fields and try again.",
  },
  /** The app's words around the report itself (the report's own words are in its language, in @sintr/core). */
  paper: {
    label: "The report",
    /** On a quote that is not in the diary as written. */
    unverified: "Not found in the diary word for word",
    /** Between an emotion's intensity before and after, for a screen reader: "70 to 40". */
    to: "to",
  },
} as const;
