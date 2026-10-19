---
name: sintr website
description: The visual system of the public sintr site (sintr.tiagomoraes.cloud), a human home page and a technical reading page. A white consulting-room wall that window light crosses as the week between sessions goes by.
colors:
  ink: "#16171a"
  ink-pressed: "#000000"
  ink-confirm: "#23302a"
  verbatim-peach: "#fbe0cd"
  notebook-margin: "#f2cdb9"
  notebook-rule: "#e5edf4"
  draft-peach: "#e09a76"
  light-morning-sky: "#d4e6f4"
  light-morning-linen: "#f1e8df"
  light-morning-peach: "#f8dcc8"
  leaf-shadow-sage: "#a9b9a3"
  paper: "#ffffff"
  ink-2: "#474a51"
  ink-3: "#6b6e75"
  ink-soft: "#82858c"
  rule: "#e8e6e1"
  rule-strong: "#d4d2cc"
  wash: "#f5f4f1"
typography:
  display:
    fontFamily: "Source Serif 4, Iowan Old Style, Charter, Georgia, serif"
    fontSize: "clamp(2.75rem, 1.35rem + 4.7vw, 5.75rem)"
    fontWeight: 300
    lineHeight: 1.02
    letterSpacing: "-0.028em"
  display-doc:
    fontFamily: "Source Serif 4, Iowan Old Style, Charter, Georgia, serif"
    fontSize: "clamp(2.75rem, 1.6rem + 4vw, 5rem)"
    fontWeight: 300
    lineHeight: 1.02
    letterSpacing: "-0.028em"
  headline-statement:
    fontFamily: "Source Serif 4, Iowan Old Style, Charter, Georgia, serif"
    fontSize: "clamp(2.25rem, 1.2rem + 3.6vw, 4.5rem)"
    fontWeight: 300
    lineHeight: 1.06
    letterSpacing: "-0.024em"
  headline:
    fontFamily: "Source Serif 4, Iowan Old Style, Charter, Georgia, serif"
    fontSize: "clamp(2.125rem, 1.3rem + 2.7vw, 3.75rem)"
    fontWeight: 300
    lineHeight: 1.06
    letterSpacing: "-0.022em"
  title:
    fontFamily: "Source Serif 4, Iowan Old Style, Charter, Georgia, serif"
    fontSize: "clamp(1.875rem, 1.2rem + 2.1vw, 3.125rem)"
    fontWeight: 300
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  doc-heading:
    fontFamily: "Source Serif 4, Iowan Old Style, Charter, Georgia, serif"
    fontSize: "clamp(2rem, 1.4rem + 1.8vw, 2.875rem)"
    fontWeight: 300
    lineHeight: 1.08
    letterSpacing: "-0.02em"
  step-numeral:
    fontFamily: "Source Serif 4, Iowan Old Style, Charter, Georgia, serif"
    fontSize: "2.75rem"
    fontWeight: 300
    lineHeight: 1
  step-title:
    fontFamily: "Source Serif 4, Iowan Old Style, Charter, Georgia, serif"
    fontSize: "1.5rem"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "-0.012em"
  title-small:
    fontFamily: "Source Serif 4, Iowan Old Style, Charter, Georgia, serif"
    fontSize: "1.375rem"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  payoff:
    fontFamily: "Source Serif 4, Iowan Old Style, Charter, Georgia, serif"
    fontSize: "clamp(1.875rem, 1.2rem + 2vw, 3rem)"
    fontWeight: 300
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  note-value-large:
    fontFamily: "Source Serif 4, Iowan Old Style, Charter, Georgia, serif"
    fontSize: "1.375rem"
    fontWeight: 400
    lineHeight: 1.45
  lede:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.125rem, 1rem + 0.4vw, 1.3125rem)"
    fontWeight: 400
    lineHeight: 1.55
  body:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.65
  document:
    fontFamily: "Source Serif 4, Iowan Old Style, Charter, Georgia, serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.62
  note-value:
    fontFamily: "Source Serif 4, Iowan Old Style, Charter, Georgia, serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.005em"
  caption:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.45
  file-body:
    fontFamily: "Fragment Mono, ui-monospace, SF Mono, Menlo, Consolas, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.8
  file-path:
    fontFamily: "Fragment Mono, ui-monospace, SF Mono, Menlo, Consolas, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  pill: "999px"
  bubble: "20px"
  panel: "18px"
  file: "14px"
  command: "12px"
  paper: "6px"
  inline: "6px"
  tick: "4px"
spacing:
  gutter: "clamp(20px, 5vw, 72px)"
  section: "clamp(104px, 13vw, 208px)"
  section-home: "clamp(88px, 10vw, 148px)"
  column-gap: "24px"
  container: "1360px"
  note-margin: "44px"
