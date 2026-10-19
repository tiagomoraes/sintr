/** The plan screen's new and adjusted lines. */
export const plan = {
  speaking: "Minutes of speaking written down",
  runOut: (next: string) =>
    `When they run out, nothing is lost. You can still write on your home, and what you write is kept as a draft entry in your own words; check-ins and your report keep working, prepared from what you wrote. The count starts again on ${next}.`,
} as const;
