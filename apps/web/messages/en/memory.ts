/**
 * Memory (F10): what sintr remembers of the person, for their own
 * assistant, where each memory came from, and how to correct or forget it.
 * `names` is a list of providers already joined in the page's language
 * ("OpenRouter", "Anthropic and OpenAI"); `day` a date as the page writes it.
 */
export const memory = {
  title: "Memory",
  heading: "What sintr remembers",
  lede: {
    off: "Your assistant knows only the conversation in front of it. With a memory, it knows your name and what you told your diary before, so you do not start from nothing every time.",
    on: "Drawn from your own diary, for your own assistant. Each memory shows where it came from. If one is wrong, correct it or forget it.",
  },
  /** What turning it on means, said before the yes, as the consent records it. */
  offer: {
    what: {
      term: "What it does",
      body: "sintr reads what you write in your diary, your entries and check-in notes, and keeps short notes from it: your name, who you are, what has been happening. When you talk to your assistant, the ones that matter are in front of it.",
    },
    who: {
      term: "Who receives your words",
      house: (names: string) =>
        `To read your diary and find what is near in meaning, sintr sends your entries and check-in notes to ${names}, under sintr's own account, the same way your conversations go there.`,
      own: (names: string) =>
        `To read your diary and find what is near in meaning, sintr sends your entries and check-in notes to ${names}, with your own key, the same way your conversations go there.`,
    },
    kept: {
      term: "What is kept",
      body: "Each memory is sealed with your own key, like your diary, together with the words it came from. To find it by meaning, sintr also keeps a list of numbers for it, turned by a key only your account has. None of it goes into your reports, and your therapist never sees it.",
    },
    yours: {
      term: "What you can do",
      body: "See every memory and where it came from, correct it, or forget it. Forgetting everything turns the memory off and deletes all of it.",
    },
    never: {
      term: "What it never does",
      body: "A memory is never a diagnosis and never changes what you wrote. Words that signal risk are never kept, and the help lines always come first.",
    },
    agree: "Let sintr remember",
    agreeing: "Reading your diary",
    note: "Nothing is read until you agree, and you can turn it off at any time.",
    changed: "Who would receive your words changed while this page was open. Read it again before you agree.",
  },
  /** Why there is no memory to turn on. `provider` is the person's own provider, when there is one. */
  unavailable: {
    not_configured:
      "There is no assistant here yet, so there is nothing to remember for. Once you set one up in Settings, you can turn the memory on.",
    off: "This sintr does not offer a memory.",
    provider_has_no_embeddings: (provider: string | null) =>
      `Your assistant runs on ${provider ?? "a provider"} that cannot place words by meaning, so sintr cannot keep a memory with it. OpenRouter, OpenAI and Google can.`,
    provider_unknown: (provider: string | null) =>
      `sintr does not know how to ask ${provider ?? "your provider"} to place words by meaning, so it cannot keep a memory with it. OpenRouter, OpenAI and Google can.`,
    settings: "Open Settings",
  },
  paused: {
    route: (agreed: string, now: string) =>
      `Your memory is paused. You agreed to send your diary to ${agreed}, and your assistant now runs on ${now}. Nothing is read or sent until you agree again.`,
    wording:
      "Your memory is paused: the words of this agreement changed. Read them again, and agree if you want it to go on.",
    unavailable: "Your memory is paused, and nothing is read or sent:",
    again: (names: string) => `Agree for ${names}`,
  },
  status: {
    goesTo: (names: string) => `To keep it, your diary goes to ${names}.`,
    all: "sintr has read everything you wrote.",
    waiting: (count: number) =>
      count === 1 ? "One page is waiting to be read." : `${count} pages are waiting to be read.`,
    readNow: "Read them now",
    reading: "Reading",
    daily: "sintr has read as much as it reads in a day here; the rest follows tomorrow.",
    failed: "sintr could not read your diary just now. It tries again by itself.",
  },
  sections: {
    about: "Who you are",
    moments: "What has been happening",
  },
  name: {
    line: (name: string) => `You go by ${name}.`,
    source: "From the welcome.",
    change: "Change it",
  },
  empty: {
    title: "Nothing yet",
    body: "sintr keeps memories from what you write. Write an entry or a check-in note, and what is worth carrying appears here.",
  },
  source: {
    entry: (day: string) => `From your entry of ${day}`,
    checkin: (day: string) => `From your check-in of ${day}`,
  },
  words: "In your words",
  corrected: "You corrected this.",
  correct: {
    open: "Correct it",
    label: "What should sintr remember instead?",
    save: "Save",
    saving: "Saving",
    cancel: "Cancel",
    tooLong: "Use at most 300 characters.",
    empty: "Write what sintr should remember, or forget it instead.",
  },
  forget: {
    label: "Forget",
    confirm: "Forget it",
    pending: "Forgetting",
    explanation:
      "sintr deletes this memory. It does not come back from the same page unless you change that page.",
  },
  forgetAll: {
    title: "Forget everything",
    body: "Every memory, and the record of what sintr read, is deleted, and the memory turns off. Your diary stays exactly as it is.",
    label: "Forget everything",
    confirm: "Forget everything and turn it off",
    pending: "Forgetting",
    explanation:
      "This cannot be undone. If you turn the memory on again later, sintr reads your diary again from the start.",
    done: "Done. sintr keeps no memory of you now, and nothing is read.",
  },
  download: {
    title: "Take it with you",
    body: "Every memory, the words it came from and where, as a file.",
    link: "Download what sintr remembers",
  },
  /** On an entry or a check-in: what sintr remembers from it. */
  fromRecord: (count: number) =>
    count === 1 ? "sintr remembers one thing from this." : `sintr remembers ${count} things from this.`,
  seeMemory: "See them in Memory",
} as const;
