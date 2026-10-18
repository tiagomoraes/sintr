/**
 * The chart of a report: two small multiples on one day axis (never a dual
 * axis), mood and anxiety on their shared 0 to 5 scale, then hours of sleep,
 * over the last weeks with this period lit by the window light. Each line is
 * continuous and smoothed with monotone interpolation, so it shows no peak
 * or dip that is not in the data; a stretch that crosses days without a
 * check-in is dotted and carries no dot, and no value is estimated.
 *
 * Plain SVG with presentation attributes and opaque colors only, so the PDF
 * looks the same in every viewer and the app can show the same drawing.
 */
import type { DigestDay } from "./digest";
import type { ReportLanguage } from "./content";
import { formatDayMonth } from "./format";
import { REPORT_STRINGS } from "./strings";

// The two ends of the window light (sky, peach), deepened until they work as
// 2px lines on paper; sleep has its own panel and title, so graphite.
export const MOOD_COLOR = "#3a6ea5";
export const ANXIETY_COLOR = "#c4744a";
const SLEEP_COLOR = "#5c616b";
const LIGHT = ["#d4e6f4", "#f1e8df", "#f8dcc8"] as const;
const SANS = "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif";
const SERIF = "Source Serif 4, Georgia, serif";

/** `color` at `strength` over white, as an opaque color. */
export function onPaper(color: string, strength: number): string {
  const channels = [1, 3, 5].map((i) => Number.parseInt(color.slice(i, i + 2), 16));
  return `#${channels
    .map((c) =>
      Math.round(255 - (255 - c) * strength)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function n(value: number): string {
  const text = value.toFixed(2).replace(/\.?0+$/u, "");
  return text === "-0" ? "0" : text;
}

function esc(text: string): string {
  return text.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;").replace(/"/gu, "&quot;");
}

/** Fritsch-Carlson tangents (d3's curveMonotoneX): smooth, never overshooting. */
function tangents(points: readonly [number, number][]): number[] {
  const count = points.length;
  if (count < 2) return points.map(() => 0);
  const slopes = points.slice(0, -1).map(([x, y], i) => (points[i + 1]![1] - y) / (points[i + 1]![0] - x));
  const out = points.map(() => 0);
  for (let i = 1; i < count - 1; i += 1) {
    const h0 = points[i]![0] - points[i - 1]![0];
    const h1 = points[i + 1]![0] - points[i]![0];
    const s0 = slopes[i - 1]!;
    const s1 = slopes[i]!;
    const p = (s0 * h1 + s1 * h0) / (h0 + h1);
    out[i] = (Math.sign(s0) + Math.sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p));
  }
  if (count === 2) {
    out[0] = slopes[0]!;
    out[1] = slopes[0]!;
  } else {
    out[0] = (3 * slopes[0]! - out[1]!) / 2;
    out[count - 1] = (3 * slopes.at(-1)! - out[count - 2]!) / 2;
  }
  return out;
}

type Style = "past" | "past-gap" | "now-gap" | "now";
const STRENGTH: Record<Style, number> = { past: 0.45, "past-gap": 0.4, "now-gap": 0.7, now: 1 };

function series(
  values: readonly (number | null)[],
  xs: readonly number[],
  y: (v: number) => number,
  inPeriod: readonly boolean[],
  color: string,
  out: string[],
): { x: number; y: number }[] {
  const points = values.flatMap((v, i) => (v === null ? [] : [{ i, x: xs[i]!, y: y(v) }]));
  const t = tangents(points.map((p) => [p.x, p.y]));
  const paths = new Map<Style, string[]>();
  let style: Style | null = null;
  let d = "";
  for (let k = 0; k < points.length - 1; k += 1) {
    const a = points[k]!;
    const b = points[k + 1]!;
    const segment: Style = `${inPeriod[a.i] ? "now" : "past"}${b.i - a.i > 1 ? "-gap" : ""}` as Style;
    const dx = (b.x - a.x) / 3;
    const curve = `C${n(a.x + dx)} ${n(a.y + dx * t[k]!)} ${n(b.x - dx)} ${n(b.y - dx * t[k + 1]!)} ${n(b.x)} ${n(b.y)} `;
    if (segment !== style) {
      if (d && style) paths.set(style, [...(paths.get(style) ?? []), d.trim()]);
      style = segment;
      d = `M${n(a.x)} ${n(a.y)} `;
    }
    d += curve;
  }
  if (d && style) paths.set(style, [...(paths.get(style) ?? []), d.trim()]);
  for (const s of ["past", "past-gap", "now-gap", "now"] as const) {
    for (const path of paths.get(s) ?? []) {
      const width = s === "now" ? 2.1 : s === "past" ? 1.6 : 1.5;
      const dash = s.endsWith("gap") ? ' stroke-dasharray="0.1 4.2"' : "";
      out.push(
        `<path d="${path}" fill="none" stroke="${onPaper(color, STRENGTH[s])}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${dash}/>`,
      );
    }
  }
  const only = points.length === 1 ? points[0] : undefined;
  if (only && !inPeriod[only.i]) {
    out.push(`<circle cx="${n(only.x)}" cy="${n(only.y)}" r="2.4" fill="${onPaper(color, 0.45)}"/>`);
  }
  return points.filter((p) => inPeriod[p.i]).map((p) => ({ x: p.x, y: p.y }));
}

