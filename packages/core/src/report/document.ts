/**
 * The report as the therapist receives it: one self-contained HTML page in
 * the sintr design system, printed to PDF by Chromium (see pdf.ts). It holds
 * every font and image inline and no script, so the printer needs nothing
 * from the network.
 *
 * Words come from the report content, which the person reviewed; numbers,
 * the grid and the chart come from the check-ins and are never typed. A
 * quoted span gets the verbatim highlighter only when the check found it in
 * the diary word for word.
 */
import type { ReportStatus } from "../domain";
import { REPORT_ASSETS } from "./assets.generated";
import { legendMark, reportChart } from "./chart";
import { isVerified, normalizeWords, splitQuotes, type ReportCheck } from "./check";
import type { ReportContent, ReportMoment, ReportSection } from "./content";
import type { DigestDay, DigestNumbers, MeasureKey } from "./digest";
import {
  formatDayMonth,
  formatHours,
  formatMomentTime,
  formatNumber,
  formatRange,
  formatScore,
  formatSession,
  formatShortDay,
  formatWeekdays,
} from "./format";
import { REPORT_STRINGS, type ReportStrings } from "./strings";
import { REPORT_CSS } from "./style";

export interface ReportDocumentInput {
  content: ReportContent;
  /** The live digest's numbers for a draft; the frozen ones once approved. */
  numbers: DigestNumbers;
  period: { kind: "session" | "week"; label: string; session: Date | null };
  check: Pick<ReportCheck, "verified">;
  status: ReportStatus;
  person: { name: string | null };
  therapist: { name: string | null };
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
}

/**
 * A CSS string literal. The text (the person's name) sits inside a <style>
 * element, so "<" is escaped too: it can never close the element.
 */
export function cssString(text: string): string {
  return `"${text.replace(/[\\"<>\r\n]/gu, (c) => `\\${c.codePointAt(0)!.toString(16)} `)}"`;
}

/** Escape, and set the person's verified quotes under the highlighter. */
function inline(text: string, check: Pick<ReportCheck, "verified">): string {
  return splitQuotes(text)
    .map((part) =>
      !part.quote
        ? escapeHtml(part.text)
        : isVerified(check, part.text)
          ? `<q class="said">${escapeHtml(part.text)}</q>`
          : `\u201c${escapeHtml(part.text)}\u201d`,
    )
    .join("");
}

/** The person's own words, from a record: always highlighted. */
function said(text: string): string {
  return `<q class="said">${escapeHtml(text)}</q>`;
}

function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/u)
    .map((p) => p.replace(/\s*\n\s*/gu, " ").trim())
    .filter(Boolean);
}

const GLYPH =
  '<svg viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="mark-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cfe3f3"/><stop offset=".55" stop-color="#f6e1d3"/><stop offset="1" stop-color="#f7cfb5"/></linearGradient></defs><rect width="32" height="32" rx="8" fill="#16171a"/><g fill="url(#mark-grad)" transform="translate(10.4 6.2) skewX(-14)"><rect x="0" y="0" width="6" height="8.8" rx="1"/><rect x="7.2" y="0" width="6" height="8.8" rx="1"/><rect x="0" y="10.2" width="6" height="8.8" rx="1"/><rect x="7.2" y="10.2" width="6" height="8.8" rx="1"/></g></svg>';

// The arrow of a re-rate is drawn: U+2192 is not in the embedded font subsets.
const ARROW =
  '<svg class="arrow" viewBox="0 0 12 8" aria-hidden="true"><path d="M1 4h9.2M7.2 1.2 10 4 7.2 6.8"/></svg>';

function feelings(
  emotions: ReportMoment["felt"],
  s: ReportStrings,
  before: ReportMoment["felt"] | null = null,
): string {
  const was = new Map((before ?? []).map((e) => [e.name.toLocaleLowerCase(), e.intensity]));
  const chips = emotions.map((emotion) => {
    const previous = was.get(emotion.name.toLocaleLowerCase());
    let scale = "";
    if (emotion.intensity !== null && previous !== undefined && previous !== null) {
      scale = `<span class="scale">${previous} ${ARROW} ${emotion.intensity}</span>`;
    } else if (emotion.intensity !== null) {
      scale = `<span class="scale">${emotion.intensity} ${escapeHtml(s.of100)}</span>`;
    }
    return `<span class="feel__item">${escapeHtml(emotion.name)}${scale}</span>`;
  });
  return `<span class="feel">${chips.join("")}</span>`;
}

