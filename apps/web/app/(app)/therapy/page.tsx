import type { TherapyNoteKind } from "@sintr/core";
import type { Metadata } from "next";
import { EmptyState, PageHeading } from "@/components/empty-state";
import { weekday } from "@/lib/format";
import { requireScope } from "@/lib/server/runtime";

export const metadata: Metadata = { title: "Therapy" };

const KIND_LABEL: Record<TherapyNoteKind, string> = {
  session: "Session note",
  goal: "Goal",
  theme: "Theme",
  task: "Task",
  to_bring: "To bring up",
};

export default async function TherapyPage() {
  const { scope } = await requireScope();
  const [settings, notes] = await Promise.all([scope.therapySettings.get(), scope.therapyNotes.list()]);
  const schedule =
    settings.sessionDay !== null
      ? `${weekday(settings.sessionDay)}${settings.sessionTime ? ` at ${settings.sessionTime}` : ""}`
      : null;

  return (
    <>
      <PageHeading
        title="Therapy"
        lede="The context of your therapy, kept for you and for the next session."
      />
      {!schedule && !settings.therapistName && notes.length === 0 ? (
        <EmptyState title="Nothing about your therapy yet.">
          <p>
            Your session day, your therapist&apos;s contact, and the goals and tasks you agree on can live
            here. The report before each session is prepared from it.
          </p>
        </EmptyState>
      ) : (
        <div className="space-y-10">
          <dl className="border-t border-ink">
            {settings.therapistName ? (
              <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-5 border-b border-rule py-4">
                <dt className="text-caption text-ink-3">Therapist</dt>
                <dd className="font-serif text-ink">{settings.therapistName}</dd>
              </div>
            ) : null}
            {schedule ? (
              <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-5 border-b border-rule py-4">
                <dt className="text-caption text-ink-3">Sessions</dt>
                <dd className="font-serif text-ink">{schedule}</dd>
              </div>
            ) : null}
          </dl>
          {notes.length > 0 ? (
            <ul className="border-t border-rule">
              {notes.map((note) => (
                <li key={note.id} className="border-b border-rule py-4">
                  <p className="text-caption text-ink-3">{KIND_LABEL[note.kind]}</p>
                  <p className="mt-1 font-serif text-ink">{note.body}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </>
  );
}
