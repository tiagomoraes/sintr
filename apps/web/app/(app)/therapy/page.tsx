import { preparationTime, reportLanguage, upcomingSession, type TherapyNoteKind } from "@sintr/core";
import type { Metadata } from "next";
import { PageHeading } from "@/components/empty-state";
import { TherapyForm } from "@/components/therapy/therapy-form";
import { formatMoment, languageName } from "@/lib/format";
import { requireScope, runtime } from "@/lib/server/runtime";
import { LEADS } from "@/lib/therapy";
import { toLocalInput } from "@/lib/time";
import { currentLanguage, getMessages } from "@/lib/server/language";
import { saveTherapy } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).therapy.title };
}

const KIND_LABEL: Record<TherapyNoteKind, string> = {
  session: "Session note",
  goal: "Goal",
  theme: "Theme",
  task: "Task",
  to_bring: "To bring up",
};

const TIMEZONES = Intl.supportedValuesOf("timeZone");

export default async function TherapyPage() {
  const t = await getMessages();
  const language = await currentLanguage();
  const { scope } = await requireScope();
  const [settings, profile, notes, account] = await Promise.all([
    scope.therapySettings.get(),
    scope.profile.get(),
    scope.therapyNotes.list(),
    scope.profile.account(),
  ]);
  const locale = { language: "en-GB", timezone: profile.timezone };
  const session = upcomingSession(settings, profile.timezone, new Date());
  const prepared = session ? preparationTime(settings, session) : null;
  const timezones = TIMEZONES.includes(profile.timezone) ? TIMEZONES : [profile.timezone, ...TIMEZONES];
  const upcomingMoved =
    settings.nextSessionAt && settings.nextSessionAt > new Date() ? settings.nextSessionAt : null;

  return (
    <>
      <PageHeading title={t.therapy.title} lede={t.therapy.lede} />
      <p role="status" className="-mt-4 mb-12 max-w-[36em] text-[0.9688rem] text-ink-2 md:-mt-6">
        {session && prepared ? (
          <>
            The next report will be prepared on{" "}
            <span className="font-serif italic text-ink">{formatMoment(prepared, locale)}</span>, for the
            session of {formatMoment(session, locale)}.
          </>
        ) : (
          "Without a session day and time, no report is prepared on its own. You can still prepare one from Reports whenever you want."
        )}
      </p>
      <div className="max-w-[40rem]">
        <TherapyForm
          save={saveTherapy}
          summaries={{
            sessions: t.therapy.sessions.summary(
              settings.sessionDay,
              settings.sessionTime,
              (profile.timezone.split("/").at(-1) ?? profile.timezone).replaceAll("_", " "),
            ),
            therapist: t.therapy.therapist.summary(
              settings.therapistName,
              settings.therapistContact,
              settings.deliveryChannel === "email",
            ),
            report: t.therapy.report.summary(
              LEADS.find((lead) => lead.minutes === settings.reportLeadMinutes)?.label ?? "",
              languageName(reportLanguage(profile.reportLanguage ?? language.code), language.code),
              profile.displayName,
            ),
          }}
          timezones={timezones}
          emailAvailable={runtime().email.available}
          emailVerified={account.emailVerified}
          readIn={languageName(language.code, language.code)}
          defaults={{
            displayName: profile.displayName ?? "",
            language: profile.reportLanguage ? reportLanguage(profile.reportLanguage) : "",
            timezone: profile.timezone,
            therapistName: settings.therapistName ?? "",
            therapistEmail: settings.therapistContact ?? "",
            sessionDay: settings.sessionDay,
            sessionTime: settings.sessionTime ?? "",
            reportLeadMinutes: settings.reportLeadMinutes,
            nextSessionAt: upcomingMoved ? toLocalInput(upcomingMoved, profile.timezone) : "",
            deliveryChannel: settings.deliveryChannel,
            reportNoticeEmail: settings.reportNoticeEmail,
          }}
        />
      </div>
      {notes.length > 0 ? (
        <section aria-labelledby="context-title" className="mt-16 max-w-[40rem] border-t border-rule pt-10">
          <h2 id="context-title" className="font-serif text-title-small font-normal text-ink">
            Goals, themes and things to bring up
          </h2>
          <ul className="mt-6 border-t border-rule">
            {notes.map((note) => (
              <li key={note.id} className="border-b border-rule py-4">
                <p className="text-caption text-ink-3">{KIND_LABEL[note.kind]}</p>
                <p className="mt-1 whitespace-pre-line font-serif text-ink">{note.body}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
