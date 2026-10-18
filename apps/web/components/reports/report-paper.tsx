import {
  REPORT_STRINGS,
  formatDayMonth,
  formatHours,
  formatMomentTime,
  formatNumber,
  formatRange,
  formatScore,
  formatSession,
  formatShortDay,
  formatWeekdays,
  isVerified,
  legendMark,
  normalizeWords,
  reportChart,
  splitQuotes,
  type DigestDay,
  type MeasureKey,
  type ReportMoment,
  type ReportStrings,
  type ReportView,
} from "@sintr/core";
import { IntensityChip, NotebookCard, NotebookHead, NotebookRow, Verbatim, cn } from "@sintr/ui";
import type { ReactNode } from "react";

/**
 * A report as the person reads it before approving it: the same words and
 * numbers as the PDF, set as a page of the app rather than raw Markdown,
 * in the report's language. The peach highlighter marks only words found
 * in the diary word for word; a quote that was not found keeps its marks,
 * underlined, so the person can see it and fix it.
 */

type Check = ReportView["check"];

function Prose({ text, check }: { text: string; check: Check }) {
  return (
    <>
      {splitQuotes(text).map((part, i) =>
        !part.quote ? (
          <span key={i}>{part.text}</span>
        ) : isVerified(check, part.text) ? (
          <Verbatim key={i}>{part.text}</Verbatim>
        ) : (
          <span
            key={i}
            title="Not in your diary word for word"
            className="underline decoration-ink-soft decoration-dotted decoration-1 underline-offset-[0.3em]"
          >
            {`“${part.text}”`}
          </span>
        ),
      )}
    </>
  );
}

