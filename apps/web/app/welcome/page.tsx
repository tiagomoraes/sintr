import { localDay, nextSeriesDay, practiceLine, weekdayOf } from "@sintr/core";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WelcomeFlow, type WelcomeInvite } from "@/components/welcome/welcome-flow";
import { safeNext } from "@/lib/redirect";
import { practiceDetails, practiceWho } from "@/lib/sharing";
import { tooManyLookups } from "@/lib/server/join";
import { requireScope, runtime } from "@/lib/server/runtime";
import { getMessages } from "@/lib/server/language";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).welcome.title };
}

const TIMEZONES = Intl.supportedValuesOf("timeZone");

/** The code inside `/join/<code>`, or null when the address cannot be read. */
function inviteCode(path: string): string | null {
  try {
    return decodeURIComponent(path.slice("/join/".length));
  } catch {
    return null;
  }
}

/**
 * The welcome after signing up: a few questions, one a screen, each able
 * to wait. A practice's invite the person arrived with is part of it; a
 * professional answering a patient's invite goes straight to that invite.
 * From Settings (`?again=1`) it runs again over the answers already given.
 */
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, scope } = await requireScope();
  const query = await searchParams;
  const raw = query.next;
  const next = typeof raw === "string" ? safeNext(raw) : null;
  const code = next?.startsWith("/join/") ? inviteCode(next) : null;
  const [profile, therapy, calendar] = await Promise.all([
    scope.profile.get(),
    scope.therapySettings.get(),
    scope.sessions.calendar(),
  ]);
  // The welcome asks for one weekly rhythm: it is filled in when the calendar holds just that.
  const today = localDay(new Date(), profile.timezone);
  const going = calendar.series.filter((series) => nextSeriesDay(series, today) !== null);
  const weekly = going.length === 1 && going[0]!.repeat === "weekly" ? going[0]! : null;

  let invite: WelcomeInvite | null = null;
  if (code && !(await tooManyLookups())) {
    const preview = await runtime().repositories.previewInvite(code, user.id);
    if (preview.status === "valid" && !preview.own && preview.direction === "person_to_practice") {
      // Not a diary to set up: a professional on the way to accept a person's invite.
      await scope.profile.markOnboarded();
      redirect(next!);
    }
    if (preview.status === "valid" && !preview.own && preview.direction === "practice_to_person") {
      invite = {
        code,
        who: practiceWho(preview.practice),
        professionalName: preview.practice.professionalName,
        details: practiceDetails(preview.practice),
        shown: practiceLine(preview.practice),
        reportName: profile.displayName,
      };
    }
  }

  return (
    <WelcomeFlow
      next={next}
      again={query.again === "1" && invite === null}
      invite={invite}
      timezones={TIMEZONES.includes(profile.timezone) ? TIMEZONES : [profile.timezone, ...TIMEZONES]}
      saved={{
        name: profile.preferredName ?? "",
        therapist: therapy.therapistName ?? "",
        day: weekly ? String(weekdayOf(weekly.startsOn)) : "",
        time: weekly?.time ?? "",
        timezone: profile.timezone,
      }}
    />
  );
}
