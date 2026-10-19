import { linkStyles } from "@sintr/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { KeyList } from "@/components/connect/key-list";
import { PageHeading } from "@/components/empty-state";
import { EmailStatus } from "@/components/account/email-status";
import { AssistantSection } from "@/components/settings/assistant-section";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { assistantState } from "@/lib/server/assistant";
import { workingKeys } from "@/lib/server/keys";
import { requireScope, runtime } from "@/lib/server/runtime";
import { returnToIncludedAssistant, saveAssistant, savePreferences, testAssistant } from "./actions";

export const metadata: Metadata = { title: "Settings" };

const TIMEZONES = Intl.supportedValuesOf("timeZone");

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { scope } = await requireScope();
  // Only what may be shown: the key is reduced to a hint on the server.
  const [settings, assistant, profile, account, params, keys, practice] = await Promise.all([
    scope.agentSettings.get(),
    assistantState(scope),
    scope.profile.get(),
    scope.profile.account(),
    searchParams,
    workingKeys(scope),
    scope.practice.get(),
  ]);
  const timezones = TIMEZONES.includes(profile.timezone) ? TIMEZONES : [profile.timezone, ...TIMEZONES];

  return (
    <>
      <PageHeading title="Settings" />
      <section aria-labelledby="assistant-title" className="max-w-[40rem]">
        <h2 id="assistant-title" className="font-serif text-title-small font-normal text-ink">
          The assistant
        </h2>
        <AssistantSection
          state={assistant}
          settings={settings}
          openDoor={params.key === "own"}
          save={saveAssistant}
          test={testAssistant}
          back={returnToIncludedAssistant}
          rehearsal={runtime().config.fakeAgent}
        />
      </section>
      <section aria-labelledby="keys-title" className="mt-16 max-w-[40rem] border-t border-rule pt-12">
        <h2 id="keys-title" className="font-serif text-title-small font-normal text-ink">
          Assistants you connected
        </h2>
        <p className="mt-3 text-ink-2">
          Claude, ChatGPT, Gemini or Hermes can keep entries here for you, each with its own key.{" "}
          <Link href="/connect" className={linkStyles}>
            {keys.length ? "Connect another" : "Connect one"}
          </Link>
        </p>
        <div className="mt-6">
          {keys.length ? (
            <KeyList keys={keys} />
          ) : (
            <p className="text-[0.9375rem] text-ink-3">No assistant is connected.</p>
          )}
        </div>
      </section>
      <section aria-labelledby="email-title" className="mt-16 max-w-[40rem] border-t border-rule pt-12">
        <h2 id="email-title" className="font-serif text-title-small font-normal text-ink">
          Your email
        </h2>
        <div className="mt-6">
          <EmailStatus
            email={account.email}
            verified={account.emailVerified}
            available={runtime().email.available}
            justVerified={params.verified === "1"}
          />
        </div>
      </section>
      <section aria-labelledby="practice-title" className="mt-16 max-w-[40rem] border-t border-rule pt-12">
        <h2 id="practice-title" className="font-serif text-title-small font-normal text-ink">
          {practice ? "Your practice" : "Are you a therapist?"}
        </h2>
        <p className="mt-3 text-ink-2">
          {practice ? (
            <>
              Your practice, {practice.professionalName}, receives the reports your patients share with you.{" "}
              <Link href="/practice" className={linkStyles}>
                Open the dashboard
              </Link>
            </>
          ) : (
            <>
              Open a practice on this account to receive the reports your patients choose to share with you.
              Your own diary stays as it is.{" "}
              <Link href="/practice" className={linkStyles}>
                Open a practice
              </Link>
            </>
          )}
        </p>
      </section>
      <section aria-labelledby="preferences-title" className="mt-16 max-w-[40rem] border-t border-rule pt-12">
        <h2 id="preferences-title" className="font-serif text-title-small font-normal text-ink">
          Time and conversations
        </h2>
        <div className="mt-8">
          <PreferencesForm
            timezone={profile.timezone}
            timezones={timezones}
            retentionDays={settings.conversationRetentionDays}
            save={savePreferences}
          />
        </div>
      </section>
    </>
  );
}
