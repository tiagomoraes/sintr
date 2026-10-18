"use client";

import type { ReportContent, ReportMoment, ReportPattern, ReportTopic } from "@sintr/core";
import { Button, FieldError, FieldHint, Input, Textarea, Verbatim, linkStyles } from "@sintr/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

type Keyed<T> = T & { key: number };

// Keys for list items the person adds and removes; unique within the page.
let lastKey = 0;
function newKey(): number {
  lastKey += 1;
  return lastKey;
}
function keyed<T>(items: readonly T[]): Keyed<T>[] {
  return items.map((item) => ({ ...item, key: newKey() }));
}

function Block({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="border-t border-rule pt-8">
      <h2 className="font-serif text-title-small font-normal text-ink">{title}</h2>
      {hint ? <p className="mt-1 max-w-[38em] text-caption text-ink-3">{hint}</p> : null}
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function Remove({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="shrink-0 rounded-pill border border-rule px-3 py-1 text-[0.8125rem] font-medium text-ink-2 hover:border-rule-strong hover:text-ink"
    >
      Remove
    </button>
  );
}

function Add({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-8 items-center rounded-pill border border-rule px-3.5 text-[0.8125rem] font-medium text-ink-2 hover:border-rule-strong hover:text-ink"
    >
      {children}
    </button>
  );
}

/**
 * Change a report's words before approving it. The prose is the person's
 * to rewrite; a moment's thoughts, emotions and intensities are their
 * entry's, shown as they are, and the check-in notes can be kept or left
 * out but not rewritten. Saving keeps what the report said before.
 */
export function ReportEditor({ id, content }: { id: string; content: ReportContent }) {
  const router = useRouter();

  const [week, setWeek] = useState(content.week);
  const [topics, setTopics] = useState<Keyed<ReportTopic>[]>(() => keyed(content.topics));
  const [mood, setMood] = useState(content.mood);
  const [keptNotes, setKeptNotes] = useState(() => new Set(content.notes.map((n) => n.checkinId)));
  const [momentsIntro, setMomentsIntro] = useState(content.momentsIntro);
  const [moments, setMoments] = useState<ReportMoment[]>(content.moments);
  const [patterns, setPatterns] = useState<Keyed<ReportPattern>[]>(() => keyed(content.patterns));
  const [helped, setHelped] = useState<Keyed<{ text: string }>[]>(() =>
    keyed(content.helped.map((text) => ({ text }))),
  );
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const setMoment = (entryId: string, field: "title" | "happened" | "context" | "did", value: string) =>
    setMoments((list) =>
      list.map((m) =>
        m.entryId === entryId ? { ...m, [field]: field === "title" ? value : value || null } : m,
      ),
    );

  const save = async () => {
    setSaving(true);
    setFailure(null);
    const edited: ReportContent = {
      ...content,
      week: week.trim(),
      topics: topics.map(({ text, suggested }) => ({ text: text.trim(), suggested })).filter((t) => t.text),
      mood: mood.trim(),
      notes: content.notes.filter((n) => keptNotes.has(n.checkinId)),
      momentsIntro: momentsIntro.trim(),
      moments: moments.map((m) => ({
        ...m,
        title: m.title.trim(),
        happened: m.happened?.trim() || null,
        context: m.context?.trim() || null,
        did: m.did?.trim() || null,
      })),
      patterns: patterns
        .map(({ when, text }) => ({ when: when.trim(), text: text.trim() }))
        .filter((p) => p.text),
      helped: helped.map((h) => h.text.trim()).filter(Boolean),
    };
    const response = await fetch(`/api/reports/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: edited }),
    });
    setSaving(false);
    if (response.ok) {
      router.push(`/reports/${id}`);
      router.refresh();
      return;
    }
    const { code } = (await response.json().catch(() => ({}))) as { code?: string };
    setFailure(
      code === "invalid_state"
        ? "This report was sent, so it cannot change any more."
        : "Some of it could not be kept as it is. Check the fields and try again.",
    );
  };

  return (
    <form
      className="max-w-[44rem] space-y-10"
      aria-label="Change the report"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <Block
        title="How the week went"
        hint="Three to six plain lines. Double quotes mark your own words: use them only for words in your diary as you wrote them."
      >
        <Textarea
          aria-label="How the week went"
          rows={6}
          value={week}
          onChange={(e) => setWeek(e.target.value)}
        />
      </Block>

      <Block title="For the session" hint="Your own topics first, in the order you want them.">
        {topics.map((topic) => (
          <div key={topic.key} className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <Textarea
                aria-label="A topic for the session"
                rows={2}
                value={topic.text}
                onChange={(e) =>
                  setTopics((list) =>
                    list.map((t) => (t.key === topic.key ? { ...t, text: e.target.value } : t)),
                  )
                }
              />
              {topic.suggested ? (
                <FieldHint>Suggested by sintr. Keep it only if you want to talk about it.</FieldHint>
              ) : null}
            </div>
            <Remove
              label="Remove this topic"
              onClick={() => setTopics((list) => list.filter((t) => t.key !== topic.key))}
            />
          </div>
        ))}
        <Add onClick={() => setTopics((list) => [...list, { key: newKey(), text: "", suggested: false }])}>
          Add a topic
        </Add>
      </Block>

      <Block
        title="Mood, energy and sleep"
        hint="A few lines that read the numbers. The numbers, the chart and the day-by-day grid are computed from your check-ins."
      >
        <Textarea
          aria-label="Mood, energy and sleep"
          rows={4}
          value={mood}
          onChange={(e) => setMood(e.target.value)}
        />
        {content.notes.length ? (
          <fieldset className="min-w-0 border-0 p-0">
            <legend className="p-0 text-label font-medium text-ink">In the day&apos;s own words</legend>
            <div className="mt-3 space-y-2">
              {content.notes.map((note) => (
                <label key={note.checkinId} className="flex items-start gap-3 text-[0.9688rem] text-ink-2">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={keptNotes.has(note.checkinId)}
                    onChange={(e) =>
                      setKeptNotes((set) => {
                        const next = new Set(set);
                        if (e.target.checked) next.add(note.checkinId);
                        else next.delete(note.checkinId);
                        return next;
                      })
                    }
                  />
                  <span>
                    <span className="mr-2 text-caption text-ink-3">{note.day}</span>
                    <Verbatim className="font-serif text-ink">{note.note}</Verbatim>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
      </Block>

      <Block
        title="Moments that stood out"
        hint="What went through your mind and how it felt come from each entry, word for word. To change them, change the entry and prepare the report again."
      >
        <div>
          <label htmlFor="moments-intro" className="block text-label font-medium text-ink">
            How they were chosen
          </label>
          <Input
            id="moments-intro"
            className="mt-2"
            value={momentsIntro}
            onChange={(e) => setMomentsIntro(e.target.value)}
          />
        </div>
        {moments.map((moment) => (
          <div key={moment.entryId} className="rounded-file border border-rule px-5 py-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <label className="block text-label font-medium text-ink">
                  Title
                  <Input
                    className="mt-2"
                    value={moment.title}
                    onChange={(e) => setMoment(moment.entryId, "title", e.target.value)}
                  />
                </label>
              </div>
              <Remove
                label={`Remove the moment ${moment.title}`}
                onClick={() => setMoments((list) => list.filter((m) => m.entryId !== moment.entryId))}
              />
            </div>
            {(["happened", "context", "did"] as const).map((field) => (
              <label key={field} className="mt-4 block text-label font-medium text-ink">
                {field === "happened" ? "What happened" : field === "context" ? "Context" : "What you did"}
                <Textarea
                  className="mt-2"
                  rows={2}
                  value={moment[field] ?? ""}
                  onChange={(e) => setMoment(moment.entryId, field, e.target.value)}
                />
              </label>
            ))}
            {moment.thoughts.length ? (
              <div className="mt-4">
                <p className="text-caption text-ink-3">What went through your mind, from the entry</p>
                <ul className="m-0 mt-1 list-none space-y-1 p-0 font-serif text-ink">
                  {moment.thoughts.map((thought, i) => (
                    <li key={i}>
                      <Verbatim>{thought}</Verbatim>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {moment.felt.length ? (
              <p className="mt-3 text-caption text-ink-3">
                How it felt, from the entry:{" "}
                <span className="font-serif text-[1rem] text-ink">
                  {moment.felt
                    .map((e) => (e.intensity === null ? e.name : `${e.name} ${e.intensity}`))
                    .join(", ")}
                </span>
              </p>
            ) : null}
          </div>
        ))}
      </Block>

      <Block title="What repeated" hint="Each observation with its dates. What happened together, never why.">
        {patterns.map((pattern) => (
          <div key={pattern.key} className="flex items-start gap-3">
            <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[9rem_minmax(0,1fr)]">
              <Input
                aria-label="When"
                placeholder="Dates"
                value={pattern.when}
                onChange={(e) =>
                  setPatterns((list) =>
                    list.map((p) => (p.key === pattern.key ? { ...p, when: e.target.value } : p)),
                  )
                }
              />
              <Textarea
                aria-label="What repeated"
                rows={2}
                value={pattern.text}
                onChange={(e) =>
                  setPatterns((list) =>
                    list.map((p) => (p.key === pattern.key ? { ...p, text: e.target.value } : p)),
                  )
                }
              />
            </div>
            <Remove
              label="Remove this observation"
              onClick={() => setPatterns((list) => list.filter((p) => p.key !== pattern.key))}
            />
          </div>
        ))}
        <Add onClick={() => setPatterns((list) => [...list, { key: newKey(), when: "", text: "" }])}>
          Add an observation
        </Add>
      </Block>

      <Block title="What helped" hint="As you recorded it, with its date.">
        {helped.map((item) => (
          <div key={item.key} className="flex items-start gap-3">
            <Textarea
              aria-label="What helped"
              rows={2}
              className="min-w-0 flex-1"
              value={item.text}
              onChange={(e) =>
                setHelped((list) =>
                  list.map((h) => (h.key === item.key ? { ...h, text: e.target.value } : h)),
                )
              }
            />
            <Remove
              label="Remove this"
              onClick={() => setHelped((list) => list.filter((h) => h.key !== item.key))}
            />
          </div>
        ))}
        <Add onClick={() => setHelped((list) => [...list, { key: newKey(), text: "" }])}>
          Add something that helped
        </Add>
      </Block>

      {failure ? <FieldError>{failure}</FieldError> : null}
      <div className="flex flex-wrap items-center gap-x-7 gap-y-3 border-t border-rule pt-8">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving" : "Save the changes"}
        </Button>
        <Link href={`/reports/${id}`} className={linkStyles}>
          Cancel
        </Link>
      </div>
      <p className="text-caption text-ink-3">
        The report becomes a draft again, to read and approve as it then reads. What it said before is kept
        with the date.
      </p>
    </form>
  );
}
