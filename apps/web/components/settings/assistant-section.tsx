import type { AgentSettings } from "@sintr/core";
import { Button, linkStyles } from "@sintr/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import type { AssistantFormState, ConnectionState } from "@/app/(app)/settings/actions";
import { counted } from "@/lib/plan";
import type { AssistantState } from "@/lib/server/assistant";
import { AssistantForm } from "./assistant-form";

/** "Anthropic", "Google", or the host of an OpenAI-compatible endpoint. */
function providerName(settings: AgentSettings): string {
  if (settings.provider === "anthropic") return "Anthropic";
  if (settings.provider === "google") return "Google";
  try {
    return settings.baseUrl ? new URL(settings.baseUrl).hostname : "an OpenAI-compatible endpoint";
  } catch {
    return "an OpenAI-compatible endpoint";
  }
}

/** The small door: a closed disclosure on the main path, open when it is the only way or already in use. */
function OwnKeyDoor({ open, summary, children }: { open: boolean; summary: string; children: ReactNode }) {
  return (
    <details id="own-key" open={open} className="group mt-8 scroll-mt-8 border-t border-rule pt-6">
      <summary className="cursor-pointer list-none text-[0.9375rem] font-medium text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden="true"
          className="mr-2.5 inline-block size-[7px] -translate-y-px rotate-[-45deg] border-b-[1.5px] border-r-[1.5px] border-current transition-transform duration-[400ms] group-open:rotate-45"
        />
        {summary}
      </summary>
      <div className="mt-5">{children}</div>
    </details>
  );
}

/**
 * The assistant in Settings. With a house assistant, the main path asks for
 * nothing: it says the assistant is included and where the words go, and a
 * person's own key waits behind a small door. On the person's own key, one
 * line says what changed, with a way back. Without a house assistant (a
 * typical self-host), the key is the way in, and the door stands open.
 */
export function AssistantSection({
  state,
  settings,
  openDoor,
  save,
  test,
  back,
  rehearsal,
}: {
  state: AssistantState;
  settings: AgentSettings;
  /** Arrived through "Use your own key". */
  openDoor: boolean;
  save: (state: AssistantFormState, form: FormData) => Promise<AssistantFormState>;
  test: (state: ConnectionState) => Promise<ConnectionState>;
  back: () => Promise<void>;
  rehearsal: boolean;
}) {
  const form = <AssistantForm settings={settings} save={save} test={test} rehearsal={rehearsal} />;
  const keyNote =
    "The key is encrypted with your own data key before it is stored, is never shown again, and is used only to reach that provider.";

  if (state.kind === "house") {
    const { messages, plan } = state;
    return (
      <>
        <p className="mt-3 text-ink-2">
          The assistant is included. It runs on a model from {state.name}, through sintr&apos;s own account:
          what you write in a conversation is sent there to be answered, and nowhere else. You do not need a
          key.
        </p>
        <p className="mt-3 text-ink-2">
          You are on {plan.label}
          {messages.limit === null
            ? ", with no monthly limit."
            : `: ${messages.used} of ${counted(messages.limit, "message", "messages")} used this month.`}{" "}
          <Link href="/plan" className={linkStyles}>
            Your plan
          </Link>
        </p>
        <OwnKeyDoor open={openDoor} summary="Use your own key instead">
          <p className="mb-8 text-[0.9375rem] text-ink-2">
            Bring a key from a provider you choose, or a model on your own machine. Your conversations and
            reports then go to that provider, under your own agreement with it, and they do not count toward
            your plan: it is free here, and the provider bills you. {keyNote}
          </p>
          {form}
        </OwnKeyDoor>
      </>
    );
  }

  if (state.kind === "own") {
    return (
      <>
        <p className="mt-3 text-ink-2">
          You are using your own key, with {providerName(settings)} ({state.model}). What you write in a
          conversation goes to that provider, under your agreement with it
          {state.house ? ", and it does not count toward any plan." : ", and nowhere else."}
        </p>
        {state.house ? (
          <form action={back} className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
            <Button type="submit" variant="outline" size="sm">
              Go back to the included assistant
            </Button>
            <span className="text-[0.9375rem] text-ink-3">Your key is removed from sintr.</span>
          </form>
        ) : null}
        <OwnKeyDoor open summary="Your own key">
          <p className="mb-8 text-[0.9375rem] text-ink-2">{keyNote}</p>
          {form}
        </OwnKeyDoor>
      </>
    );
  }

  return (
    <>
      <p className="mt-3 text-ink-2">
        This sintr has no assistant of its own, so it talks to a model you choose, with your own key. What you
        write in a conversation is sent to that provider, and nowhere else. {keyNote}
      </p>
      <OwnKeyDoor open summary="Your own key">
        {form}
      </OwnKeyDoor>
    </>
  );
}
