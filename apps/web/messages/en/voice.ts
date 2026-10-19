/** Speaking instead of typing. */
export const voice = {
  speak: "Speak",
  speakLabel: "Speak instead of typing",
  listening: "Listening",
  done: "Done",
  cancel: "Cancel",
  transcribing: "Writing down what you said",
  heard: "Here is what I heard. Change anything, then send it.",
  clear: "Clear it",
  problems: {
    denied:
      "sintr cannot hear you: the microphone is off for this page. You can write instead, or allow the microphone in your browser's settings.",
    no_microphone: "No microphone was found on this device. You can write instead.",
    too_short: "That was very short. Hold on a little longer, or write instead.",
    nothing_heard: "I could not make out any words. Try again closer to the microphone, or write instead.",
    failed:
      "What you said could not be written down just now. Nothing was kept; try again, or write instead.",
    limit: "This month's speaking time is used. You can still write here.",
  },
  dismiss: "Close",
  /** When speaking is not on offer: one clear line, never a button that does nothing. */
  unavailable: {
    provider_has_no_audio: (provider: string | null) =>
      `${provider ?? "Your provider"} does not take audio, so here you write. Speaking works with the included assistant, or with your own key from OpenRouter, OpenAI, Groq or Google.`,
    provider_unknown: (provider: string | null) =>
      `sintr does not know how to ask ${provider ?? "your provider"} to write down speech, so here you write. Speaking works with your own key from OpenRouter, OpenAI, Groq or Google.`,
    off: () => "Speaking is turned off on this sintr, so here you write.",
    not_configured: () => "",
  },
  limit: (next: string) =>
    `This month's speaking time is used. You can still write here; it starts again on ${next}.`,
  left: (minutes: number) =>
    minutes <= 1
      ? "Less than a minute of speaking left this month."
      : `${minutes} minutes of speaking left this month.`,
  privacy: (who: string) =>
    `What you say is written down by ${who}, and the recording is dropped once it is: sintr never keeps it.`,
} as const;
