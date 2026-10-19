import { practiceLine } from "@sintr/core";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WelcomeFlow, type WelcomeInvite } from "@/components/welcome/welcome-flow";
import { safeNext } from "@/lib/redirect";
import { practiceDetails, practiceWho } from "@/lib/sharing";
import { tooManyLookups } from "@/lib/server/join";
import { requireScope, runtime } from "@/lib/server/runtime";
import { t } from "@/messages";

export const metadata: Metadata = { title: t.welcome.title };

const TIMEZONES = Intl.supportedValuesOf("timeZone");

/**
 * The welcome after signing up: a few questions, one a screen, each able
 * to wait. A practice's invite the person arrived with is part of it; a
 * professional answering a patient's invite goes straight to that invite.
 */
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, scope } = await requireScope();
  const raw = (await searchParams).next;
  const next = typeof raw === "string" ? safeNext(raw) : null;
  const code = next?.startsWith("/join/") ? decodeURIComponent(next.slice("/join/".length)) : null;

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
      };
    }
  }

  const [profile, therapy] = await Promise.all([scope.profile.get(), scope.therapySettings.get()]);
  return (
    <WelcomeFlow
      next={next}
      invite={invite}
      timezones={TIMEZONES.includes(profile.timezone) ? TIMEZONES : [profile.timezone, ...TIMEZONES]}
      saved={{
        name: profile.preferredName ?? "",
        therapist: therapy.therapistName ?? "",
        day: therapy.sessionDay === null ? "" : String(therapy.sessionDay),
        time: therapy.sessionTime ?? "",
        timezone: profile.timezone,
      }}
    />
  );
}
