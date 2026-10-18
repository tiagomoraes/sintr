/**
 * The report's print stylesheet: the sintr design system (docs/DESIGN.md)
 * on an A4 sheet. Plaster-white paper, graphite ink and hairlines; the only
 * color is window light (the header of page 1, this period's band in the
 * chart) and its faint echoes: the peach highlighter under the person's own
 * words, the notebook's margin and rules, the draft dot. No shadows and no
 * transparency: on paper hairlines do the work, and every viewer shows the
 * same page.
 */
export const REPORT_CSS = `
:root {
  --paper: #ffffff;
  --ink: #16171a;
  --ink-2: #474a51;
  --ink-3: #6b6e75;
  --ink-soft: #82858c;
  --rule: #e8e6e1;
  --mark: #fbe0cd;
  --margin: #f2cdb9;
  --ruled: #e5edf4;
  --draft: #e09a76;
  --serif: "Source Serif 4", "Iowan Old Style", Charter, Georgia, serif;
  --sans: "Hanken Grotesk", ui-sans-serif, system-ui, sans-serif;
}
@page {
  size: A4;
  margin: 16mm 18mm 17mm;
  @bottom-left { font-family: var(--sans); font-size: 6.75pt; color: #6b6e75; vertical-align: top; padding-top: 5mm; }
  @bottom-right { font-family: var(--sans); font-size: 6.75pt; color: #6b6e75; vertical-align: top; padding-top: 5mm; }
}
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: var(--paper); }
body {
  margin: 0;
  color: var(--ink);
  background: var(--paper);
  font-family: var(--serif);
  font-size: 10.5pt;
  line-height: 1.58;
  font-optical-sizing: auto;
  font-kerning: normal;
  -webkit-font-smoothing: antialiased;
}
p { margin: 0; text-wrap: pretty; }
p, li, dd, h1, h2, h3, .note__when, .note__tag, .masthead__conf { overflow-wrap: anywhere; }
ul, dl, dd, figure { margin: 0; padding: 0; }
ul { list-style: none; }
h1, h2, h3 { margin: 0; font-weight: 300; }
strong { font-weight: 600; }

/* The window light, page 1 only: an opaque image laid on the paper. */
.light { position: absolute; top: 0; right: 0; width: 110mm; height: auto; display: block; }
.doc { position: relative; zoom: .906; }

.masthead { display: flex; align-items: center; justify-content: space-between; gap: 8mm; }
.mark { display: inline-flex; align-items: center; gap: 7px; }
.mark svg { width: 19px; height: 19px; }
.mark__word { font-family: var(--serif); font-size: 15pt; font-weight: 400; letter-spacing: -.02em; line-height: 1; }
.masthead__conf { position: relative; font-family: var(--sans); font-size: 7.5pt; color: var(--ink-2); }

.status { display: inline-flex; align-items: center; gap: 7px; margin-top: 9mm; font-family: var(--sans); font-size: 8pt; color: var(--ink-2); }
.status__dot { width: 6px; height: 6px; border-radius: 50%; background: var(--draft); box-shadow: 0 0 0 3px #fbe6da; }

.title {
  margin-top: 21mm;
  max-width: 128mm;
  font-family: var(--serif);
  font-size: 28pt;
  font-weight: 300;
  line-height: 1.06;
  letter-spacing: -.024em;
  text-wrap: balance;
}
.status + .title { margin-top: 18mm; }
.title__b { color: var(--ink-soft); }

.facts { display: flex; flex-wrap: wrap; gap: 3mm 10mm; margin-top: 10mm; padding-top: 3.5mm; border-top: 1px solid var(--ink); }
.facts dt { font-family: var(--sans); font-size: 7.5pt; line-height: 1.4; color: var(--ink-3); }
.facts dd { font-family: var(--serif); font-size: 11pt; line-height: 1.35; }
.facts__sub { display: block; font-family: var(--sans); font-size: 7.5pt; line-height: 1.5; color: var(--ink-3); }

.sec { margin-top: 11mm; padding-top: 4.5mm; border-top: 1px solid var(--rule); }
.sec h2 { margin-bottom: 5mm; font-size: 19pt; line-height: 1.1; letter-spacing: -.016em; break-after: avoid; }
.sec > p + p, .reading p + p { margin-top: 2.6mm; }

/* Page 1 is a letter: exactly one page, its note at the foot. */
.cover { display: flex; flex-direction: column; min-height: 290mm; break-after: page; }
.cover + .sec { margin-top: 0; }
.cover--flow { display: block; min-height: 0; break-after: auto; }
.cover--flow + .sec { margin-top: 11mm; }
.cover .foot { margin-top: auto; padding-top: 4mm; }
.cover > .sec:last-of-type { margin-bottom: 8mm; }

.lede { max-width: 152mm; font-size: 12.5pt; line-height: 1.55; }
.lede + .lede { margin-top: 3mm; }
.quiet { color: var(--ink-3); font-style: italic; }
.intro { max-width: 152mm; margin-bottom: 5mm; color: var(--ink-2); font-style: italic; }

.stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0 6mm; break-inside: avoid; }
.stat { border-top: 1px solid var(--ink); padding-top: 2.4mm; }
.stat dt { font-family: var(--sans); font-size: 7.5pt; line-height: 1.4; color: var(--ink-3); }
.stat__value { margin-top: 1.2mm; font-size: 23pt; font-weight: 300; line-height: 1.05; letter-spacing: -.02em; white-space: nowrap; }
.stat__unit { margin-left: 1.6mm; font-family: var(--sans); font-size: 7.5pt; letter-spacing: 0; color: var(--ink-3); }
.stat__sub { margin-top: 1.4mm; font-family: var(--sans); font-size: 7pt; line-height: 1.45; color: var(--ink-3); }
.reading { max-width: 152mm; margin-top: 5mm; }

.chart { margin-top: 5mm; break-inside: avoid; }
.chart__head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 2mm 6mm; margin-bottom: 1.5mm; }
.chart__title { font-family: var(--sans); font-size: 7.5pt; color: var(--ink-3); }
.chart__title--b { margin: 2.5mm 0 1mm; }
.legend { display: flex; gap: 5mm; font-family: var(--sans); font-size: 7.5pt; color: var(--ink-2); }
.legend li { display: inline-flex; align-items: center; gap: 1.6mm; }
.chart figcaption { margin-top: 1.5mm; font-family: var(--sans); font-size: 7pt; line-height: 1.45; color: var(--ink-3); }

.days { width: 100%; margin-top: 6mm; table-layout: fixed; border-collapse: collapse; break-inside: avoid; font-variant-numeric: tabular-nums; }
.days caption { caption-side: top; padding-bottom: 2mm; text-align: left; font-family: var(--sans); font-size: 7.5pt; color: var(--ink-3); }
.days thead td:first-child, .days tbody th { width: 29mm; }
.days thead th, .days thead td { padding: 0 0 1.6mm; border-bottom: 1px solid var(--ink); font-weight: 400; }
.days thead th { text-align: center; font-family: var(--sans); font-size: 7.5pt; line-height: 1.3; }
.days__wd { display: block; color: var(--ink-2); font-weight: 500; }
.days__d { display: block; color: var(--ink-3); }
.days tbody th { padding: 1.3mm 0 1.1mm; text-align: left; font-family: var(--sans); font-size: 7.5pt; font-weight: 400; color: var(--ink-3); }
.days td { padding: 1.1mm 0 .9mm; text-align: center; font-size: 10.5pt; line-height: 1.3; }
.days tbody tr + tr th, .days tbody tr + tr td { border-top: 1px solid var(--rule); }
.days__none { color: var(--ink-soft); }
.days__marks i { display: inline-block; width: 5px; height: 5px; margin: 0 1.5px; border-radius: 50%; background: var(--ink-2); vertical-align: 1.5px; }

.daynotes { margin-top: 5mm; break-inside: avoid; }
.daynotes__title { margin-bottom: 2mm; font-family: var(--sans); font-size: 7.5pt; color: var(--ink-3); }

.obs { border-top: 1px solid var(--ink); }
.obs li { display: grid; grid-template-columns: 31mm minmax(0, 1fr); gap: 0 12px; padding: 2.6mm 0 2.4mm; border-bottom: 1px solid var(--rule); break-inside: avoid; }
.obs--notes li { padding: .9mm 0 .7mm; font-size: 10pt; line-height: 1.4; }
.obs__when { padding-top: 2.5px; font-family: var(--sans); font-size: 7.5pt; line-height: 1.4; color: var(--ink-3); }
.obs__what { max-width: 132mm; }

.note { position: relative; margin-top: 4mm; border: 1px solid var(--rule); border-radius: 10px; background: var(--paper); overflow: hidden; break-inside: avoid; }
.sec h2 + .note { margin-top: 0; }
.note::before, .topics::before { content: ""; position: absolute; top: 0; bottom: 0; left: 20px; width: 1px; background: var(--margin); }
.note__head { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 1mm 6mm; padding: 8px 16px 7px 34px; border-bottom: 1px solid var(--rule); }
.note__when { font-style: italic; font-size: 10pt; color: var(--ink-2); }
.note__tag { font-family: var(--sans); font-size: 7.5pt; color: var(--ink-3); }
.note__title { padding: 10px 16px 2px 34px; font-size: 13.5pt; font-weight: 400; line-height: 1.25; letter-spacing: -.01em; }
.note__feel { padding: 5px 16px 4px 34px; }
.note__rows { padding: 2px 16px 5px 34px; }
.note__row { display: grid; grid-template-columns: 31mm minmax(0, 1fr); gap: 0 12px; padding: 6px 0 5px; border-bottom: 1px solid var(--ruled); }
.note__row:last-child { border-bottom: 0; }
.note__row dt { padding-top: 2.5px; font-family: var(--sans); font-size: 7.5pt; line-height: 1.4; color: var(--ink-3); }
.note__row dd { font-size: 10.5pt; line-height: 1.45; }
.none { font-family: var(--sans); font-size: 8pt; color: var(--ink-3); font-style: italic; }

/* The highlighter: a solid peach band low on the line, for verbatim words only. */
.said {
  quotes: "\\201C" "\\201D";
  background-image: linear-gradient(var(--mark), var(--mark));
  background-repeat: no-repeat;
  background-size: 100% 34%;
  background-position: 0 92%;
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
  padding-inline: .06em;
}
.thought { display: block; }
.thought + .thought { margin-top: 1.2mm; }
.feel { display: flex; flex-wrap: wrap; gap: 1mm 5mm; }
.scale { display: inline-block; margin-left: 5px; padding: 0 6px; border: 1px solid var(--rule); border-radius: 999px; font-family: var(--sans); font-size: 7pt; line-height: 1.6; color: var(--ink-3); font-variant-numeric: tabular-nums; vertical-align: 1.5px; white-space: nowrap; }
.scale--after { margin-left: 0; margin-top: 1.4mm; }
.scale--tag { margin-left: 4px; vertical-align: 1px; }
.arrow { width: 8px; height: 6px; fill: none; stroke: currentColor; stroke-width: 1.3; stroke-linecap: round; stroke-linejoin: round; }

.dash { display: grid; gap: 1.8mm; max-width: 152mm; }
.dash li { position: relative; padding-left: 16px; break-inside: avoid; }
.dash li::before { content: ""; position: absolute; left: 1px; top: .8em; width: 7px; height: 1px; background: var(--ink-soft); }

.topics { position: relative; padding: 3px 16px 3px 34px; border: 1px solid var(--rule); border-radius: 10px; }
.topics li { display: flex; align-items: flex-start; gap: 10px; padding: 8px 0 7px; border-bottom: 1px solid var(--ruled); font-size: 11pt; line-height: 1.45; break-inside: avoid; }
.topics li:last-child { border-bottom: 0; }
.tick { flex: none; width: 11px; height: 11px; margin-top: 3.5px; border: 1.3px solid var(--ink-soft); border-radius: 3px; }

.foot { margin-top: 13mm; padding-top: 4mm; border-top: 1px solid var(--rule); break-inside: avoid; }
.foot p { max-width: 150mm; font-style: italic; font-size: 8.5pt; line-height: 1.5; color: var(--ink-3); }
.foot p + p { margin-top: 1.5mm; }
`;