function text(x: number, y: number, body: string, attrs: string): string {
  return `<text x="${n(x)}" y="${n(y)}" ${attrs}>${esc(body)}</text>`;
}

/**
 * The two panels as SVG strings, or null when nothing was recorded. `days`
 * is the digest's history: earlier days first, then the period's.
 */
export function reportChart(
  days: readonly DigestDay[],
  periodFirstDay: string,
  language: ReportLanguage,
): { moodAnxiety: string; sleep: string; weeks: number; low: number } | null {
  if (!days.some((d) => d.mood !== null || d.anxiety !== null || d.sleepHours !== null)) return null;
  const s = REPORT_STRINGS[language];
  const count = days.length;
  const W = 660;
  const left = 30;
  const right = 8;
  const slot = (W - left - right) / count;
  const xs = days.map((_, i) => left + slot * (i + 0.5));
  const inPeriod = days.map((d) => d.day >= periodFirstDay);
  const w0 = inPeriod.indexOf(true) === -1 ? count : inPeriod.indexOf(true);
  const bandX = left + slot * w0;
  const bandW = slot * (count - w0);
  const tick = `font-family="${SANS}" font-size="8.5" fill="#6b6e75" text-anchor="end"`;
  const gradient = (id: string) =>
    `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${onPaper(LIGHT[0], 0.78)}"/><stop offset=".55" stop-color="${onPaper(LIGHT[1], 0.78)}"/><stop offset="1" stop-color="${onPaper(LIGHT[2], 0.78)}"/></linearGradient></defs>`;

  // Panel A: mood and anxiety, 1 to 5 (0 to 5 when anyone recorded a 0).
  const low = days.some((d) => (d.mood !== null && d.mood < 1) || (d.anxiety !== null && d.anxiety < 1))
    ? 0
    : 1;
  const top = 22;
  const h = 118;
  const ya = (v: number) => top + ((5 - v) / (5 - low)) * h;
  const first = days[0]!.day;
  const last = days.at(-1)!.day;
  const alt = esc(s.chartAlt(formatDayMonth(first, language), formatDayMonth(last, language)));
  const a: string[] = [
    `<svg viewBox="0 0 ${W} ${n(top + h + 12)}" role="img" aria-label="${alt}" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:auto;overflow:visible">`,
    gradient("sintr-band-a"),
  ];
  if (w0 < count) {
    a.push(
      `<rect x="${n(bandX)}" y="0" width="${n(bandW)}" height="${n(top + h + 12)}" rx="8" fill="url(#sintr-band-a)"/>`,
      text(
        bandX + 8,
        13,
        s.thisPeriod,
        `font-family="${SERIF}" font-style="italic" font-size="9.5" fill="#6b6e75"`,
      ),
    );
  }
  for (const v of low === 0 ? [0, 3, 5] : [1, 3, 5]) {
    a.push(
      `<line x1="${left}" x2="${W - right}" y1="${n(ya(v))}" y2="${n(ya(v))}" stroke="#e8e6e1" stroke-width="1"/>`,
    );
    a.push(text(left - 10, ya(v) + 3.5, String(v), tick));
  }
  const anxiety = series(
    days.map((d) => d.anxiety),
    xs,
    ya,
    inPeriod,
    ANXIETY_COLOR,
    a,
  );
  const mood = series(
    days.map((d) => d.mood),
    xs,
    ya,
    inPeriod,
    MOOD_COLOR,
    a,
  );
  // Anxiety as rings, mood as dots on top: equal values read as a dot in a ring.
  for (const p of anxiety) {
    a.push(
      `<circle cx="${n(p.x)}" cy="${n(p.y)}" r="4.4" fill="#ffffff" stroke="${ANXIETY_COLOR}" stroke-width="1.8"/>`,
    );
  }
  for (const p of mood) {
    a.push(
      `<circle cx="${n(p.x)}" cy="${n(p.y)}" r="2.9" fill="${MOOD_COLOR}" stroke="#ffffff" stroke-width="1.5"/>`,
    );
  }
  a.push("</svg>");

  // Panel B: hours of sleep, on its own scale.
  const sleep = days.map((d) => d.sleepHours);
  const recorded = sleep.filter((v): v is number => v !== null);
  const lo = Math.min(4, ...recorded.map((v) => Math.floor(v)));
  const hi = Math.max(9, ...recorded.map((v) => Math.ceil(v)));
  const btop = 8;
  const bh = 50;
  const axis = 30;
  const base = btop + bh;
  const yb = (v: number) => base - ((v - lo) / (hi - lo)) * bh;
  const b: string[] = [
    `<svg viewBox="0 0 ${W} ${n(base + axis)}" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:auto;overflow:visible">`,
    gradient("sintr-band-b"),
  ];
  if (w0 < count) {
    b.push(
      `<rect x="${n(bandX)}" y="0" width="${n(bandW)}" height="${n(base + 4)}" rx="8" fill="url(#sintr-band-b)"/>`,
    );
  }
  for (const v of [4, 6, 8]) {
    if (v < lo || v > hi) continue;
    b.push(
      `<line x1="${left}" x2="${W - right}" y1="${n(yb(v))}" y2="${n(yb(v))}" stroke="#e8e6e1" stroke-width="1"/>`,
    );
    b.push(text(left - 10, yb(v) + 3.5, `${v}h`, tick));
  }
  for (const p of series(sleep, xs, yb, inPeriod, SLEEP_COLOR, b)) {
    b.push(
      `<circle cx="${n(p.x)}" cy="${n(p.y)}" r="2.6" fill="${SLEEP_COLOR}" stroke="#ffffff" stroke-width="1.5"/>`,
    );
  }
  // Every day of the period by name; earlier weeks by their first day, counted back in sevens.
  days.forEach((d, i) => {
    if (inPeriod[i]) {
      b.push(
        text(
          xs[i]!,
          base + 15,
          s.weekdaysShort[d.weekday]!,
          `font-family="${SANS}" font-size="8.5" font-weight="500" fill="#474a51" text-anchor="middle"`,
        ),
        text(
          xs[i]!,
          base + 26,
          String(Number(d.day.slice(8))),
          `font-family="${SANS}" font-size="8.5" fill="#6b6e75" text-anchor="middle"`,
        ),
      );
    } else if ((w0 - i) % 7 === 0) {
      b.push(
        text(
          xs[i]!,
          base + 15,
          formatDayMonth(d.day, language),
          `font-family="${SANS}" font-size="8.5" fill="#6b6e75" text-anchor="middle"`,
        ),
      );
    }
  });
  b.push("</svg>");

  return { moodAnxiety: a.join(""), sleep: b.join(""), weeks: Math.ceil(count / 7), low };
}

/** The legend's two marks, as small inline SVGs. */
export function legendMark(kind: "mood" | "anxiety"): string {
  const color = kind === "mood" ? MOOD_COLOR : ANXIETY_COLOR;
  const dot =
    kind === "mood"
      ? `<circle cx="11" cy="5" r="2.9" fill="${color}" stroke="#ffffff" stroke-width="1.5"/>`
      : `<circle cx="11" cy="5" r="3.6" fill="#ffffff" stroke="${color}" stroke-width="1.8"/>`;
  return `<svg viewBox="0 0 22 10" width="17" height="8" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" style="overflow:visible"><line x1="1" y1="5" x2="21" y2="5" stroke="${color}" stroke-width="2" stroke-linecap="round"/>${dot}</svg>`;
}