function momentCard(moment: ReportMoment, input: ReportDocumentInput, s: ReportStrings): string {
  const { check, numbers, content } = input;
  const missing = `<span class="none">${escapeHtml(s.notRecorded)}</span>`;
  const when = formatMomentTime(new Date(moment.occurredAt), numbers.timeZone, content.language);
  const head = `<div class="note__head"><span class="note__when">${escapeHtml(when)}</span>${
    moment.tags.length ? `<span class="note__tag">${escapeHtml(moment.tags.join(", "))}</span>` : ""
  }</div>`;
  const feel = moment.felt.length ? `<p class="note__feel">${feelings(moment.felt, s)}</p>` : "";
  const strongest = moment.hotThought ? normalizeWords(moment.hotThought) : null;
  const rows: string[] = [];
  const row = (label: string, html: string) =>
    rows.push(`<div class="note__row"><dt>${escapeHtml(label)}</dt><dd>${html}</dd></div>`);
  row(s.moment.happened, moment.happened ? inline(moment.happened, check) : missing);
  if (moment.context) row(s.moment.context, inline(moment.context, check));
  row(
    s.moment.thoughts,
    moment.thoughts.length
      ? moment.thoughts
          .map(
            (thought) =>
              `<span class="thought">${said(thought)}${
                strongest && normalizeWords(thought) === strongest
                  ? ` <span class="scale scale--tag">${escapeHtml(s.strongest)}</span>`
                  : ""
              }</span>`,
          )
          .join("")
      : missing,
  );
  if (!moment.felt.length) row(s.moment.felt, missing);
  if (moment.body) row(s.moment.body, escapeHtml(moment.body));
  row(s.moment.did, moment.did ? inline(moment.did, check) : missing);
  if (moment.evidenceFor) row(s.moment.evidenceFor, escapeHtml(moment.evidenceFor));
  if (moment.evidenceAgainst) row(s.moment.evidenceAgainst, escapeHtml(moment.evidenceAgainst));
  if (moment.alternative || moment.belief !== null) {
    row(
      s.moment.alternative,
      `${moment.alternative ? `<span class="thought">${said(moment.alternative)}</span>` : ""}${
        moment.belief !== null
          ? `<span class="scale scale--after">${escapeHtml(s.belief(moment.belief))}</span>`
          : ""
      }`,
    );
  }
  if (moment.feltAfter.length) row(s.moment.feltAfter, feelings(moment.feltAfter, s, moment.felt));
  return `<article class="note">${head}<h3 class="note__title">${inline(moment.title, check)}</h3>${feel}<dl class="note__rows">${rows.join("")}</dl></article>`;
}

const MEASURES: MeasureKey[] = ["mood", "energy", "anxiety", "sleepHours"];

function logged(day: DigestDay): boolean {
  return day.mood !== null || day.energy !== null || day.anxiety !== null || day.sleepHours !== null;
}

function stats(numbers: DigestNumbers, input: ReportDocumentInput, s: ReportStrings): string {
  const language = input.content.language;
  const cells = MEASURES.flatMap((key) => {
    const m = numbers.measures[key];
    if (m.average === null) return [];
    const sleep = key === "sleepHours";
    const value = sleep
      ? `${formatHours(m.average)}<span class="stat__unit">${escapeHtml(s.perNight)}</span>`
      : `${formatNumber(m.average, language)}<span class="stat__unit">${escapeHtml(s.of5)}</span>`;
    const previous =
      m.previous === null
        ? s.previousNone
        : s.previous(sleep ? formatHours(m.previous) : formatNumber(m.previous, language));
    return [
      `<div class="stat"><dt>${escapeHtml(s.averages[key])}</dt><dd class="stat__value">${value}</dd><dd class="stat__sub">${escapeHtml(`${s.nDays(m.days)} · ${previous}`)}</dd></div>`,
    ];
  });
  return `<dl class="stats">${cells.join("")}</dl>`;
}

