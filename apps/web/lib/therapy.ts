/**
 * How long before the session the report is prepared, in minutes, as offered.
 * Each is said in the catalog, `therapy.report.leads[minutes]`.
 */
export const LEADS = [30, 60, 120, 180, 360, 720, 1440, 2880] as const;
export type Lead = (typeof LEADS)[number];

export function isLead(minutes: number): minutes is Lead {
  return (LEADS as readonly number[]).includes(minutes);
}

/** The report's languages: the person's words stay as written, whatever this is. */
export const REPORT_LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "pt", label: "Português" },
  { value: "es", label: "Español" },
] as const;
