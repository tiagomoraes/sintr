import {
  localDay,
  nextSeriesDay,
  preparationTime,
  reportLanguage,
  sessionsOn,
  upcomingSession,
  weekdayOf,
  zonedTime,
  type SessionSeries,
} from "@sintr/core";
import type { Metadata } from "next";
import { PageHeading } from "@/components/empty-state";
import type { CalendarView, SessionView } from "@/components/therapy/calendar-nav";
import { TherapyCalendar } from "@/components/therapy/calendar";
import { TherapyForm } from "@/components/therapy/therapy-form";
import { ZoneForm } from "@/components/therapy/zone-form";
import { addDays, addMonths, calendarState, monthOf, sessionKey, weekStartOf } from "@/lib/calendar";
import { formatDate, formatMoment, formatMonth, intlOf, languageName } from "@/lib/format";
import { requireScope, runtime } from "@/lib/server/runtime";
import { isLead } from "@/lib/therapy";
import { currentLanguage, getMessages } from "@/lib/server/language";
import type { Messages } from "@/messages";
import { saveTherapy } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).therapy.title };
}

const TIMEZONES = Intl.supportedValuesOf("timeZone");
/** How many sessions "Coming up" lists, cancelled ones among them. */
const COMING_UP = 5;

/** A rhythm still going on, or a single session still to come, as a sentence. */
function rhythmOf(series: SessionSeries, t: Messages["therapy"]["calendar"], language: string): string {
  const R = t.rhythm;
  switch (series.repeat) {
    case "once":
      return R.once(formatDate(series.startsOn, language), series.time);
    case "weekly":
      return R.weekly(weekdayOf(series.startsOn), series.time);
    case "fortnightly":
      return R.fortnightly(weekdayOf(series.startsOn), series.time);
    case "every_15_days":
      return R.every_15_days(series.time);
    case "weekdays":
      return R.weekdays(series.weekdays, series.time);
  }
}

