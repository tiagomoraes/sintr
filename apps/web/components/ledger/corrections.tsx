import type { Correction } from "@sintr/core";
import { formatMoment } from "@/lib/format";
import { fieldsInWords, valueInWords } from "@/lib/labels";

/**
 * The dated corrections of a record (the pack's correction rule): when it
 * changed, what changed, the person's note, and what it said before. A
 * change that only filled empty fields reads as completing the record.
 */
export function Corrections({
  corrections,
  locale,
  labels,
}: {
  corrections: Correction[];
  locale: { language: string; timezone: string };
  labels: Record<string, string>;
}) {
  if (corrections.length === 0) return null;
  return (
    <section aria-labelledby="corrections-title" className="mt-12">
      <h2 id="corrections-title" className="font-serif text-title-small font-normal text-ink">
        Changes since it was written
      </h2>
      <p className="mt-2 max-w-[36em] text-[0.9375rem] text-ink-3">
        Each change is kept with its date and what it replaced, so nothing here was rewritten silently.
      </p>
      <ol className="mt-5 border-t border-rule">
        {corrections.map((correction) => {
          const completed = Object.values(correction.previous).every(
            (value) => value === null || (Array.isArray(value) && value.length === 0),
          );
          return (
            <li key={correction.id} className="border-b border-rule py-5">
              <p className="text-ink">
                <span className="font-serif italic text-ink-3">
                  {formatMoment(correction.createdAt, locale)}.
                </span>{" "}
                {completed ? "Completed with" : "Corrected"} {fieldsInWords(correction.fields)}.
              </p>
              {correction.note ? (
                <p className="mt-2 whitespace-pre-line font-serif text-ink-2">{correction.note}</p>
              ) : null}
              {completed ? null : (
                <details className="group mt-3">
                  <summary className="cursor-pointer list-none text-[0.9375rem] font-medium text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
                    <span
                      aria-hidden="true"
                      className="mr-2 inline-block size-[7px] -translate-y-px rotate-[-45deg] border-b-[1.5px] border-r-[1.5px] border-current transition-transform duration-[400ms] group-open:rotate-45"
                    />
                    What it said before
                  </summary>
                  <dl className="mt-3 space-y-2 border-l border-rule pl-4">
                    {correction.fields.map((field) => (
                      <div key={field}>
                        <dt className="text-caption text-ink-3">{labels[field] ?? field}</dt>
                        <dd className="m-0 whitespace-pre-line font-serif text-ink-2">
                          {field === "occurredAt" && typeof correction.previous[field] === "string"
                            ? formatMoment(new Date(correction.previous[field]), locale)
                            : (valueInWords(correction.previous[field]) ?? (
                                <span className="font-sans text-caption text-ink-3">Empty</span>
                              ))}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </details>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
