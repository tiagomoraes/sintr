import type { Metadata } from "next";
import { PageHeading } from "@/components/empty-state";
import { AssistantForm } from "@/components/settings/assistant-form";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { requireScope, runtime } from "@/lib/server/runtime";
import { saveAssistant, savePreferences, testAssistant } from "./actions";

export const metadata: Metadata = { title: "Settings" };

const TIMEZONES = Intl.supportedValuesOf("timeZone");

export default async function SettingsPage() {
  const { scope } = await requireScope();
  // Only what may be shown: the key is reduced to a hint on the server.
  const [settings, profile] = await Promise.all([scope.agentSettings.get(), scope.profile.get()]);
  const timezones = TIMEZONES.includes(profile.timezone) ? TIMEZONES : [profile.timezone, ...TIMEZONES];

  return (
    <>
      <PageHeading title="Settings" />
      <section aria-labelledby="assistant-title" className="max-w-[40rem]">
        <h2 id="assistant-title" className="font-serif text-title-small font-normal text-ink">
          The assistant
        </h2>
        <p className="mt-3 text-ink-2">
          sintr talks to the model you choose, with your own key. The key is encrypted with your own data key
          before it is stored, is never shown again, and is used only to reach that provider. What you write
          in a conversation is sent to it, and nowhere else.
        </p>
        <div className="mt-8">
          <AssistantForm
            settings={settings}
            save={saveAssistant}
            test={testAssistant}
            rehearsal={runtime().config.fakeAgent}
          />
        </div>
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
