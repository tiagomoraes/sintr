import "server-only";
import { type KnownReport, type Report, type UserScope } from "@sintr/core";
import { renderPdf } from "@sintr/core/pdf";
import { runtime } from "./runtime";

/** Print a report document with the configured Chromium. */
export function printPdf(html: string): Promise<Uint8Array> {
  return renderPdf(html, { executablePath: runtime().config.chromiumPath });
}

/** What the planner needs of the person's recent reports. */
export function known(reports: readonly Report[]): KnownReport[] {
  return reports.slice(0, 20).map((r) => ({
    id: r.id,
    status: r.status,
    sessionAt: r.sessionAt,
    periodStart: r.periodStart,
    periodEnd: r.periodEnd,
    editedAt: r.editedAt,
  }));
}

/** The schedule as the planner reads it. */
export async function scheduleOf(scope: UserScope) {
  const [settings, profile] = await Promise.all([scope.therapySettings.get(), scope.profile.get()]);
  return { settings, profile, timeZone: profile.timezone };
}