components:
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 26px 0 22px"
    height: "52px"
  button-ink-hover:
    backgroundColor: "{colors.ink-pressed}"
  button-ink-confirmed:
    backgroundColor: "{colors.ink-confirm}"
  button-ink-small:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: "0 18px"
    height: "40px"
  button-copy-icon:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    size: "36px"
  notebook-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.note-value}"
    rounded: "{rounded.file}"
    padding: "2px 20px 6px 44px"
  notebook-card-label:
    textColor: "{colors.ink-3}"
    typography: "{typography.caption}"
  notebook-card-value-inline:
    textColor: "{colors.ink}"
    typography: "{typography.note-value-large}"
  notebook-tick:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.tick}"
    size: "16px"
  notebook-tick-done:
    backgroundColor: "{colors.ink}"
    rounded: "{rounded.tick}"
    size: "16px"
  file-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.file-body}"
    rounded: "{rounded.file}"
    padding: "16px 18px 18px"
  file-card-path:
    textColor: "{colors.ink-3}"
    typography: "{typography.file-path}"
    padding: "12px 18px 11px"
  paper-document:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.document}"
    rounded: "{rounded.paper}"
    padding: "clamp(24px, 4vw, 56px) clamp(22px, 4.4vw, 64px) clamp(28px, 4vw, 52px)"
  paper-status:
    textColor: "{colors.ink-2}"
    typography: "{typography.caption}"
  setup-message:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.file}"
    padding: "20px 22px"
  payoff-line:
    textColor: "{colors.ink}"
    typography: "{typography.payoff}"
  promise-row:
    textColor: "{colors.ink-2}"
    typography: "{typography.body}"
    padding: "22px 0 0"
  chat-time-divider:
    textColor: "{colors.ink-3}"
    padding: "18px 0 0"
  ask-card:
    textColor: "{colors.ink}"
    rounded: "{rounded.bubble}"
    padding: "28px 28px 26px"
  step:
    textColor: "{colors.ink}"
    typography: "{typography.step-title}"
    padding: "26px 0 0"
  chat-bubble-you:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.ink}"
    rounded: "{rounded.bubble}"
    padding: "13px 18px"
  chat-bubble-agent:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.bubble}"
    padding: "13px 18px"
  chat-bubble-mini:
    rounded: "{rounded.bubble}"
    padding: "9px 14px"
  segmented-toggle:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: "4px"
  segmented-option:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  segmented-option-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  tab:
    textColor: "{colors.ink-3}"
    padding: "10px 0 14px"
  tab-selected:
    textColor: "{colors.ink}"
  toc-link:
    textColor: "{colors.ink-3}"
    padding: "6px 0 6px 16px"
  toc-link-current:
    textColor: "{colors.ink}"
  specs-row:
    textColor: "{colors.ink-2}"
    padding: "16px 0 17px"
  command-block:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.ink}"
    typography: "{typography.file-body}"
    rounded: "{rounded.command}"
    padding: "18px 60px 18px 20px"
  inline-code:
    backgroundColor: "{colors.wash}"
    rounded: "{rounded.inline}"
    padding: "0.08em 0.38em"
  support-line:
    textColor: "{colors.ink}"
    padding: "14px 0"
  support-call:
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 16px 0 13px"
---

# Design System: sintr website

This file records the visual system of the public **sintr** website (`site/`): the home page (`site/index.html`, for a person in therapy who is not technical) and the Under the hood page (`site/tech/index.html`, served at `/tech/`, for builders). It covers the site only. The product's data model (ledger files, frontmatter fields, statuses) is a different document: see `docs/DESIGN.md`. Product truth lives in `PRODUCT.md`; the rationale and references for the site are in `site/DESIGN-NOTES.md`. Tokens are normative in the frontmatter above and are mirrored as custom properties in `site/styles.css` (`:root` for the shared palette; the notebook rule and margin colors are scoped on the notebook card).

## Overview

**Creative North Star: "The Consulting-Room Wall"**

The page is the white wall of a quiet consulting room, and window light crosses it while the week between two sessions goes by. The ground is plaster white, everything structural is graphite ink and hairline, and the only color in the world is light: a tall, obliquely projected window of soft gradient with blurred sage leaf shadows, multiplied onto the page. On the home, as the reader moves through the week, the light changes time of day (morning, noon, dusk, golden hour, night, late morning, dawn) and cross-fades rather than jumps; the early-morning and evening palettes stay defined for future sections. On `/tech/` the same light is held at noon in the header and fades out before the reading starts.