/** The time most sessions are at, offered for a new one; 18:00 for a calendar still empty. */
function usualTime(series: readonly SessionSeries[]): string {
  const counts = new Map<string, number>();
  for (const one of series) counts.set(one.time, (counts.get(one.time) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "18:00";
}

export default async function TherapyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getMessages();
  const language = await currentLanguage();
  const { scope } = await requireScope();
  const [settings, schedule, profile, notes, account, query] = await Promise.all([
    scope.therapySettings.get(),
    scope.sessions.schedule(),
    scope.profile.get(),
    scope.therapyNotes.list(),
    scope.profile.account(),
    searchParams,
  ]);
  const zone = profile.timezone;
  const locale = { language: language.intl, timezone: zone };
  const now = new Date();
  const today = localDay(now, zone);
  const session = upcomingSession(schedule, zone, now);
  const prepared = session ? preparationTime(schedule, session) : null;
  const timezones = TIMEZONES.includes(zone) ? TIMEZONES : [zone, ...TIMEZONES];
  const next =
    session && prepared
      ? t.therapy.next(formatMoment(prepared, locale), formatMoment(session, locale))
      : null;

  // The months the page holds: a little before the one shown and a year after it, and today's among them.
  const state = calendarState(
    { get: (name) => (typeof query[name] === "string" ? query[name] : null) },
    today,
  );
  const shownFirst = addMonths(state.month, -3);
  const shownLast = addMonths(state.month, 12);
  const first = monthOf(today) < shownFirst ? monthOf(today) : shownFirst;
  const last = monthOf(today) > shownLast ? monthOf(today) : shownLast;
  const titles: Record<string, string> = {};
  for (let month = first; month <= last; month = addMonths(month, 1)) {
    titles[month] = formatMonth(month, language.code);
  }
  const lastDay = addDays(`${addMonths(last, 1)}-01`, -1);
  // Reach a week outside the months, for the days a month's grid shows of its neighbours.
  const held = sessionsOn(schedule, zone, addDays(`${first}-01`, -7), addDays(lastDay, 7));
  const byId = new Map(schedule.series.map((series) => [series.id, series]));
  const sessions: SessionView[] = held.map((one) => {
    const series = byId.get(one.seriesId)!;
    const [year, month, day] = one.occursOn.split("-").map(Number) as [number, number, number];
    const [hour, minute] = series.time.split(":").map(Number) as [number, number];
    const passed = one.at.getTime() <= now.getTime();
    return {
      key: sessionKey(one.seriesId, one.occursOn),
      seriesId: one.seriesId,
      occursOn: one.occursOn,
      on: one.on,
      time: one.time,
      moved: one.moved,
      cancelled: one.cancelled,
      passed,
      next: !one.cancelled && session !== null && one.at.getTime() === session.getTime(),
      repeat: series.repeat,
      weekdays: series.weekdays,
      when: formatMoment(one.at, locale),
      from: one.moved ? formatMoment(zonedTime({ year, month, day, hour, minute }, zone), locale) : null,
      report: passed || one.cancelled ? null : formatMoment(preparationTime(schedule, one.at), locale),
    };
  });
  const going = schedule.series.filter((series) => nextSeriesDay(series, today) !== null);
  const view: CalendarView = {
    today,
    weekStart: weekStartOf(intlOf(language.code)),
    months: { first, last, titles },
    sessions,
    comingUp: sessions
      .filter((one) => !one.passed)
      .slice(0, COMING_UP)
      .map((one) => one.key),
    summary: t.therapy.calendar.summary(
      going.map((series) => rhythmOf(series, t.therapy.calendar, language.code)),
    ),
    usualTime: usualTime(schedule.series),
  };

  return (
    <>
      <PageHeading title={t.therapy.title} lede={t.therapy.lede} />
      <p role="status" className="-mt-4 mb-12 max-w-[36em] text-[0.9688rem] text-ink-2 md:-mt-6">
        {next ? (
          <>
            {next[0]}
            <span className="font-serif italic text-ink">{next[1]}</span>
            {next[2]}
          </>
        ) : (
          t.therapy.noNext
        )}
      </p>
      <TherapyCalendar
        view={view}
        footer={<ZoneForm zone={zone} month={state.month} timezones={timezones} />}
      />
      <div className="mt-16 max-w-[40rem]">
        <TherapyForm
          save={saveTherapy}
          summaries={{
            therapist: t.therapy.therapist.summary(
              settings.therapistName,
              settings.therapistContact,
              settings.deliveryChannel === "email",
            ),
            report: t.therapy.report.summary(
              isLead(settings.reportLeadMinutes) ? t.therapy.report.leads[settings.reportLeadMinutes] : "",
              languageName(reportLanguage(profile.reportLanguage ?? language.code), language.code),
              profile.displayName,
            ),
          }}
          emailAvailable={runtime().email.available}
          emailVerified={account.emailVerified}
          readIn={languageName(language.code, language.code)}
          defaults={{
            displayName: profile.displayName ?? "",
            language: profile.reportLanguage ? reportLanguage(profile.reportLanguage) : "",
            therapistName: settings.therapistName ?? "",
            therapistEmail: settings.therapistContact ?? "",
            reportLeadMinutes: settings.reportLeadMinutes,
            deliveryChannel: settings.deliveryChannel,
            reportNoticeEmail: settings.reportNoticeEmail,
          }}
        />
      </div>
      {notes.length > 0 ? (
        <section aria-labelledby="context-title" className="mt-16 max-w-[40rem] border-t border-rule pt-10">
          <h2 id="context-title" className="font-serif text-title-small font-normal text-ink">
            {t.therapy.notes.title}
          </h2>
          <ul className="mt-6 border-t border-rule">
            {notes.map((note) => (
              <li key={note.id} className="border-b border-rule py-4">
                <p className="text-caption text-ink-3">{t.therapy.notes.kinds[note.kind]}</p>
                <p className="mt-1 whitespace-pre-line font-serif text-ink">{note.body}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
