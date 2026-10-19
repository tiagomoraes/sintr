/**
 * An entry, the diary's thought record: the list, one entry, its form, the
 * dated changes, and the draft the assistant proposes. The changes and the
 * draft card are a check-in's too; what differs by kind is in `draft`, here
 * and in the check-in's own file.
 */
export const entry = {
  /** The fields' names, as the form and the notebook card show them. */
  labels: {
    occurredAt: "When it happened",
    title: "Title",
    situation: "What happened",
    thoughts: "What went through your mind",
    emotions: "How it felt",
    body: "In the body",
    behavior: "What you did",
    context: "Around it",
    tags: "Areas",
    notes: "Notes",
    hotThought: "The strongest thought",
    evidenceFor: "What supports it",
    evidenceAgainst: "What does not",
    alternative: "Another way to see it",
    alternativeBelief: "How believable it feels",
    emotionsAfter: "How it felt after",
  },
  /** The same fields inside a sentence: "Corrected what happened and how it felt." */
  inASentence: {
    occurredAt: "when it happened",
    title: "the title",
    situation: "what happened",
    thoughts: "what went through your mind",
    emotions: "how it felt",
    body: "the body",
    behavior: "what you did",
    context: "what was around it",
    tags: "the areas",
    notes: "the notes",
    hotThought: "the strongest thought",
    evidenceFor: "what supports it",
    evidenceAgainst: "what does not",
    alternative: "another way to see it",
    alternativeBelief: "how believable it feels",
    emotionsAfter: "how it felt after",
  },
  /** An emotion's strength, or how believable the other view feels: "80 of 100". */
  intensity: (value: number) => `${value} of 100`,
  list: {
    title: "Entries",
    lede: "The moments you choose to write down: what happened, what went through your mind, how strong it felt.",
    talk: "Talk it through",
    talkHint: "The assistant drafts the entry; you confirm it.",
    /** A page further back that holds nothing. */
    earlierNone: "Nothing earlier than this.",
    latest: "Back to the latest entries",
    empty: "Nothing written yet.",
    emptyHint:
      "When something happens, tell it in your own words and the assistant will help you keep it, as much or as little as you want. A partial entry is a real entry; it can grow later.",
    noWords: "An entry without words yet.",
    earlier: "Earlier entries",
  },
  /** One entry, on its own page. */
  record: {
    title: "Entry",
    all: "All entries",
    /** For a screen reader: the page's heading. */
    heading: (when: string) => `Entry of ${when}`,
    tag: "Entry",
    tagChanged: "Entry, changed later",
    change: "Change this entry",
    changeHint: "Changes are dated, and what it said before is kept.",
    empty: "Nothing written in it yet.",
    /** Before the number of how believable the other view feels. */
    believable: "believable",
  },
  edit: {
    title: "Change an entry",
    heading: "Change this entry",
    lede: "The entry will show your new words. What it said before is kept with the date of the change, so nothing is rewritten silently.",
    save: "Save the change",
    cancel: "Cancel",
  },
  form: {
    whenHint: "In your time zone. Leave it as it is if the time is right.",
    whenEmptyHint: "Leave it empty if it was just now.",
    situationHint: "When, where, who, what.",
    thoughtsHint: "The thoughts as you heard them, word for word.",
    /** A screen reader's name for each thought's box. */
    thought: (n: number) => `Thought ${n}`,
    addThought: "Add a thought",
    emotionsHint: "Your word for each emotion, and how strong it was at the time, from 0 to 100.",
    /** A screen reader's name for each emotion's box. */
    emotion: (n: number) => `Emotion ${n}, in your own word`,
    emotionAfter: (n: number) => `Emotion after ${n}, in your own word`,
    emotionPlaceholder: "In your own word",
    strength: "How strong, from 0 to 100",
    strengthPlaceholder: "0 to 100",
    addEmotion: "Add an emotion",
    remove: "Remove",
    more: "More about it, if you want",
    moreHint: "The body, what you did, what was around it, a title. All optional.",
    behaviorHint: "Nothing at all is a real answer too.",
    contextHint: "Sleep, food, work, health: only if it matters.",
    tagsHint: "Separated by commas, such as work, family.",
    titleHint: "A few words to find it again, if you want.",
    deeper: "Working the thought, if you want to",
    deeperHint: "Optional, and fine to leave for the session. The other view should come from you.",
    evidenceForHint: "Facts you can point to.",
    beliefHint: "From 0 to 100.",
    afterHint: "The same emotions, rated again.",
  },
  /** The dated changes of an entry or a check-in, and the note the person may leave with one. */
  corrections: {
    title: "Changes since it was written",
    lede: "Each change is kept with its date and what it replaced, so nothing here was rewritten silently.",
    /** The fields, already joined: "what happened and how it felt". */
    corrected: (fields: string) => `Corrected ${fields}.`,
    /** A change that only filled empty fields. */
    completed: (fields: string) => `Completed with ${fields}.`,
    before: "What it said before",
    empty: "Empty",
    note: "What changed, in your words",
    noteHint: "Optional. It is kept with the date of this change.",
  },
  /** The draft card in the conversation, as an entry. */
  draft: {
    label: "Draft entry, waiting for you",
    saved: "Saved entry",
    /** The card's head when the draft has no time of its own. */
    head: "A draft for your diary",
    edit: "Edit this entry",
    save: "Save entry",
    savedTo: "Saved to your entries.",
  },
  /** The draft card's words for either kind: nothing in it is a record until Confirm. */
  card: {
    status: { proposed: "Draft, not saved", saved: "Saved", discarded: "Discarded" },
    kept: "Kept in your diary",
    confirm: "Confirm",
    edit: "Edit",
    discard: "Discard",
    discardAsk: "Discard this draft? Nothing from it will be saved.",
    discardIt: "Discard it",
    keepIt: "Keep it",
    cancel: "Cancel",
    savedEdited: "Saved with your changes.",
    open: "Open it",
    discarded: "Draft discarded.",
    nothingSaved: "Nothing from it was saved.",
    unavailable: "This could not be saved just now. Nothing was lost; try again in a moment.",
  },
  problems: {
    emotionName: "Name each emotion, in your own word.",
    intensity: "Use a whole number from 0 to 100, or leave it empty.",
    when: "Check the date and time.",
    invalid: "Some of it could not be kept as it is. Check the fields and try again.",
    review: "Something needs a look above before it can be saved.",
  },
} as const;
