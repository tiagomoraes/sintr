import { IntensityChip, NotebookRow, Verbatim } from "@sintr/ui";
import { ENTRY_LABELS } from "@/lib/labels";

interface EmotionView {
  name: string;
  intensity?: number | null;
}

/** An entry, a saved record or a draft: every field optional. */
export interface EntryView {
  title?: string | null;
  situation?: string | null;
  thoughts?: string[] | null;
  emotions?: EmotionView[] | null;
  body?: string | null;
  behavior?: string | null;
  context?: string | null;
  tags?: string[] | null;
  notes?: string | null;
  hotThought?: string | null;
  evidenceFor?: string | null;
  evidenceAgainst?: string | null;
  alternative?: string | null;
  alternativeBelief?: number | null;
  emotionsAfter?: EmotionView[] | null;
}

function Emotions({ emotions }: { emotions: EmotionView[] }) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1.5 p-0">
      {emotions.map((emotion, index) => (
        <li key={`${emotion.name}-${index}`}>
          {emotion.name}
          {typeof emotion.intensity === "number" ? <IntensityChip value={emotion.intensity} /> : null}
        </li>
      ))}
    </ul>
  );
}

/** Words kept with their line breaks, as the person typed them. */
function Words({ children }: { children: string }) {
  return <span className="whitespace-pre-line">{children}</span>;
}

/**
 * The rows of a thought record inside a notebook card: Tier 1 first, then
 * the working of the thought if there is any. Quoted thoughts carry the
 * peach highlighter, because they are the person's own words.
 */
export function EntryRows({ entry }: { entry: EntryView }) {
  const tier2 =
    entry.hotThought ||
    entry.evidenceFor ||
    entry.evidenceAgainst ||
    entry.alternative ||
    entry.emotionsAfter?.length ||
    typeof entry.alternativeBelief === "number";
  const empty =
    !entry.title &&
    !entry.situation &&
    !entry.thoughts?.length &&
    !entry.emotions?.length &&
    !entry.body &&
    !entry.behavior &&
    !entry.context &&
    !entry.tags?.length &&
    !entry.notes &&
    !tier2;

  return (
    <>
      {entry.title ? (
        <p className="px-5 pb-1 pl-11 pt-4 font-serif text-title-small text-ink">
          <Words>{entry.title}</Words>
        </p>
      ) : null}
      <dl className="m-0">
        {entry.situation ? (
          <NotebookRow label={ENTRY_LABELS.situation}>
            <Words>{entry.situation}</Words>
          </NotebookRow>
        ) : null}
        {entry.thoughts?.length ? (
          <NotebookRow label={ENTRY_LABELS.thoughts}>
            <ul className="m-0 list-none space-y-1.5 p-0">
              {entry.thoughts.map((thought, index) => (
                <li key={index}>
                  <Verbatim>{thought}</Verbatim>
                </li>
              ))}
            </ul>
          </NotebookRow>
        ) : null}
        {entry.emotions?.length ? (
          <NotebookRow label={ENTRY_LABELS.emotions}>
            <Emotions emotions={entry.emotions} />
          </NotebookRow>
        ) : null}
        {entry.body ? (
          <NotebookRow label={ENTRY_LABELS.body}>
            <Words>{entry.body}</Words>
          </NotebookRow>
        ) : null}
        {entry.behavior ? (
          <NotebookRow label={ENTRY_LABELS.behavior}>
            <Words>{entry.behavior}</Words>
          </NotebookRow>
        ) : null}
        {entry.context ? (
          <NotebookRow label={ENTRY_LABELS.context}>
            <Words>{entry.context}</Words>
          </NotebookRow>
        ) : null}
        {entry.tags?.length ? (
          <NotebookRow label={ENTRY_LABELS.tags}>
            <span className="font-sans text-[0.9375rem] text-ink-2">{entry.tags.join(", ")}</span>
          </NotebookRow>
        ) : null}
        {entry.notes ? (
          <NotebookRow label={ENTRY_LABELS.notes}>
            <Words>{entry.notes}</Words>
          </NotebookRow>
        ) : null}
        {entry.hotThought ? (
          <NotebookRow label={ENTRY_LABELS.hotThought}>
            <Verbatim>{entry.hotThought}</Verbatim>
          </NotebookRow>
        ) : null}
        {entry.evidenceFor ? (
          <NotebookRow label={ENTRY_LABELS.evidenceFor}>
            <Words>{entry.evidenceFor}</Words>
          </NotebookRow>
        ) : null}
        {entry.evidenceAgainst ? (
          <NotebookRow label={ENTRY_LABELS.evidenceAgainst}>
            <Words>{entry.evidenceAgainst}</Words>
          </NotebookRow>
        ) : null}
        {entry.alternative || typeof entry.alternativeBelief === "number" ? (
          <NotebookRow label={ENTRY_LABELS.alternative}>
            {entry.alternative ? <Verbatim>{entry.alternative}</Verbatim> : null}
            {typeof entry.alternativeBelief === "number" ? (
              <span className="text-[0.9375rem]">
                {entry.alternative ? " " : ""}
                <span className="font-sans text-caption text-ink-3">believable</span>
                <IntensityChip value={entry.alternativeBelief} />
              </span>
            ) : null}
          </NotebookRow>
        ) : null}
        {entry.emotionsAfter?.length ? (
          <NotebookRow label={ENTRY_LABELS.emotionsAfter}>
            <Emotions emotions={entry.emotionsAfter} />
          </NotebookRow>
        ) : null}
      </dl>
      {empty ? (
        <p className="py-4 pl-11 pr-5 text-[0.9375rem] text-ink-3">Nothing written in it yet.</p>
      ) : null}
    </>
  );
}