Hierarchy is carried by type size and line breaks alone. A light, optically sized serif speaks at display size in two tones; a quiet grotesk does the reading. The two pages share every token and face but show the product in two registers. The home demonstrates it as a person lives it, one mock per idea: a single **notebook card** in the hero (white paper with faint school-paper rules and a peach margin line, human labels in the sans and the person's own words in the serif) that writes itself on load, then a conversation in chat bubbles and the report as a sheet of paper. `/tech/` demonstrates it as it is built: real sintr file formats set as selectable Fragment Mono text in white cards captioned by their path, beside specification tables and numbered pipeline steps. The mono face lives on `/tech/` only.

Density is low and the pace is slow. Sections are separated by large vertical rests and single hairlines, not by fills or boxes. Motion is opt-in and unhurried: the light moves over about three seconds, leaves sway on 13 and 17 second cycles, and content settles in with a short blur-to-sharp fade. With JavaScript off or reduced motion requested, the light rests at the top of the page and everything reads. The wellness-app default (pastel blob hero, phone mockup, feature-card trio), the developer-tool default (dark terminal page, install commands up front) and developer-portal chrome are all rejected.

**Key Characteristics:**
- White ground, graphite ink, black pill controls; light is the only color, echoed faintly on paper.
- Light serif display (weight 300) carrying hierarchy by size and two tones, never by labels.
- Two registers of artifact: the notebook card on the home (sans labels, serif words; one per page, in the hero), real file cards in mono on `/tech/`.
- Hairline-ruled structure on a 12-column grid with generous section rests.
- A time-of-day light that moves with the reader on the home, stays in the header on the reading page, and disappears into a static wash when motion is unwelcome.

## Colors

A near-monochrome paper-and-graphite palette; the only chroma is window light and its faint echoes on paper: a peach highlighter for a person's own words, the notebook's sky rules and peach margin, and one peach status dot.

### Primary
- **Graphite Ink** (`ink`): text, every primary button, the selected state of every control, focus rings, the gate markers in the flow diagrams, the top rule of each get-started step, specification tables and the privacy list, the current-section dot in the contents list, the checked box of a done task, and the background of the brand glyph. Black is the action color; there is no colored CTA.
- **Pressed Black** (`ink-pressed`): the hover fill of ink buttons; a one-step deepening, not a new hue.
- **Confirmed Ink** (`ink-confirm`): the brief "Copied" state of a copy action, a green-tinted near-black that confirms without introducing a success color. The bordered icon variant confirms with a deep green glyph (#2f5a3f) on a pale sage edge (#b9cdb9).

### Secondary
- **Verbatim Peach** (`verbatim-peach`): the highlighter. It underlays a person's own quoted words as a low band: 10% to 36% of the line height in headings, 8% to 42% on a quoted thought in a notebook card, 0% to 46% inside files and the report paper. It is also the text-selection color. It marks testimony, never emphasis in general.
- **Notebook Margin** (`notebook-margin`): the single 1px vertical margin rule of every notebook card, 26px in from the left edge, full height. The school-paper margin, nothing more.
- **Notebook Rule** (`notebook-rule`): the sky-tinted ruled hairlines between rows, tasks and the closing line inside a notebook card. Never used outside the card; the card's outer edge and head divider stay Hairline.
- **Draft Peach** (`draft-peach`): the 7px status dot, ringed 3px in a pale peach (#fbe6da), that marks the report as a draft waiting for the person. The one status color on the site.

### Tertiary
- **Window Light** (`light-morning-sky`, `light-morning-linen`, `light-morning-peach`, `leaf-shadow-sage`): the three gradient stops of the projected window and the leaf-shadow fill, shown here at their morning (default) values. Each time of day swaps all four as registered `@property` colors so the light cross-fades over 2.8s. The palettes per time are recorded in `.impeccable/design.json` (`extensions.lightPalettes`); the hues stay within sky, linen, peach, lavender and sage at very high lightness, and night drops to a cool grey-blue at lower opacity. `/tech/` holds the noon palette.

### Neutral
- **Plaster White** (`paper`): the page ground and every card, notebook, paper and agent bubble. Cards are the same white as the wall; they separate by hairline and shadow, not by tone.
- **Ink Two** (`ink-2`): lede, prose, agent chat text, secondary links and nav, the notebook's italic time line, specification descriptions, the draft status line. The reading gray.
- **Ink Three** (`ink-3`): tertiary text that still has to pass 4.5:1 on white: notebook labels and card captions, file paths and keys, meta lines, table headers, the contents list at rest, field definitions, inactive tabs.
- **Soft Ink** (`ink-soft`): large text and marks only: the second tone of two-tone statements, step and pipeline numerals, list dashes, the empty checkbox outline, flow arrowheads. Below 4.5:1, so never for small text.
- **Hairline** (`rule`): every card edge, section divider, row rule, tab baseline and the contents list's left rule.
- **Strong Hairline** (`rule-strong`): flow edges, the stations spine, link underlines at rest, hover borders.
- **Wash** (`wash`): the one tinted surface: your own chat bubbles, command blocks, inline code, option hover, and the setup message inside the home's closed disclosure.

### Named Rules
**The Light Is the Only Color Rule.** Chroma lives in the window light. On paper it appears only as the light's own faint echoes: the peach highlighter, the notebook's sky rules and peach margin, and the draft dot. Gradients never fill text, buttons or cards; the light is a projection on the wall, multiplied onto whatever it falls across.

**The Morning Wash Exception.** At most one surface per page carries a faint light gradient as a fill: the setup-message card that asks the visitor to act (162deg, #e9f2f8 to #f3f2ee to #f9ebe1). Today that card lives on `/tech/` only ("The setup message from the home page"). The home no longer uses the exception: its setup message sits on plain Wash with a hairline inside a closed disclosure, so on the home the window light is the only color apart from the highlighter and the paper's faint echoes.

**The Verbatim Rule.** Peach highlights a person's own words. If the words are not a quotation of the person, they do not get the highlighter.

## Typography

**Display Font:** Source Serif 4 (with Iowan Old Style, Charter, Georgia), self-hosted variable 200 to 600, roman and italic, optical sizing on
**Body Font:** Hanken Grotesk (with ui-sans-serif, system-ui), self-hosted variable 300 to 700
**Label/Mono Font:** Fragment Mono (with ui-monospace, SF Mono, Menlo), 400 only, `/tech/` only

**Other scripts:** the home is published in eight languages. Latin text everywhere stays in the two faces above. Japanese falls back to the reader's own system faces (Hiragino Mincho / Yu Mincho / Noto Serif JP for the serif role, Hiragino Sans / Yu Gothic / Noto Sans JP for the sans role); Simplified Chinese likewise (Songti / Noto Serif SC, PingFang / Microsoft YaHei / Noto Sans SC). In those scripts headings drop the negative tracking, sit at line-height 1.3, use no synthetic italics, and the display steps down (max 4.1rem) so the hero still opens on its button. German display steps down to 4.75rem and its running text hyphenates. The person's quoted words take each language's own marks (“…”, „…“, « … », 「…」).

**Character:** A calm, precise notebook serif at light weight carries every heading, the person's words and the report itself, against a quiet grotesk that labels and explains and never competes. The mono is a material, not a mood: it means "this is the actual file", and it is shown only to readers who asked to see inside.

### Hierarchy
- **Display** (300, clamp 2.75rem to 5.75rem, 1.02, -0.028em, balanced): the home hero headline only. The `/tech/` headline uses **Display Doc**, the same voice capped at 5rem (clamp 2.75rem to 5rem).
- **Headline Statement** (300, clamp 2.25rem to 4.5rem, 1.06, -0.024em, max 15.5em): two-tone statements, each clause on its own line, the second in Soft Ink.
- **Headline** (300, clamp 2.125rem to 3.75rem, 1.06, -0.022em): home section heads; an XL variant reaches 5rem.
- **Title** (300, clamp 1.875rem to 3.125rem, 1.1, -0.02em, max 13em): the day headings. The time of day opens the sentence as an italic Ink Three line inside the heading ("*Tuesday, 7:40 pm.* Tell it while it's fresh.").
- **Payoff** (300, clamp 1.875rem to 3rem, 1.1, -0.02em, max 16em, balanced): the closing line of a scene sequence, set like a day heading without being one, with its own italic Ink Three day stamp opening the sentence ("*Monday, 6 pm.* The hour starts with Tuesday, ...").
- **Doc Heading** (300, clamp 2rem to 2.875rem, 1.08, -0.02em, 24px below): section heads on `/tech/`, one per hairline-topped section.
- **Step Numeral / Step Title** (300 at 2.75rem, line-height 1, Soft Ink; then 400 at 1.5rem, 1.2, -0.012em): the three get-started steps. Pipeline numerals on `/tech/` are the same light serif at 1.75rem.
- **Title Small** (400, 1.375rem, 1.25, -0.01em): sub-heads (the `/tech/` setup message card, the lifecycle), privacy promise terms, and the `/tech/` sub-sections (48px above, 14px below).
- **Lede** (400, clamp 1.125rem to 1.3125rem, 1.55, max 34em, Ink Two; 38em on `/tech/`): the hero paragraph.
- **Body** (400, 1.0625rem, 1.65; 1rem under 720px): prose at max 36em in Ink Two (40em in the `/tech/` text column); quiet prose steps to 1rem in Ink Three.
- **Document** (serif 400, 1.0625rem, 1.62): the body of the report paper; its section heads switch to the grotesk at 600, 0.9375rem.
- **Note Value** (serif 400, 1.0625rem, 1.45): the person's words in a notebook card, its observations and its tasks. Inline check-in values step up to **Note Value Large** (1.375rem, tabular, never wrapped; 1.1875rem when the card is under 360px). The card's time line is the serif italic at 1rem in Ink Two; the time divider inside a conversation is the same italic at 1rem in Ink Three.
- **Caption** (400, 0.8125rem, 1.45, Ink Three): human labels in notebook cards, the contents title, fact terms, table headers, flow edge labels, the draft status, segmented-toggle labels. Card tags and file notes drop to 0.75rem.
- **Label** (500, 0.9375rem to 1rem, line-height 1): buttons, nav, tabs, segmented options, the disclosure summary. Sentence case, never uppercase.
- **File Body / File Path** (mono, 0.8125rem / 1.8 and 0.75rem / 1.4): contents and path captions of real files, on `/tech/` only. Command blocks are mono at 0.8438rem / 1.85.

### Named Rules
**The Size Is the Hierarchy Rule.** Rank is expressed by size, weight 300 serif, and line breaks. No eyebrows, kickers, uppercase labels or icon tiles introduce a heading; context belongs inside the heading sentence.

**The Mono Means File Rule.** Fragment Mono appears only on `/tech/`, for real file contents, paths, and shell commands. It never decorates a heading or signals "technical". The home shows no mono and no paths; its one piece of technical text, the setup message for the assistant, is set in the grotesk inside a disclosure that starts closed.

**The Labels Sans, Words Serif Rule.** In a notebook card, what the system asks is in the small grotesk (Ink Three); what the person said or did is in the serif (ink). The pairing is how the card reads as a person's notebook rather than a form.

## Layout

A centered container (1360px max) with a fluid gutter (clamp 20px to 72px) holds a 12-column grid with a 24px column gap. Home compositions are asymmetric splits on that grid: copy in columns 1 to 5 or 1 to 7, artifacts in 7 to 12 or 8 to 12; a flipped day grid (artifact leading in 1 to 6, copy in 8 to 12) stays available, though the home's two scenes no longer use it. Day copy is sticky (top 12vh) beside its artifact on desktop; the report lifecycle column is sticky at 14vh. Section rests are large (clamp 104px to 208px, the `section` token); the home runs a tighter rhythm (`section-home`, clamp 88px to 148px) because the page is shorter, while `/tech/` keeps the original. Sections are divided by one full-width hairline. The hero fills the first viewport minus the 88px header and leaves the upper-right wall empty for the light. The "why" section sets its two-tone statement in columns 1 to 7 beside a single paragraph in 8 to 12, bottom-aligned. The report scene closes with the payoff line 64px to 112px below it. Privacy is a heading, then three promises in three equal columns (gap 24px) under one ink rule, then a one-sentence note at max 46em. The get-started section sets three steps in three equal columns (gap 40px 24px), then the closed setup disclosure below them at max 880px. The older privacy split (lead in 1 to 5, promise list in 7 to 12) and the get-started setup-card-plus-"then" row (1 to 7 and 9 to 12) remain defined but are not on the home.

`/tech/` is a reading layout on the same grid: a 3-column contents list sticky at 28px beside a 9-column text column. Each section opens on a hairline with a fluid rest (clamp 56px to 88px) and scrolls into view 24px below the top. Content blocks sit 28px apart; specification tables, pipeline lists, file cards and command blocks share that rhythm. Wide files keep their lines and scroll horizontally rather than wrap.

The flow line lives in its own size container (`flow`) and appears on `/tech/` only since the home was cut. It stays on one line while it fits, then turns into a vertical spine with 44px-tall edges: when its container is 860px or narrower on `/tech/` (a 1100px home breakpoint is still defined). A notebook card is also a size container: under 500px its rows stack label over value.

Responsive behavior: at 1100px the hero copy widens to 8 columns. At 900px every split collapses to a single column, sticky positioning is released, artifacts drop below their copy with a 44px to 64px rest, the steps stack, the three promises stack with a hairline under each (18px 0), the contents list becomes a static two-column list (each link on a hairline, 48px above the text) and the front matter pair stacks. At 720px body steps to 1rem, the header shrinks to 72px and drops its text links: the home keeps only the "Get started" pill, `/tech/` keeps the GitHub mark (22px) and the "Install" pill. The home light becomes one fixed oversized pane (150vw) that no longer travels, multi-column lists and specification rows stack, the setup card tightens to 22px 18px 20px, and chat bubbles widen to 92%. Below 380px button padding tightens. Parallax drift runs only above 900px.

### Named Rules
**The Held Wall Rule.** The first viewport keeps one wall region empty so the light has somewhere to land. Do not fill the upper right of the hero.

**The Light Stays in the Header Rule.** On a reading page the light never sits behind long text: it is absolute in the first 92vh, masked to fade out from 55% down, and does not follow the reader.

## Elevation & Depth

Hybrid and low. Surfaces are white on white and separate primarily by a 1px hairline; two soft, long, ink-tinted shadows lift the artifacts that rest in the light. Depth also comes from the light itself, which sits above the page in multiply blend so cards visibly take the light, and from slow parallax that lets artifacts drift a little slower than the words.

### Shadow Vocabulary
- **Card** (`box-shadow: 0 1px 2px rgba(22,23,26,.04), 0 18px 40px -22px rgba(22,23,26,.22)`): default notebook cards and file cards.
- **Lift** (`box-shadow: 0 2px 4px rgba(22,23,26,.05), 0 26px 50px -24px rgba(22,23,26,.28)`): the hero notebook card and the report paper, the two artifacts the page asks you to read.
- **Ink Button** (`box-shadow: 0 1px 1px rgba(22,23,26,.2), 0 10px 26px -10px transparent`, hover `0 16px 30px -12px rgba(232,168,130,.55)`): a contact shadow at rest; on hover a warm glow rises under the pill as it lifts 1px.
- **Paper Ring** (`box-shadow: 0 0 0 4px` or `5px` in paper white; `3px` pale peach on the draft dot): knocks dots out of the line or ground they sit on.

### Named Rules
**The Hairline First Rule.** A new surface gets a 1px hairline before it gets a shadow. Shadows are reserved for real artifacts resting in the light; the folder variant of the notebook card deliberately drops its shadow, the home's setup message sits on Wash with a hairline and no shadow, and the reading page's tables and lists are hairline only.

## Shapes

Soft rectangles and full pills. Controls are pills (999px) without exception: buttons, copy buttons, the outlined call buttons of the support lines, the segmented toggle and its options, the skip link, the small "of 100" scale chip in a notebook card. Containers soften by role: chat bubbles 20px with one 6px tail corner on the speaker's side, the setup card 20px, notebook and file cards and the home's setup message 14px, command blocks 12px, inline code and focus rings 6px, drawn checkboxes 4px. The report paper is nearly square (6px, 4px on mobile) because it is a sheet of paper, not a card. Lines are 1px throughout (1.5px on checkbox outlines and the disclosure chevron); markers are 7px to 13px circles and 7px chevrons built from borders. The recurring silhouettes are the skewed window grid, in the light and in the brand glyph, and the notebook's ruled page with its margin line.

## Components

### Buttons
Black, quiet, confident; the only filled controls on the page.
- **Shape:** full pill (999px).
- **Primary (ink):** Graphite Ink fill, white label at 500, 52px tall, padding 0 26px 0 22px, optional 18px line icon leading with a 10px gap. The small variant is 40px tall with 18px padding, used in the header ("Get started" on the home, "Install" on `/tech/`).
- **Hover / Focus:** fill deepens to Pressed Black, the pill lifts 1px, and a warm glow rises beneath it (transform 0.6s, shadow 0.8s, both on the expo-out ease); active returns to rest. Focus is a 2px ink outline offset 3px.
- **Copy:** an ink pill (40px, 0.9375rem) that appears only when JavaScript runs; on success it turns Confirmed Ink and its label reads the confirmation for 2.6s. The icon variant is a 36px white circle with a hairline edge and Ink Two glyph, pinned top-right inside command blocks; hover darkens glyph and edge only.
- **Text link:** ink text with a 1px Strong Hairline underline offset 0.28em that darkens to ink on hover.

### Segmented Toggle
- **Style:** a hairline-bordered white pill with 4px inset holding pill options (8px 16px, 500, Ink Two) and an optional leading label in Ink Three that hides under 720px.
- **State:** hover fills the option with Wash; the selected option is an ink pill with white text. Built on native radio inputs so it works without JavaScript and with arrow keys; focus draws a 2px ink outline on the visible option.

### Tabs
- **Style:** text labels at 500 in Ink Three on a single hairline baseline, 26px apart, no boxes.
- **State:** hover and selected turn the label ink; the selected tab grows a 2px ink underline from the left (scaleX, 0.6s). Panels fade up 6px over 0.7s. Native radios, no JavaScript required.

### Cards / Containers
- **Notebook card (signature, home):** the home shows exactly one, the hero card, which writes itself on load; the other variants below remain available system components but are not on the home. It is white, 1px hairline, 14px radius, Card shadow, clipped, and a size container. A 1px Notebook Margin line runs full height 26px from the left; all content starts at 44px. The head carries the time in serif italic (Ink Two) and a small sans tag on the right (0.75rem, Ink Three) above a Hairline. Rows are label over value or label beside value (a 7rem to 9.5rem label column, 18px gap), separated by Notebook Rule hairlines; under 500px of card width they stack. A quoted thought is a real `q` with curly quotes under the peach highlighter; an intensity carries a small hairline pill chip ("85 of 100"). Variants: the **hero** card (max 460px, Lift shadow, pushed right), the **check-in** card (max 440px, three inline values in Note Value Large, tabular and never wrapped, then a closing line with a sans label), the **tasks** card (rows with drawn 16px checkboxes: 1.5px Soft Ink outline when open, an ink fill with a white border-built check when done), the **paragraph** card (one serif observation at 1.5 line-height), and the **folder** card (max 460px, no shadow, a 13px stroked lock in its tag).
- **File card (signature, `/tech/`):** white, 1px hairline, 14px radius, Card shadow, clipped. A caption bar carries the real path in mono Ink Three (with an optional plain-sans note on the right) above a hairline; the body is mono at 0.8125rem / 1.8 with keys in Ink Three, numbers tabular, and quoted thoughts under the peach highlighter. The wide variant keeps lines unwrapped and scrolls horizontally; the narrow variant stops at 460px; two cards can sit side by side as a before-and-after pair (20px gap).
- **Report paper (signature):** a sheet, not a card: 6px radius, Lift shadow, generous fluid padding, serif body, grotesk section heads, short dash list markers in Soft Ink, and an italic foot over a hairline. On the home it opens straight on its title; above it sits a small status line (caption, Ink Two) led by the draft dot. The mono path and front matter of a report are shown on `/tech/` only, as file cards.
- **Setup card (the call to act, `/tech/`):** the one tinted container, 20px radius, the morning wash gradient, no border, no shadow, padding 28px 28px 26px. A head row pairs a Title Small heading with the ink Copy pill; a short Ink Two lead explains who the message is for; the message itself sits inside a disclosure under a 10% ink hairline, its summary a 500 label led by a 7px border-built chevron that turns from right to down over 0.4s. The message is grotesk at 1.0625rem / 1.66. The disclosure-with-lead form is defined but no page uses it now; `/tech/` shows the message open under its head row.
- **Setup disclosure (home):** no card and no gradient. A closed disclosure (max 880px) opens on the same 10% ink hairline and chevron summary ("Read the setup message before you copy it"); inside, the message sits on Wash with a 1px Hairline, 14px radius, 20px 22px padding, grotesk at 1.0625rem / 1.66, followed by a 0.875rem Ink Two foot. The copy action lives in the first get-started step, not beside the message.
- **Help panel:** hairline outline only, 18px radius, 24px 26px padding.
- **Command block (`/tech/`):** Wash fill, hairline, 12px radius, mono at 0.8438rem / 1.85, room on the right for the copy icon; shell prompts are Ink Three and unselectable.

### Chat Bubbles
- **Time divider:** inside a conversation, a later moment is marked by a full-width line: a 1px Hairline on top, 18px above the text, 14px above the rule, the day and time in serif italic at 1rem, Ink Three ("*Thursday, 8:50 am*"). It separates two exchanges; it is not a heading.
- **You:** Wash fill, ink text, aligned right, 20px radius with a 6px bottom-right tail.
- **Agent:** white with a hairline, Ink Two text, aligned left, 6px bottom-left tail.
- Max width 82% (92% under 720px), 13px 18px padding, 0.9688rem / 1.5, 12px between messages. The **mini** bubble (9px 14px, 0.875rem, full width) illustrates the get-started steps.

### Navigation
- **Style:** an 88px bar (72px under 720px) with the serif wordmark and window glyph on the left; text links at 500 in Ink Two turn ink on hover; a small ink pill closes the row. The home links How it works, Privacy and Under the hood, and its pill reads "Get started"; `/tech/` links Home, Privacy and GitHub, and its pill reads "Install". Under 720px the text links go: the home keeps only its pill, `/tech/` keeps the GitHub mark (22px) and its pill.
- **Language menu (home):** a 40px outlined pill (hairline, Ink Two, globe icon plus the short code: EN, PT, 日本語…) sits before the ink pill and stays visible on mobile. It opens a native `<details>` panel: white, 14px radius, the lifted shadow, 6px inset; each language is written in its own name and script, the current one ink at 600 with a 6px ink dot. Outside click and Escape close it. The footer repeats the list as a single wrapping line under "This page in". Choosing a language is remembered; first visits follow the browser's language list.
- **Contents list (`/tech/`):** a caption title, then links at 0.9375rem in Ink Three on a single left hairline, 6px 0 6px 16px. The current section (marked by script as an enhancement) turns ink at 500 with a 7px ink dot sitting on the hairline. Under 900px it becomes a static two-column list with a hairline under each link.

### Lists and Diagrams
- **Definition rows:** serif terms against Ink Three definitions on a fixed term column, separated by hairlines (the `fields` list, available but no longer on the home); the privacy list opens on a full ink rule.
- **Promises, three in a row (home privacy):** three ruled points under one ink rule, in three equal columns (gap 24px); each a Title Small serif term over Ink Two body text, 8px apart, 22px of top padding, no row hairlines. Under 900px they stack, each closed by a Hairline (18px 0). The two-column promise list (serif term column beside the text, hairlines between rows) remains the longer form.
- **Specification table (`/tech/`):** a serif term column (1.125rem, 9rem to 12rem) beside an Ink Two sans description, a single ink hairline on top and Hairlines between rows (16px 0 17px); stacks under 720px.
- **Plain table (`/tech/`):** 0.9375rem rows on Hairlines, caption-size Ink Three headers over an ink rule, first column unwrapped, inside a horizontally scrolling wrapper.
- **Facts line (`/tech/` hero):** a wrapping row of caption terms over serif values (1.1875rem), 14px 40px apart, on a hairline, max 900px.
- **Flow and stations:** states named in serif, edges as 1px Strong Hairline lines with border-built arrowheads and caption labels; the one irreversible gate is marked in ink with a filled dot knocked out by a paper ring.
- **Get-started steps (home):** three columns, each opened by a 1px ink rule, a light-serif numeral in Soft Ink (2.75rem), a serif step title (1.5rem), Ink Three text at 0.9688rem, and an optional illustration made of the step's real action. On the home only the first step carries one, the ink copy button; mini chat-bubble illustrations remain available.
- **Two-tone statement beside a why (home):** a Headline Statement (first clause ink, second Soft Ink) in seven columns, bottom-aligned with one Ink Two paragraph in the remaining five; under 900px the paragraph drops below.
- **Payoff line (home):** a single Payoff-size serif sentence closing the scene sequence, opened by its own italic Ink Three day stamp on its own line, no rule, no card.
- **Pipeline (`/tech/`):** numbered rows on Hairlines with a light-serif Soft Ink numeral (1.75rem) hanging in a 52px left column, a 600 step name, then Ink Two text.
- **Dash list (`/tech/`):** short 8px Soft Ink dashes, Ink Two at 0.9688rem, 8px apart.

### Motion
- **Easing:** expo-out `cubic-bezier(.16, 1, .3, 1)` for interface and reveals; a slow in-out `cubic-bezier(.45, .05, .2, 1)` for the light.
- **Reveal:** fade up 16px from blur 5px over 1.3s to 1.4s, siblings staggered by 0.09s (capped at six).
- **Writing entry:** the capture card's rows appear one by one (150ms apart after 200ms), then the highlighter sweeps under the quoted thought at 1.35s.
- **Light:** recolors over 2.8s and moves over 3.4s when the section's time of day changes; breathes on an 11s cycle; leaves sway on 13s and 17s. On `/tech/` it stays put.
- All motion is opt-in behind `html.motion`; reduced motion removes animation and transition entirely.

## The app's light and motion (F6)

The app keeps every token above and borrows the site's light, not a new style. The values live in `packages/ui/src/styles/sintr.css`.

- **Time of day.** The light's four colours are registered properties (`--light-1`, `--light-2`, `--light-3`, `--light-leaf`) set by `data-time` on the element that holds the page, with the site's palettes (dawn, early, morning, noon, late, golden, dusk, evening, night). The time is the person's own hour; changing it cross-fades over 2.8s on the slow in-out ease.
- **The room's light.** The same window, fixed behind the page (`RoomLight`, one per page, under the content so no text loses contrast), placed by a scene: each step of the welcome, the home, a conversation, speaking, and `reading` (absolute in the first 92vh, masked from 45% down: the Light Stays in the Header Rule). A new scene moves it over 3.4s with transform and opacity only. Under 720px it is one 150vw pane that does not travel; only its strength changes. It breathes on the 11s cycle; its leaves sway only on a wide screen with a mouse (a phone pays for every frame of their blurred shadow).
- **Settling in.** A step's lines rise 18px from a 6px blur over 1.3s on the expo-out ease, 90ms apart (at most six): `Rise`, `.sintr-rise`.
- **The pool of light** (`LightPool`): the home's presence, 216px beside the question on a desk, 120px above it on a phone, 40px beside the box once a conversation has begun. Four soft layers of the light's own colours at that hour (sky and peach a little deepened, a warm linen middle, a leaf's shadow at the edge), each blurred once and then only turned (19s, 23s, 31s) and scaled, multiplied onto the paper. Moods: resting (breathes 0.97 to 1.04 over 6s), listening (follows the voice's level up to 1.28, peach warmer, layers turning faster), transcribing (gathers to 0.88, layers turning in 2.8s), thinking (pulses between 0.95 and 1.02 at 1.5s), proposing (warms to the highlighter's peach, breathes slower), paused (still, grey, 0.84). Its mood is said in words beside it and to screen readers.
- **Reduced motion** keeps every state and colour and removes every movement and transition, the light's included.

### Named Rules
**The Light Pool Rule.** The pool is the window light gathered, never a pastel blob: only the light's colours, no outline, no face, no gloss, no shape morphing, one per page, and it means something is happening or waiting. The wellness-app blob stays rejected.

**The Thumb Rule.** On a phone the action of a screen sits where the thumb rests: Speak and Send at the bottom right of the box, a welcome step's Continue at the bottom, the menu's sheet coming in from the side.

## Do's and Don'ts

### Do:
- **Do** keep every filled control Graphite Ink on white, as a full pill; selected states are ink too.
- **Do** show the product on the home with one mock per idea; when it is a notebook card, put human labels in the sans and the person's words in the serif, on sky rules with a peach margin.
- **Do** show real file formats on `/tech/` as selectable mono text in a white, hairline-edged card captioned with the file's path.
- **Do** carry hierarchy with light serif size steps and line breaks, putting context (like the time of day) inside the heading sentence.
- **Do** keep small text at Ink Three (#6b6e75) or darker; reserve Soft Ink for large type and marks.
- **Do** separate sections with large rests and a single hairline rather than fills.
- **Do** keep the light out from behind long reading: in the header, masked away, on any reading page.
- **Do** make motion opt-in and keep every interaction (toggles, tabs, disclosures) working with JavaScript off.
- **Do** self-host every font and asset; the site loads nothing from third parties.

### Don't:
- **Don't** fill text, buttons or cards with gradient; chroma belongs to the window light (including the small window in the brand glyph), its faint echoes on paper, and at most one morning-wash setup card per page (currently on `/tech/` only).
- **Don't** add eyebrows, kickers, uppercase labels, or icon tiles above headings.
- **Don't** use the mono face on the home, or anywhere outside real file contents, paths and commands on `/tech/`.
- **Don't** use the peach highlighter on anything but a person's own quoted words.
- **Don't** build the page from pastel blobs, a phone mockup, or a row of three feature cards, and don't turn it into a dark terminal page or a developer portal. The app's pool of light is the window light itself (The Light Pool Rule), not a blob.
- **Don't** use glassmorphism or backdrop blur on surfaces; blur belongs only to the light's soft edges, the leaf shadows, and the reveal transition. No purple-to-blue pairs; lavender appears only as evening light mixed with peach.
