import { NotebookRow } from "@sintr/ui";
import { CHECKIN_LABELS } from "@/lib/labels";

export interface CheckinView {
  mood?: number | null;
  energy?: number | null;
  anxiety?: number | null;
  sleepHours?: number | null;
  sleepQuality?: string | null;
  note?: string | null;
}

function Value({ label, value, unit }: { label: string; value: number | null | undefined; unit: string }) {
  if (typeof value !== "number") return null;
  return (
    <span className="inline-flex items-baseline gap-2 whitespace-nowrap">
      <span className="text-caption text-ink-3">{label}</span>
      <span className="font-serif text-[1.375rem] tabular-nums leading-none text-ink @max-[360px]:text-[1.1875rem]">
        {value}
      </span>
      <span className="text-caption text-ink-3">{unit}</span>
    </span>
  );
}

/** The check-in card's values: the scales inline, then sleep and the note. Only what was given. */
export function CheckinValues({ checkin }: { checkin: CheckinView }) {
  const scales = [checkin.mood, checkin.energy, checkin.anxiety].some((v) => typeof v === "number");
  return (
    <>
      {scales ? (
        <div className="flex flex-wrap gap-x-7 gap-y-3 border-b border-notebook-rule py-4 pl-11 pr-5 last:border-b-0">
          <Value label={CHECKIN_LABELS.mood} value={checkin.mood} unit="of 5" />
          <Value label={CHECKIN_LABELS.energy} value={checkin.energy} unit="of 5" />
          <Value label={CHECKIN_LABELS.anxiety} value={checkin.anxiety} unit="of 5" />
        </div>
      ) : null}
      <dl className="m-0">
        {typeof checkin.sleepHours === "number" || checkin.sleepQuality ? (
          <NotebookRow label={CHECKIN_LABELS.sleepHours}>
            {typeof checkin.sleepHours === "number" ? (
              <span className="tabular-nums">
                {checkin.sleepHours} {checkin.sleepHours === 1 ? "hour" : "hours"}
              </span>
            ) : null}
            {typeof checkin.sleepHours === "number" && checkin.sleepQuality ? ", " : null}
            {checkin.sleepQuality ? (
              <span className="whitespace-pre-line">{checkin.sleepQuality}</span>
            ) : null}
          </NotebookRow>
        ) : null}
        {checkin.note ? (
          <NotebookRow label={CHECKIN_LABELS.note}>
            <span className="whitespace-pre-line">{checkin.note}</span>
          </NotebookRow>
        ) : null}
      </dl>
    </>
  );
}
