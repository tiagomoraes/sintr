/**
 * What the report writer may write: the prose of the six sections and the
 * choice of moments. Everything else in a report (the moments' thoughts,
 * emotions and intensities, the numbers, the check-in notes) is copied from
 * the diary by sintr, never typed by the model.
 */
import { z } from "zod";

const Line = z.string().max(1_200);

export const ReportDraft = z.object({
  week: z
    .string()
    .max(1_400)
    .describe(
      "How the week went: 3 to 6 warm, plain lines, like a short note to someone who knows the person. Name the hard moments and the best one, by weekday. No numbers, no causes, no labels.",
    ),
  topics: z
    .array(
      z.object({
        text: Line.describe("A topic for the session, in the person's words when it is theirs."),
        suggested: z
          .boolean()
          .describe(
            "True when you propose it (a theme that repeated, last session's task); false when it is the person's own.",
          ),
      }),
    )
    .max(6)
    .describe(
      "2 to 4 topics for the session: the person's own first, in their words; then your suggestions.",
    ),
  mood: z
    .string()
    .max(1_000)
    .describe(
      "2 to 4 lines that read the numbers: where the week went up and down, which nights were short, which days have no check-in. Never estimate a missing day; never say one measure caused another.",
    ),
  momentsIntro: Line.describe("One line saying how the moments were chosen."),
  moments: z
    .array(
      z.object({
        entryId: z.string().max(100).describe("The id of the entry this moment is, from the digest."),
        title: z.string().max(120).describe("A short, neutral title in the report's language."),
        happened: z
          .string()
          .max(600)
          .optional()
          .describe(
            "One or two sentences faithful to the entry's situation. Leave out to keep the entry's own words.",
          ),
        did: z
          .string()
          .max(400)
          .optional()
          .describe(
            "What the person did next, faithful to the entry. Leave out to keep the entry's own words.",
          ),
      }),
    )
    .max(5)
    .describe("3 to 5 entries of the period, chosen by weight, including a good moment when there was one."),
  patterns: z
    .array(
      z.object({
        when: z
          .string()
          .max(60)
          .describe("The dates, such as 11 and 18/10. Two or more occurrences make a pattern."),
        text: Line.describe(
          "What co-occurred, never why. The person's words in double quotes, exactly as recorded.",
        ),
      }),
    )
    .max(6),
  helped: z
    .array(Line)
    .max(6)
    .describe(
      "What made things lighter, as the person recorded it, dated; 'helped' only where they said so or the numbers moved.",
    ),
});
export type ReportDraft = z.infer<typeof ReportDraft>;
