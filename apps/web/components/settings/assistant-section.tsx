import type { AgentSettings } from "@sintr/core";
import { Button, linkStyles } from "@sintr/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import type { AssistantFormState, ConnectionState } from "@/app/(app)/settings/actions";
import { counted } from "@/lib/plan";
import type { AssistantState } from "@/lib/server/assistant";
import type { VoiceView } from "@/lib/voice/view";
import { getMessages } from "@/lib/server/language";
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
export async function AssistantSection({
  state,
  settings,
  openDoor,
  save,
  test,
  back,
  rehearsal,
  voice,
}: {
  /** Speaking: who writes it down, or why it is not on offer. */
  voice: VoiceView;
  state: AssistantState;
  settings: AgentSettings;
  /** Arrived through "Use your own key". */
  openDoor: boolean;
  save: (state: AssistantFormState, form: FormData) => Promise<AssistantFormState>;
  test: (state: ConnectionState) => Promise<ConnectionState>;
  back: () => Promise<void>;
  rehearsal: boolean;
}) {
  const t = await getMessages();
  const S = t.settings.assistant;
  const form = <AssistantForm settings={settings} save={save} test={test} rehearsal={rehearsal} />;
  const keyNote = S.keyNote;
  const speaking =
    voice.kind === "ready"
      ? t.settings.voice.ready(voice.heardBy)
      : voice.kind === "limit"
        ? t.voice.limit(voice.next)
        : t.voice.unavailable[voice.reason](voice.provider);
  const voiceLine = speaking ? <p className="mt-3 text-[0.9375rem] text-ink-2">{speaking}</p> : null;

  if (state.kind === "house") {
    const { messages, plan } = state;
    return (
      <>
        <p className="mt-3 text-ink-2">{S.included(state.name)}</p>
        {voiceLine}
        <p className="mt-3 text-ink-2">
          {S.plan(plan.label)}
          {messages.limit === null
            ? S.planNoLimit
            : S.planUsed(messages.used, counted(messages.limit, "message", "messages"))}{" "}
          <Link href="/plan" className={linkStyles}>
            {S.planLink}
          </Link>
        </p>
        <OwnKeyDoor open={openDoor} summary={S.door}>
          <p className="mb-8 text-[0.9375rem] text-ink-2">
            {S.doorBody} {keyNote}
          </p>
          {form}
        </OwnKeyDoor>
      </>
    );
  }

  if (state.kind === "own") {
    return (
      <>
        <p className="mt-3 text-ink-2">{S.own(providerName(settings), state.model, state.house)}</p>
        {voiceLine}
        {state.house ? (
          <form action={back} className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
            <Button type="submit" variant="outline" size="sm">
              {S.back}
            </Button>
            <span className="text-[0.9375rem] text-ink-3">{S.backNote}</span>
          </form>
        ) : null}
        <OwnKeyDoor open summary={S.ownDoor}>
          <p className="mb-8 text-[0.9375rem] text-ink-2">{keyNote}</p>
          {form}
        </OwnKeyDoor>
      </>
    );
  }

  return (
    <>
      <p className="mt-3 text-ink-2">
        {S.none} {keyNote}
      </p>
      <OwnKeyDoor open summary={S.ownDoor}>
        {form}
      </OwnKeyDoor>
    </>
  );
}
