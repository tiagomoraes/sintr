/**
 * The human labels of a thought record and a check-in. What the system asks
 * is said plainly; the person's answers are shown in their own words.
 */
export const ENTRY_LABELS = {
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
} as const;

export const CHECKIN_LABELS = {
  occurredAt: "When",
  mood: "Mood",
  energy: "Energy",
  anxiety: "Anxiety",
  sleepHours: "Sleep",
  sleepQuality: "How you slept",
  note: "Note",
} as const;

/** How a field is named inside a sentence: "Corrected what happened and how it felt." */
const IN_A_SENTENCE: Record<string, string> = {
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
  mood: "the mood",
  energy: "the energy",
  anxiety: "the anxiety",
  sleepHours: "the hours of sleep",
  sleepQuality: "how you slept",
  note: "the note",
};

export function fieldsInWords(fields: readonly string[]): string {
  const names = fields.map((field) => IN_A_SENTENCE[field] ?? field);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** Previous values as plain text, for "what it said before". Null when it was empty. */
export function valueInWords(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return value
      .map((item) => {
        if (item && typeof item === "object" && "name" in item) {
          const { name, intensity } = item as { name: unknown; intensity?: unknown };
          return typeof intensity === "number" ? `${String(name)}, ${intensity} of 100` : String(name);
        }
        return typeof item === "string" || typeof item === "number" ? String(item) : "";
      })
      .join("; ");
  }
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? String(value)
    : null;
}
