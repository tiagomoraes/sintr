import { parseContent, type ReportRevision } from "@sintr/core";
import { formatMoment } from "@/lib/format";
import { sectionsInWords } from "@/lib/reports";

/**
 * What a report said before each change (the person's edit, or a new
 * preparation): like an entry's corrections, nothing is rewritten silently.
 */
export function ReportChanges({
  revisions,
  locale,
}: {
  revisions: ReportRevision[];
  locale: { language: string; timezone: string };
}) {
  if (revisions.length === 0) return null;
  return (
    <section aria-labelledby="changes-title" className="mt-16">
      <h2 id="changes-title" className="font-serif text-title-small font-normal text-ink">
        Changes since it was prepared
      </h2>
      <p className="mt-2 max-w-[36em] text-[0.9375rem] text-ink-3">
        Each change is kept with its date and what the report said before.
      </p>
      <ol className="mt-5 border-t border-rule">
        {revisions.map((revision) => {
          const before = parseContent(revision.previous);
          return (
            <li key={revision.id} className="border-b border-rule py-5">
              <p className="text-ink">
                <span className="font-serif italic text-ink-3">
                  {formatMoment(revision.createdAt, locale)}.
                </span>{" "}
                {revision.kind === "edited"
                  ? `You changed ${sectionsInWords(revision.sections)}.`
                  : `Prepared again${revision.sections.length ? `, changing ${sectionsInWords(revision.sections)}` : ""}.`}
              </p>
              {before ? (
                <details className="group mt-3">
                  <summary className="cursor-pointer list-none text-[0.9375rem] font-medium text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
                    <span
                      aria-hidden="true"
                      className="mr-2 inline-block size-[7px] -translate-y-px rotate-[-45deg] border-b-[1.5px] border-r-[1.5px] border-current transition-transform duration-[400ms] group-open:rotate-45"
                    />
                    What it said before
                  </summary>
                  <dl className="mt-3 space-y-3 border-l border-rule pl-4">
                    {before.week ? (
                      <div>
                        <dt className="text-caption text-ink-3">How the week went</dt>
                        <dd className="m-0 whitespace-pre-line font-serif text-ink-2">{before.week}</dd>
                      </div>
                    ) : null}
                    {before.topics.length ? (
                      <div>
                        <dt className="text-caption text-ink-3">For the session</dt>
                        <dd className="m-0 font-serif text-ink-2">
                          {before.topics.map((t) => t.text).join(" / ")}
                        </dd>
                      </div>
                    ) : null}
                    {before.mood ? (
                      <div>
                        <dt className="text-caption text-ink-3">Mood, energy and sleep</dt>
                        <dd className="m-0 whitespace-pre-line font-serif text-ink-2">{before.mood}</dd>
                      </div>
                    ) : null}
                    {before.moments.length ? (
                      <div>
                        <dt className="text-caption text-ink-3">The moments</dt>
                        <dd className="m-0 font-serif text-ink-2">
                          {before.moments.map((m) => m.title).join(" / ")}
                        </dd>
                      </div>
                    ) : null}
                    {before.patterns.length ? (
                      <div>
                        <dt className="text-caption text-ink-3">What repeated</dt>
                        <dd className="m-0 font-serif text-ink-2">
                          {before.patterns.map((p) => `${p.when}: ${p.text}`).join(" / ")}
                        </dd>
                      </div>
                    ) : null}
                    {before.helped.length ? (
                      <div>
                        <dt className="text-caption text-ink-3">What helped</dt>
                        <dd className="m-0 font-serif text-ink-2">{before.helped.join(" / ")}</dd>
                      </div>
                    ) : null}
                  </dl>
                </details>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
