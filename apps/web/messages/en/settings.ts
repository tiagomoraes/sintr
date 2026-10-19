/** Settings, in the narrative voice: who answers you, how sintr reaches you, and your time. */
export const settings = {
  title: "Settings",
  lede: "Who answers you, how sintr reaches you, and your time.",
  /** One line under the heading: the welcome, again, with nothing lost. */
  welcomeAgain: {
    body: "You can go through the welcome again whenever you like: what you told it is already filled in, any question can be skipped, and nothing you have written is erased.",
    link: "Go through the welcome again",
  },
  assistant: {
    title: "Your assistant",
    included: (name: string) =>
      `The assistant is included. It runs on a model from ${name}, through sintr's own account: what you write in a conversation is sent there to be answered, and nowhere else. You do not need a key.`,
    /** `label` is one of `plans` below. */
    plan: (label: string) => `You are on ${label}`,
    plans: { free: "Free", personal: "Personal", unlimited: "Unlimited" },
    planNoLimit: ", with no monthly limit.",
    /** `limit` is already counted, such as "100 messages". */
    planUsed: (used: number, limit: string) => `: ${used} of ${limit} used this month.`,
    /** The words `planUsed` counts with. */
    message: { one: "message", many: "messages" },
    planLink: "Your plan",
    door: "Use your own key instead",
    doorBody:
      "Bring a key from a provider you choose, or a model on your own machine. Your conversations and reports then go to that provider, under your own agreement with it, and they do not count toward your plan: it is free here, and the provider bills you.",
    own: (provider: string, model: string, house: boolean) =>
      `You are using your own key, with ${provider} (${model}). What you write in a conversation goes to that provider, under your agreement with it${house ? ", and it does not count toward any plan." : ", and nowhere else."}`,
    /** The provider in `own` when it is an OpenAI-compatible endpoint whose address cannot be read. */
    endpoint: "an OpenAI-compatible endpoint",
    back: "Go back to the included assistant",
    backNote: "Your key is removed from sintr.",
    ownDoor: "Your own key",
    none: "This sintr has no assistant of its own, so it talks to a model you choose, with your own key. What you write in a conversation is sent to that provider, and nowhere else.",
    keyNote:
      "The key is encrypted with your own data key before it is stored, is never shown again, and is used only to reach that provider.",
  },
  /** The form behind the door: the person's own provider, model and key. */
  form: {
    label: "The assistant",
    provider: "Provider",
    /** The provider that is not a name: any endpoint speaking the OpenAI chat API. */
    compatible: "OpenAI-compatible",
    compatibleHint:
      "Any endpoint that speaks the OpenAI chat API: OpenAI itself, OpenRouter, Ollama, LiteLLM and others.",
    /** `name` is Anthropic or Google. */
    directHint: (name: string) => `sintr talks to ${name} directly, with your key.`,
    url: "Address of the endpoint",
    urlHint:
      "When sintr runs in Docker, a model on the same machine is at http://host.docker.internal instead of localhost.",
    model: "Model",
    /** The model field's placeholder, for each provider. */
    models: {
      openai_compatible: "The model name at that endpoint",
      anthropic: "For example claude-sonnet-5-5",
      google: "The Gemini model name",
    },
    key: "API key",
    keyKeep: "Leave empty to keep the saved key",
    keyPaste: "Paste your key",
    /** `hint` is the key's last characters, when sintr kept them. */
    keySaved: (hint: string | null) =>
      `A key is saved${hint ? `, ending in ${hint}` : ""}. It is never shown again, and changing the provider or its address removes it.`,
    keyOptional: "Optional for a local endpoint such as Ollama.",
    keyFrom: "From your account with the provider.",
    keyRemove: "Remove the saved key",
    save: "Save the assistant",
    saved: "Saved.",
  },
  /** One real call to the saved provider, and what came of it. */
  test: {
    label: "Test the connection",
    testing: "Testing",
    note: "One short request to the provider, with the saved settings.",
    rehearsal: "The rehearsal assistant answered. It is offline and scripted, so nothing left this machine.",
    ok: "The assistant answered. You are ready to talk.",
    /** By the code the test or the setup checks return. */
    problems: {
      not_configured: "Save a provider and a model first.",
      key_required: "This provider needs an API key.",
      base_url_required: "This provider needs its address.",
      key_refused: "The provider refused the key. Check that it is complete and still active.",
      model_not_found: "The provider does not know this model. Check its name.",
      rate_limited: "The provider is busy, or the key has reached its limit. Try again in a moment.",
      unreachable: "The provider could not be reached. Check the address, and that it is running.",
      timeout: "The provider took too long to answer.",
      provider_error: "The provider answered with an error. Check the model and the key.",
      invalid_url: "The address does not look right.",
      credentials_in_url: "The address must not contain a password.",
      https_required: "The address has to use https here.",
      private_address: "The address has to be a public one here.",
    },
  },
  /** Speaking, said in Settings next to who answers. */
  voice: {
    ready: (who: string) =>
      `When you speak instead of typing, ${who} writes down what you said, and the recording is dropped once it has: sintr never keeps it. You read the words before they are sent.`,
  },
  others: {
    title: "Your other assistants",
    body: "ChatGPT, Claude, Gemini or Hermes can keep entries here for you, each with its own key.",
    more: "Connect another",
    first: "Connect one",
    none: "No assistant is connected.",
  },
  email: { title: "Your email" },
  practice: {
    titleOwn: "Your practice",
    titleNew: "Are you a therapist?",
    own: (name: string) => `Your practice, ${name}, receives the reports your patients share with you.`,
    ownLink: "Open the dashboard",
    open: "Open a practice on this account to receive the reports your patients choose to share with you. Your own diary stays as it is.",
    openLink: "Open a practice",
  },
  time: {
    title: "Your time and your conversations",
    label: "Time zone and conversations",
    zone: "Your time zone",
    zoneHint: "Dates in your diary, and the assistant's sense of today, follow it.",
    /** Offered when the browser's zone is not the saved one. */
    device: (zone: string) => `Use this device's time zone, ${zone}`,
    keep: "Keep conversations",
    keepHint: "Entries and check-ins you saved stay in your diary either way. Only the conversations go.",
    retention: {
      keep: "Until I delete them",
      30: "30 days after the last message",
      90: "90 days after the last message",
      365: "A year after the last message",
    },
    save: "Save",
    saved: "Saved.",
  },
  /** What is not saved yet, as the question before leaving names it inside `shell.unsaved.changes`. */
  unsaved: {
    timezone: "the time zone",
    retention: "how long to keep conversations",
    assistant: "the assistant",
    language: "the language",
  },
  /** Said by the forms when something they were given cannot be kept. */
  problems: {
    provider: "Choose a provider.",
    model: "Write the model's name, as your provider writes it.",
    /** By the code the address check returns. */
    url: {
      invalid_url: "Write the full address, starting with http:// or https://.",
      credentials_in_url: "Leave the password out of the address; the key goes in its own field.",
      https_required: "Use an https address.",
      private_address: "Use a public https address.",
    },
    houseUrl:
      "That is the address of this sintr's own assistant, which is already included. Use your provider's address.",
    keyOther: "The saved key belongs to another provider. Paste the key for this one.",
    keyNeeded: "This provider needs an API key.",
    fields: "Check the fields and try again.",
    retention: "Choose how long to keep conversations.",
    timezone: "Choose a time zone from the list.",
  },
} as const;