function grid(numbers: DigestNumbers, input: ReportDocumentInput, s: ReportStrings): string {
  const language = input.content.language;
  const head = numbers.days
    .map(
      (d) =>
        `<th scope="col"><span class="days__wd">${escapeHtml(s.weekdaysShort[d.weekday]!)}</span><span class="days__d">${formatDayMonth(d.day, language)}</span></th>`,
    )
    .join("");
  const none = '<td class="days__none">-</td>';
  const rows = MEASURES.map((key) => {
    const cells = numbers.days
      .map((d) => {
        const v = d[key];
        if (v === null) return none;
        return `<td>${key === "sleepHours" ? formatHours(v) : formatScore(Math.round(v * 10) / 10, language)}</td>`;
      })
      .join("");
    return `<tr><th scope="row">${escapeHtml(s.rows[key])}</th>${cells}</tr>`;
  });
  const marks = numbers.days
    .map((d) =>
      d.entries ? `<td class="days__marks">${"<i></i>".repeat(Math.min(d.entries, 6))}</td>` : none,
    )
    .join("");
  rows.push(`<tr><th scope="row">${escapeHtml(s.rows.entries)}</th>${marks}</tr>`);
  return `<table class="days"><caption>${escapeHtml(s.gridCaption)}</caption><thead><tr><td></td>${head}</tr></thead><tbody>${rows.join("")}</tbody></table>`;
}

function moodSection(input: ReportDocumentInput, s: ReportStrings): string {
  const { numbers, content, check } = input;
  const out: string[] = [];
  const anyLogged = numbers.days.some(logged);
  out.push(anyLogged ? stats(numbers, input, s) : `<p class="quiet">${escapeHtml(s.noCheckins)}</p>`);
  const reading = paragraphs(content.mood);
  if (reading.length)
    out.push(`<div class="reading">${reading.map((p) => `<p>${inline(p, check)}</p>`).join("")}</div>`);
  const first = numbers.days[0]?.day;
  const chart = first ? reportChart(numbers.history, first, content.language) : null;
  if (chart) {
    out.push(
      `<figure class="chart"><div class="chart__head"><p class="chart__title">${escapeHtml(s.chartA(chart.low))}</p><ul class="legend"><li>${legendMark("mood")}${escapeHtml(s.legendMood)}</li><li>${legendMark("anxiety")}${escapeHtml(s.legendAnxiety)}</li></ul></div>${chart.moodAnxiety}<p class="chart__title chart__title--b">${escapeHtml(s.chartB)}</p>${chart.sleep}<figcaption>${escapeHtml(s.chartNote(chart.weeks))}</figcaption></figure>`,
    );
  }
  if (anyLogged) out.push(grid(numbers, input, s));
  if (content.notes.length) {
    const rows = content.notes
      .map(
        (note) =>
          `<li><span class="obs__when">${escapeHtml(formatShortDay(note.day, content.language))}</span><span class="obs__what">${said(note.note)}</span></li>`,
      )
      .join("");
    out.push(
      `<div class="daynotes"><p class="daynotes__title">${escapeHtml(s.dayNotes)}</p><ul class="obs obs--notes">${rows}</ul></div>`,
    );
  }
  return out.join("");
}

/** Rough height in mm of the page-1 sections, to decide whether the letter fits. */
function coverHeight(content: ReportContent): number {
  let mm = 0;
  if (content.week.trim()) {
    mm += 21;
    for (const p of paragraphs(content.week)) mm += 7.4 * Math.ceil(p.length / 72) + 3;
  }
  if (content.topics.length) {
    mm += 21 + content.topics.reduce((sum, t) => sum + 6.3 * Math.ceil(t.text.length / 90) + 3.4, 0) + 3;
  }
  return mm;
}

const COVER_BUDGET_MM = 156;

