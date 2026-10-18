/** How long before the session the report is prepared, in minutes, as offered. */
export const LEADS = [
  { minutes: 30, label: "30 minutes before" },
  { minutes: 60, label: "1 hour before" },
  { minutes: 120, label: "2 hours before" },
  { minutes: 180, label: "3 hours before" },
  { minutes: 360, label: "6 hours before" },
  { minutes: 720, label: "12 hours before" },
  { minutes: 1440, label: "A day before" },
  { minutes: 2880, label: "Two days before" },
] as const;

/** The report's languages: the person's words stay as written, whatever this is. */
export const REPORT_LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "pt", label: "Português" },
  { value: "es", label: "Español" },
] as const;