function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/u)
    .map((p) => p.replace(/\s*\n\s*/gu, " ").trim())
    .filter(Boolean);
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-12 border-t border-rule pt-6">
      <h2 className="mb-5 font-serif text-[1.75rem] font-light leading-[1.1] tracking-[-0.016em] text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Feelings({ felt, before }: { felt: ReportMoment["felt"]; before?: ReportMoment["felt"] }) {
  const was = new Map((before ?? []).map((e) => [e.name.toLocaleLowerCase(), e.intensity]));
  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1.5 p-0">
      {felt.map((emotion, i) => {
        const previous = was.get(emotion.name.toLocaleLowerCase());
        return (
          <li key={`${emotion.name}-${i}`}>
            {emotion.name}
            {emotion.intensity !== null && previous !== undefined && previous !== null ? (
              <span className="ml-2 inline-flex translate-y-[-0.08em] items-center whitespace-nowrap rounded-pill border border-rule px-2 py-px font-sans text-[0.75rem] tabular-nums leading-[1.5] text-ink-3">
                {previous} to {emotion.intensity}
              </span>
            ) : emotion.intensity !== null ? (
              <IntensityChip value={emotion.intensity} />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function Moment({ moment, view, s }: { moment: ReportMoment; view: ReportView; s: ReportStrings }) {
  const missing = <span className="font-sans text-caption italic text-ink-3">{s.notRecorded}</span>;
  const strongest = moment.hotThought ? normalizeWords(moment.hotThought) : null;
  return (
    <NotebookCard className="mt-5">
      <NotebookHead
        time={formatMomentTime(new Date(moment.occurredAt), view.timeZone, view.content.language)}
        tag={moment.tags.join(", ") || undefined}
      />
      <h3 className="px-5 pb-1 pl-11 pt-4 font-serif text-title-small font-normal text-ink">
        <Prose text={moment.title} check={view.check} />
      </h3>
      {moment.felt.length ? (
        <div className="px-5 pb-2 pl-11 pt-1 font-serif text-[1.0625rem] text-ink">
          <Feelings felt={moment.felt} />
        </div>
      ) : null}
      <dl className="m-0">
        <NotebookRow label={s.moment.happened}>
          {moment.happened ? <Prose text={moment.happened} check={view.check} /> : missing}
        </NotebookRow>
        {moment.context ? (
          <NotebookRow label={s.moment.context}>
            <Prose text={moment.context} check={view.check} />
          </NotebookRow>
        ) : null}
        <NotebookRow label={s.moment.thoughts}>
          {moment.thoughts.length ? (
            <ul className="m-0 list-none space-y-1.5 p-0">
              {moment.thoughts.map((thought, i) => (
                <li key={i}>
                  <Verbatim>{thought}</Verbatim>
                  {strongest && normalizeWords(thought) === strongest ? (
                    <span className="ml-2 inline-flex rounded-pill border border-rule px-2 font-sans text-[0.75rem] text-ink-3">
                      {s.strongest}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            missing
          )}
        </NotebookRow>
        {moment.felt.length ? null : <NotebookRow label={s.moment.felt}>{missing}</NotebookRow>}
        {moment.body ? <NotebookRow label={s.moment.body}>{moment.body}</NotebookRow> : null}
        <NotebookRow label={s.moment.did}>
          {moment.did ? <Prose text={moment.did} check={view.check} /> : missing}
        </NotebookRow>
        {moment.evidenceFor ? (
          <NotebookRow label={s.moment.evidenceFor}>{moment.evidenceFor}</NotebookRow>
        ) : null}
        {moment.evidenceAgainst ? (
          <NotebookRow label={s.moment.evidenceAgainst}>{moment.evidenceAgainst}</NotebookRow>
        ) : null}
        {moment.alternative || moment.belief !== null ? (
          <NotebookRow label={s.moment.alternative}>
            {moment.alternative ? <Verbatim>{moment.alternative}</Verbatim> : null}
            {moment.belief !== null ? (
              <span className="mt-1.5 block font-sans text-caption text-ink-3">
                {s.belief(moment.belief)}
              </span>
            ) : null}
          </NotebookRow>
        ) : null}
        {moment.feltAfter.length ? (
          <NotebookRow label={s.moment.feltAfter}>
            <Feelings felt={moment.feltAfter} before={moment.felt} />
          </NotebookRow>
        ) : null}
      </dl>
    </NotebookCard>
  );
}

const MEASURES: MeasureKey[] = ["mood", "energy", "anxiety", "sleepHours"];

function logged(day: DigestDay): boolean {
  return day.mood !== null || day.energy !== null || day.anxiety !== null || day.sleepHours !== null;
}

function Numbers({ view, s }: { view: ReportView; s: ReportStrings }) {
  const { numbers, content } = view;
  const language = content.language;
  const anyLogged = numbers.days.some(logged);
  const first = numbers.days[0]?.day;
  const chart = first ? reportChart(numbers.history, first, language) : null;
  return (
    <>
      {anyLogged ? (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4">
          {MEASURES.map((key) => {
            const m = numbers.measures[key];
            if (m.average === null) return null;
            const sleep = key === "sleepHours";
            const previous =
              m.previous === null
                ? s.previousNone
                : s.previous(sleep ? formatHours(m.previous) : formatNumber(m.previous, language));
            return (
              <div key={key} className="border-t border-ink pt-2.5">
                <dt className="text-caption text-ink-3">{s.averages[key]}</dt>
                <dd className="m-0 mt-1 whitespace-nowrap font-serif text-[2rem] font-light leading-none tracking-[-0.02em] text-ink">
                  {sleep ? formatHours(m.average) : formatNumber(m.average, language)}
                  <span className="ml-1.5 font-sans text-caption tracking-normal text-ink-3">
                    {sleep ? s.perNight : s.of5}
                  </span>
                </dd>
                <dd className="m-0 mt-1.5 text-[0.75rem] leading-[1.45] text-ink-3">
                  {s.nDays(m.days)} · {previous}
                </dd>
              </div>
            );
          })}
        </dl>
      ) : (
        <p className="font-serif italic text-ink-3">{s.noCheckins}</p>
      )}
      {paragraphs(content.mood).map((p, i) => (
        <p key={i} className="mt-5 max-w-[36em] font-serif text-[1.0625rem] leading-[1.62] text-ink">
          <Prose text={p} check={view.check} />
        </p>
      ))}
      {chart ? (
        <figure className="m-0 mt-8">
          <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <p className="text-caption text-ink-3">{s.chartA(chart.low)}</p>
            <ul className="m-0 flex list-none gap-5 p-0 text-caption text-ink-2">
              <li className="inline-flex items-center gap-1.5">
                <span dangerouslySetInnerHTML={{ __html: legendMark("mood") }} />
                {s.legendMood}
              </li>
              <li className="inline-flex items-center gap-1.5">
                <span dangerouslySetInnerHTML={{ __html: legendMark("anxiety") }} />
                {s.legendAnxiety}
              </li>
            </ul>
          </div>
          <div dangerouslySetInnerHTML={{ __html: chart.moodAnxiety }} />
          <p className="mb-1 mt-3 text-caption text-ink-3">{s.chartB}</p>
          <div dangerouslySetInnerHTML={{ __html: chart.sleep }} />
          <figcaption className="mt-2 text-[0.75rem] leading-[1.45] text-ink-3">
            {s.chartNote(chart.weeks)}
          </figcaption>
        </figure>
      ) : null}
      {anyLogged ? (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[34rem] table-fixed border-collapse tabular-nums">
            <caption className="pb-2 text-left text-caption text-ink-3">{s.gridCaption}</caption>
            <thead>
              <tr>
                <td className="w-28 border-b border-ink pb-1.5" />
                {numbers.days.map((d) => (
                  <th
                    key={d.day}
                    scope="col"
                    className="border-b border-ink pb-1.5 text-center text-caption font-normal"
                  >
                    <span className="block font-medium text-ink-2">{s.weekdaysShort[d.weekday]}</span>
                    <span className="block text-ink-3">{formatDayMonth(d.day, language)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MEASURES.map((key) => (
                <tr key={key} className="border-b border-rule">
                  <th scope="row" className="py-2 text-left text-caption font-normal text-ink-3">
                    {s.rows[key]}
                  </th>
                  {numbers.days.map((d) => {
                    const v = d[key];
                    return (
                      <td
                        key={d.day}
                        className={cn("py-2 text-center font-serif", v === null && "text-ink-soft")}
                      >
                        {v === null
                          ? "-"
                          : key === "sleepHours"
                            ? formatHours(v)
                            : formatScore(Math.round(v * 10) / 10, language)}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <th scope="row" className="py-2 text-left text-caption font-normal text-ink-3">
                  {s.rows.entries}
                </th>
                {numbers.days.map((d) => (
                  <td key={d.day} className="py-2 text-center text-ink-2">
                    {d.entries ? (
                      "•".repeat(Math.min(d.entries, 6))
                    ) : (
                      <span className="text-ink-soft">-</span>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}
      {content.notes.length ? (
        <div className="mt-8">
          <p className="mb-2 text-caption text-ink-3">{s.dayNotes}</p>
          <ul className="m-0 list-none border-t border-ink p-0">
            {content.notes.map((note) => (
              <li
                key={note.checkinId}
                className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 border-b border-rule py-2"
              >
                <span className="pt-0.5 text-caption text-ink-3">{formatShortDay(note.day, language)}</span>
                <span className="font-serif text-ink">
                  <Verbatim>{note.note}</Verbatim>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

export function ReportPaper({ view }: { view: ReportView }) {
  const { content, numbers, period, check } = view;
  const s = REPORT_STRINGS[content.language];
  const name = view.person.name?.trim() || null;
  const first = numbers.days[0]?.day ?? period.label;
  const last = numbers.days.at(-1)?.day ?? period.label;
  const range = formatRange(first, last, content.language);
  const missing = numbers.days.filter((d) => !logged(d)).map((d) => d.day);
  const week = paragraphs(content.week);

  return (
    <article
      lang={content.language === "pt" ? "pt-BR" : content.language}
      aria-label="The report"
      className="rounded-paper border border-rule bg-paper px-[clamp(22px,4.4vw,56px)] pb-[clamp(28px,4vw,48px)] pt-[clamp(24px,4vw,48px)] shadow-lift"
    >
      <h2 className="max-w-[16em] font-serif text-[clamp(1.875rem,1.4rem+1.6vw,2.625rem)] font-light leading-[1.06] tracking-[-0.024em] text-ink">
        {range.charAt(0).toUpperCase() + range.slice(1)}.{" "}
        <span className="text-ink-soft">{name ? s.titleNamed(name) : s.titleAnonymous}</span>
      </h2>
      <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-3 border-t border-ink pt-3">
        <div>
          <dt className="text-caption text-ink-3">{period.session ? s.factSession : s.factWeek}</dt>
          <dd className="m-0 font-serif text-ink">
            {period.session ? formatSession(period.session, view.timeZone, content.language) : period.label}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-ink-3">{s.factCheckins}</dt>
          <dd className="m-0 font-serif text-ink">
            {s.coverage(numbers.counts.daysWithCheckin, numbers.counts.days)}
            {missing.length && numbers.counts.daysWithCheckin ? (
              <span className="block font-sans text-caption text-ink-3">
                {s.coverageMissing(formatWeekdays(missing, content.language))}
              </span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-ink-3">{s.factMoments}</dt>
          <dd className="m-0 font-serif text-ink">{numbers.counts.entries}</dd>
        </div>
      </dl>

      <Section title={s.sections.week}>
        {week.length ? (
          week.map((p, i) => (
            <p
              key={i}
              className="mt-3 max-w-[36em] font-serif text-[1.1875rem] leading-[1.55] text-ink first:mt-0"
            >
              <Prose text={p} check={check} />
            </p>
          ))
        ) : (
          <p className="font-serif italic text-ink-3">{s.nothingThisWeek}</p>
        )}
      </Section>

      <Section title={s.sections.session}>
        {content.topics.length ? (
          <NotebookCard className="shadow-none">
            <ul className="m-0 list-none p-0">
              {content.topics.map((topic, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 border-b border-notebook-rule py-3 pl-11 pr-5 font-serif text-[1.0625rem] leading-[1.45] text-ink last:border-b-0"
                >
                  <span
                    aria-hidden="true"
                    className="mt-[0.3em] size-3 shrink-0 rounded-[3px] border-[1.3px] border-ink-soft"
                  />
                  <span>
                    <Prose text={topic.text} check={check} />
                    {topic.suggested ? (
                      <span className="ml-2 inline-flex whitespace-nowrap rounded-pill border border-rule px-2 font-sans text-[0.75rem] text-ink-3">
                        {s.suggested}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </NotebookCard>
        ) : (
          <p className="font-serif italic text-ink-3">{s.nothingThisWeek}</p>
        )}
      </Section>

      <Section title={s.sections.mood}>
        <Numbers view={view} s={s} />
      </Section>

      {content.moments.length ? (
        <Section title={s.sections.moments}>
          {content.momentsIntro.trim() ? (
            <p className="max-w-[36em] font-serif italic text-ink-2">
              <Prose text={content.momentsIntro} check={check} />
            </p>
          ) : null}
          {content.moments.map((moment) => (
            <Moment key={moment.entryId} moment={moment} view={view} s={s} />
          ))}
        </Section>
      ) : null}

      {content.patterns.length ? (
        <Section title={s.sections.patterns}>
          <ul className="m-0 list-none border-t border-ink p-0">
            {content.patterns.map((pattern, i) => (
              <li
                key={i}
                className="grid gap-x-4 gap-y-1 border-b border-rule py-3 sm:grid-cols-[8rem_minmax(0,1fr)]"
              >
                <span className="pt-0.5 text-caption text-ink-3">
                  <Prose text={pattern.when} check={check} />
                </span>
                <span className="font-serif text-ink">
                  <Prose text={pattern.text} check={check} />
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {content.helped.length ? (
        <Section title={s.sections.helped}>
          <ul className="m-0 grid max-w-[36em] list-none gap-2 p-0">
            {content.helped.map((item, i) => (
              <li
                key={i}
                className="relative pl-4 font-serif text-ink before:absolute before:left-0 before:top-[0.8em] before:h-px before:w-[7px] before:bg-ink-soft"
              >
                <Prose text={item} check={check} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <footer className="mt-12 space-y-1.5 border-t border-rule pt-4">
        {[
          `${s.footPrepared(view.report.status === "draft" ? "" : name ? s.footReviewedNamed(name) : s.footReviewedAnonymous)} ${s.footObservations} ${s.footClinical}`,
          s.footQuotes,
          ...(content.topics.some((t) => t.suggested) ? [s.footSuggested] : []),
          s.footRealtime,
        ].map((line) => (
          <p key={line} className="max-w-[40em] font-serif text-[0.875rem] italic leading-[1.5] text-ink-3">
            {line}
          </p>
        ))}
      </footer>
    </article>
  );
}