export function reportDocument(input: ReportDocumentInput): string {
  const { content, numbers, period, check, status } = input;
  const s = REPORT_STRINGS[content.language];
  const name = input.person.name?.trim() || null;
  const therapist = input.therapist.name?.trim() || null;
  const days = numbers.days;
  const first = days[0]?.day ?? period.label;
  const last = days.at(-1)?.day ?? period.label;
  const range = formatRange(first, last, content.language);

  const cover: string[] = [];
  const rest: string[] = [];
  cover.push(
    `<header class="masthead"><div class="mark">${GLYPH}<span class="mark__word">sintr</span></div><p class="masthead__conf">${escapeHtml(
      s.confidential + (therapist ? ` · ${s.forTherapist(therapist)}` : ""),
    )}</p></header>`,
  );
  if (status === "draft") {
    cover.push(
      `<p class="status"><span class="status__dot" aria-hidden="true"></span>${escapeHtml(s.draft)}</p>`,
    );
  }
  cover.push(
    `<h1 class="title"><span class="title__a">${escapeHtml(range.charAt(0).toUpperCase() + range.slice(1))}.</span> <span class="title__b">${escapeHtml(
      name ? s.titleNamed(name) : s.titleAnonymous,
    )}</span></h1>`,
  );
  const missing = days.filter((d) => !logged(d)).map((d) => d.day);
  let coverage = escapeHtml(s.coverage(numbers.counts.daysWithCheckin, numbers.counts.days));
  if (missing.length && numbers.counts.daysWithCheckin > 0) {
    coverage += `<span class="facts__sub">${escapeHtml(s.coverageMissing(formatWeekdays(missing, content.language)))}</span>`;
  }
  const facts: [string, string][] = [
    period.session
      ? [s.factSession, escapeHtml(formatSession(period.session, numbers.timeZone, content.language))]
      : [s.factWeek, escapeHtml(period.label)],
    [s.factCheckins, coverage],
    [s.factMoments, String(numbers.counts.entries)],
  ];
  cover.push(
    `<dl class="facts">${facts.map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${v}</dd></div>`).join("")}</dl>`,
  );

  const section = (key: ReportSection, body: string) =>
    `<section class="sec sec--${key}"><h2>${escapeHtml(s.sections[key])}</h2>${body}</section>`;

  const week = paragraphs(content.week);
  if (week.length)
    cover.push(section("week", week.map((p) => `<p class="lede">${inline(p, check)}</p>`).join("")));
  if (content.topics.length) {
    const items = content.topics
      .map(
        (topic) =>
          `<li><span class="tick" aria-hidden="true"></span><span>${inline(topic.text, check)}${
            topic.suggested ? ` <span class="scale scale--tag">${escapeHtml(s.suggested)}</span>` : ""
          }</span></li>`,
      )
      .join("");
    cover.push(section("session", `<ul class="topics">${items}</ul>`));
  }

  rest.push(section("mood", moodSection(input, s)));
  if (content.moments.length) {
    const intro = content.momentsIntro.trim()
      ? `<p class="intro">${inline(content.momentsIntro, check)}</p>`
      : "";
    rest.push(section("moments", intro + content.moments.map((m) => momentCard(m, input, s)).join("")));
  }
  if (content.patterns.length) {
    const items = content.patterns
      .map(
        (p) =>
          `<li><span class="obs__when">${inline(p.when, check)}</span><span class="obs__what">${inline(p.text, check)}</span></li>`,
      )
      .join("");
    rest.push(section("patterns", `<ul class="obs">${items}</ul>`));
  }
  if (content.helped.length) {
    rest.push(
      section(
        "helped",
        `<ul class="dash">${content.helped.map((h) => `<li>${inline(h, check)}</li>`).join("")}</ul>`,
      ),
    );
  }

  const reviewedBy = status === "draft" ? "" : name ? s.footReviewedNamed(name) : s.footReviewedAnonymous;
  const foot = [
    `${s.footPrepared(reviewedBy)} ${s.footObservations} ${s.footClinical}`,
    s.footQuotes,
    ...(content.topics.some((t) => t.suggested) ? [s.footSuggested] : []),
    s.footRealtime,
  ];
  const footHtml = `<footer class="foot">${foot.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}</footer>`;
  const budget = COVER_BUDGET_MM - (status === "draft" ? 10 : 0) - ((name?.length ?? 0) > 28 ? 12 : 0);
  const body =
    coverHeight(content) <= budget
      ? [`<div class="cover">${cover.join("")}${footHtml}</div>`, ...rest]
      : [`<div class="cover cover--flow">${cover.join("")}</div>`, ...rest, footHtml];

  const running = s.running(name, period.label);
  const css = `${REPORT_CSS}\n@page { @bottom-left { content: ${cssString(running)}; } @bottom-right { content: counter(page) " / " counter(pages); } }`;
  const lang = content.language === "pt" ? "pt-BR" : content.language;
  const title = [s.doc, name, period.label].filter(Boolean).join(" · ");
  const fonts = [
    ["Source Serif 4", REPORT_ASSETS.serifRoman, "200 600", "normal"],
    ["Source Serif 4", REPORT_ASSETS.serifItalic, "200 600", "italic"],
    ["Hanken Grotesk", REPORT_ASSETS.sans, "300 700", "normal"],
  ]
    .map(
      ([family, data, weight, style]) =>
        `@font-face { font-family: "${family}"; src: url(data:font/woff2;base64,${data}) format("woff2"); font-weight: ${weight}; font-style: ${style}; }`,
    )
    .join("\n");
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="color-scheme" content="light">
<title>${escapeHtml(title)}</title>
<style>${fonts}</style>
<style>${css}</style>
</head>
<body>
<img class="light" src="data:image/jpeg;base64,${REPORT_ASSETS.light}" alt="">
<main class="doc">
${body.join("\n")}
</main>
</body>
</html>`;
}
