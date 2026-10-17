---
name: Twój Tajny Mikołaj
description: A family Secret Santa laid on sand-brown wrapping paper, where every secret is a sealed paper object.
colors:
  ground: "#d8c3a5"
  ground-line: "#b39b7a"
  kraft: "#dcc59d"
  kraft-300: "#cfb48a"
  kraft-400: "#b8996c"
  kraft-600: "#7d6243"
  paper: "#fffcf6"
  field-white: "#ffffff"
  cranberry-50: "#fdf2f3"
  cranberry-100: "#fbe3e6"
  cranberry-200: "#f5c2c8"
  cranberry-500: "#c0283a"
  cranberry-600: "#9f1d2b"
  cranberry-700: "#821824"
  pine-50: "#eff7f2"
  pine-100: "#d6ebdd"
  pine-600: "#1f6b45"
  pine-700: "#185537"
  pine-900: "#0f3322"
  gold-300: "#f2d48a"
  gold-400: "#e9b949"
  stone-100: "#f1e8da"
  stone-300: "#cdbb9f"
  stone-400: "#9c8670"
  stone-500: "#6e5b47"
  stone-600: "#574533"
  stone-700: "#45362a"
  stone-800: "#2f241b"
  stone-900: "#231a13"
typography:
  display:
    fontFamily: "'Poltawski Nowy Variable', ui-serif, Georgia, serif"
    fontSize: "3.75rem"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  name-reveal:
    fontFamily: "'Poltawski Nowy Variable', ui-serif, Georgia, serif"
    fontSize: "3rem"
    fontWeight: 700
    lineHeight: 1.25
  headline:
    fontFamily: "'Poltawski Nowy Variable', ui-serif, Georgia, serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.11
  title-lg:
    fontFamily: "'Poltawski Nowy Variable', ui-serif, Georgia, serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.33
  title:
    fontFamily: "'Poltawski Nowy Variable', ui-serif, Georgia, serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.56
  lead:
    fontFamily: "'Atkinson Hyperlegible Next Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.4
  body:
    fontFamily: "'Atkinson Hyperlegible Next Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Atkinson Hyperlegible Next Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1.43
  stamp:
    fontFamily: "'Atkinson Hyperlegible Next Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.33
rounded:
  sm: "0.25rem"
  md: "0.375rem"
  full: "9999px"
spacing:
  gutter: "1rem"
  sheet-sm: "1.25rem"
  sheet: "2rem"
  stack: "1.5rem"
  part: "2rem"
  section: "4rem"
  section-lg: "6rem"
components:
  button-primary:
    backgroundColor: "{colors.cranberry-600}"
    textColor: "{colors.field-white}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.cranberry-700}"
  button-commit:
    backgroundColor: "{colors.pine-700}"
    textColor: "{colors.field-white}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
    height: "44px"
  button-commit-hover:
    backgroundColor: "{colors.pine-900}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.pine-700}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.pine-50}"
  button-quiet:
    textColor: "{colors.cranberry-700}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
    height: "44px"
  input:
    backgroundColor: "{colors.field-white}"
    textColor: "{colors.stone-900}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
  sheet:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.stone-800}"
    rounded: "{rounded.md}"
    padding: "{spacing.sheet}"
  gift-tag:
    backgroundColor: "{colors.paper}"
    padding: "32px 32px 32px 56px"
  stamp:
    textColor: "{colors.pine-700}"
    typography: "{typography.stamp}"
    rounded: "{rounded.sm}"
    padding: "1px 6px"
  alert-error:
    backgroundColor: "{colors.cranberry-50}"
    textColor: "{colors.cranberry-700}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  alert-info:
    backgroundColor: "{colors.pine-50}"
    textColor: "{colors.pine-700}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  nav-shell:
    backgroundColor: "{colors.pine-900}"
    textColor: "{colors.field-white}"
    height: "64px"
---

# Design System: Twój Tajny Mikołaj

## Overview

**Creative North Star: "Szary papier"**

The secret is a physical object. The whole interface is a table covered in sand-brown wrapping paper: the ground is a soft sand brown, every section of content is a crisp off-white sheet of paper laid on it, and the one thing that matters to a participant, the name they drew, arrives as a paper gift tag tied with cranberry twine and closed with a wax seal. The draw produces envelopes, one per person, each sealed with the giver's initial. A deep pine band runs across the top as the shell.

The system is warm, quiet and legible before it is festive. It is built for whole families, older relatives on phones included, so the reading face is Atkinson Hyperlegible Next at a comfortable 16px and every control is at least 44px tall. Festivity is carried by materials (wrapping paper, kraft detail, twine, wax, gold foil) rather than by snowflakes, gradients or decoration. Density is moderate: one column of sheets, separated by generous stacks, each sheet divided internally by dashed fold lines.

It refuses the centred hero slab, the three-card step grid, and identical white cards stacked on a cream page.

**Key Characteristics:**
- Sand-brown ground, off-white paper sheets with a soft table-top shadow, pine shell.
- Cranberry is the twine: primary actions, wax seals, the current step and the revealed name.
- Gold is foil: it appears on seals, under the revealed name, in text selection and as the focus ring on the pine shell.
- Półtawski Nowy, the Polish national antiqua, for headings, names and numbers; Atkinson Hyperlegible Next for everything read.
- Dashed rules divide a sheet; sheets are never nested.
- Secrets are sealed objects that open only on a deliberate tap.

## Colors

A three-material palette (sand ground, paper, pine) with cranberry twine and a trace of gold foil, and greys re-tinted as warm ink so they belong to the paper.

### Primary
- **Cranberry Twine** (`cranberry-600`): primary buttons, the twine on gift tags, wax seals, the current step's bar, the active tab underline and list markers. One cranberry action per sheet.
- **Deep Cranberry Ink** (`cranberry-700`): the revealed recipient name, primary-button hover, error text, quiet destructive actions and the current step label. It is the contrast-safe cranberry for text.
- **Cranberry Wash** (`cranberry-50`, `cranberry-100`, `cranberry-200`): only the error alert's fill and border and the quiet button's underline. `cranberry-500` marks an invalid field's border.

### Secondary
- **Pine Shell** (`pine-900`): the header band and all heading ink (h1–h3).
- **Pine Ink** (`pine-700`, `pine-600`): secondary-button text and border, the commit button, confirmed status lines, "done" steps, and the single focus ring (`pine-600`).
- **Pine Wash** (`pine-50`, `pine-100`): secondary-button hover and the info alert.

### Tertiary
- **Gold Foil** (`gold-400`): the 80×4px foil rule under a revealed name.
- **Pale Gold** (`gold-300`): the inner ring and initial on wax seals, `::selection`, and the focus ring on the pine shell.

### Neutral
- **Ground** (`ground`, #d8c3a5): the sand-brown page ground behind everything, and the colour seen through a gift tag's punched hole.
- **Ground Line** (`ground-line`, #b39b7a): lines drawn directly on the ground: the tab-row baseline, upcoming steps and the scrollbar thumb.
- **Kraft** (`kraft`): paper detail only, never a ground.
- **Kraft Edge** (`kraft-300`, `kraft-400`): envelope rims, tag-hole rings and dashed fold lines inside sheets.
- **Kraft Ink** (`kraft-600`): stamps for neutral states such as "excluded" or "not invited".
- **Paper** (`paper`): every sheet, gift tag and envelope; secondary-button fill.
- **Field White** (`field-white`): text inputs only, so a field reads as a white slip set into the paper; also text on cranberry and pine.
- **Warm Ink** (`stone-900` to `stone-100`): text from `stone-900` (field text) through `stone-800` (body) and `stone-700` (labels) to `stone-600` (hints, meta); `stone-300` field borders; `stone-100` the envelope flap.

### Named Rules
**The Twine Rule.** Cranberry is a thread, not a fill. It appears as one primary action, a seal, a line or a name; it never tints a whole sheet or section.

**The Foil Rule.** Gold never carries text or fills a surface. It is a seal detail, a rule under a revealed name, a selection, or a focus ring on pine.

**The Ink on Ground Rule.** On the sand ground, warm-ink text uses `stone-600` or darker; `stone-500` and lighter appear only on paper or white.

## Typography

**Display Font:** Półtawski Nowy Variable (with ui-serif, Georgia, serif)
**Body Font:** Atkinson Hyperlegible Next Variable (with ui-sans-serif, system-ui, sans-serif)

**Character:** A Polish book antiqua with a calligraphic, slightly old-fashioned warmth sets names, headings and numbers, like hand-lettered tags; a sans built for low-vision readers carries every sentence, label and control. Both are self-hosted and cover Polish diacritics.

### Hierarchy
- **Display** (700, 2.25rem below 640px, 3.75rem above, line-height 1.05, -0.02em): the landing headline only.
- **Name Reveal** (700, 2.25rem below 640px, 3rem above, line-height 1.25, `cranberry-700`): the recipient's name on an opened gift tag, and the landing's example name.
- **Headline** (700, 1.875–2.25rem, line-height 1.11): page titles (the event name) and landing section titles.
- **Title Large** (700, 1.5rem): titles written on an object: the tag's event name, the sealed-tag title, the draw result.
- **Title** (700, 1.125rem): section headings at the top of each sheet; 1.25rem for landing step titles.
- **Lead** (400, 1.125rem below 640px, 1.25rem above): the landing lead, held to 34ch.
- **Body** (400, 1rem, line-height 1.5): all reading text, held to 34–38ch in landing copy and `max-w-md` (28rem) in centred notices.
- **Label** (700, 0.875rem): field labels, definition terms, tabs, nav links and step labels.
- **Stamp** (700, 0.75rem): printed labels on stamps.

### Named Rules
**The Antiqua for Names Rule.** Anything that is a name or a number (people's names when revealed, event names, step numerals, seal initials) is set in Półtawski Nowy. Instructions and controls never are.

**The Bold Not Small Rule.** Emphasis and labelling use weight 700 at 0.875rem or larger; nothing a person must read goes below 0.75rem, and 0.75rem is reserved for stamps.

## Layout

A single centred column on the sand ground. The frame is 48rem wide (`max-w-3xl`), widening to 64rem (`max-w-5xl`) only for the landing's two columns. Side gutters are 1rem; main content has 2rem of top and bottom padding, 3rem from 640px.

Sheets stack with 1.5rem between them. Inside a sheet, parts are separated by a dashed fold line with 2rem above and below. The landing breathes more: its sections are 4rem apart, 6rem from 640px.

The landing's first viewport is asymmetric from 768px: a left column (1.05fr) with headline, lead and CTA, and a right column (1fr) with an example gift tag tilted -2°. Below 768px it stacks, and buttons become full width. "How it works" is one length of cranberry twine strung through three numbered steps: vertical on mobile, horizontal from 768px.

The event header is followed by a tab row on a `ground-line` baseline; the active tab carries a 3px cranberry underline. On mobile the tab row scrolls horizontally inside the gutter. The manage page leads with a three-step track (Participants → Invitations → Draw), three equal columns each topped by a 4px bar, and tucks secondary areas into disclosures.

Two-field rows and definition lists become two columns from 640px.

## Elevation & Depth

Depth is a table top: flat sand ground, with paper objects lying on it. There is one shadow for paper, a softer variant for cut-out objects, and nothing floats higher. Inside a sheet everything is flat; separation comes from dashed rules, not shadows or tints.

### Shadow Vocabulary
- **Paper on the ground** (`box-shadow: 0 1px 1px rgb(74 52 28 / 0.1), 0 12px 28px -16px rgb(74 52 28 / 0.45)`): every sheet and envelope.
- **Tag on the ground** (`filter: drop-shadow(0 1px 1px rgb(74 52 28 / 0.12)) drop-shadow(0 10px 14px rgb(74 52 28 / 0.22))`): gift tags, whose cut corners would clip a box-shadow.
- **Pressed button** (Tailwind `shadow-sm`): primary, commit buttons and wax seals only, a hint of thickness.

### Named Rules
**The One Table Rule.** Every paper object sits at the same height on the table. No modals floating above, no stacked elevations, no shadow inside a sheet. Print drops shadows and gives tags a 1px `stone-400` outline instead.

## Shapes

Small, papery corners: 0.375rem on sheets, buttons, fields and alerts; 0.25rem on stamps, envelopes and focus targets in the shell. Circles are reserved for wax seals, step numerals, the tag's punched hole and the foil rule's ends.

The gift tag is the signature silhouette: a rectangle with its left corners cut at 45° (1.5rem), a punched hole ringed in kraft, and two strands of twine curving out of it. The sealed envelope is a 3:2 paper rectangle with a stroked flap and a round cranberry seal on its point.

Lines are dashed when they divide paper (fold lines, list dividers, the "not invited" stamp) and solid when they are thread (twine, the step bars, the tab underline).

## Components

### Buttons
Solid and tactile, like a pressed stationery label.
- **Shape:** gently rounded (0.375rem), at least 44px tall, 1rem bold text, 10px × 20px padding, 8px icon gap.
- **Primary:** cranberry fill, white text, slight shadow; darkens to deep cranberry on hover. One per sheet; it is the next step.
- **Commit:** pine fill, white text, darkens to `pine-900`. Used only to confirm a deliberate step forward (running the draw), so it never looks like a warning.
- **Secondary:** paper fill, pine text, `pine-700` border at 40%; hover gives a full pine border and `pine-50` fill.
- **Quiet:** no fill, deep-cranberry text with a `cranberry-200` underline that deepens on hover. For actions that only name themselves, such as "Usuń" or "Zakryj".
- **Disabled:** 60% opacity and a not-allowed cursor.
- **Focus:** one 2px `pine-600` outline at 2px offset everywhere; primary buttons use a cranberry outline, and the pine shell uses `gold-300`.

### Stamps
Small printed labels: role, invitation state, event status, claim state.
- **Style:** 1px border, 0.25rem radius, 0.75rem bold, 1px × 6px padding, no wrap, transparent or paper fill.
- **Tones:** pine (positive, "open", "you"), cranberry (organiser, "drawn"), kraft ink (neutral exclusions), warm ink (finished, inactive). A dashed border marks something not yet done ("not invited").

### Cards / Containers (Sheets)
- **Corner Style:** 0.375rem.
- **Background:** paper.
- **Shadow Strategy:** paper on the ground (see Elevation & Depth).
- **Border:** none.
- **Internal Padding:** 1.25rem on mobile, 2rem from 640px.
- **Inside:** parts divided by a 1px dashed `kraft-400` fold line; lists divided the same way. Confirmed outcomes are a ticked pine line (`status-ok`), not a tinted box.

### Inputs / Fields
- **Style:** white field set into paper, 1px `stone-300` border, 0.375rem radius, 10px × 14px padding, 1rem text in `stone-900`, placeholder `stone-500`, cranberry caret.
- **Label / hint:** bold 0.875rem `stone-700` label 6px above; 0.875rem `stone-600` hint below.
- **Focus:** border turns `pine-600` with a 2px pine outline flush to it.
- **Error:** border `cranberry-500`, and a bold 0.875rem `cranberry-700` message below.

### Alerts
- **Error:** `cranberry-50` fill, `cranberry-200` border, `cranberry-700` 0.875rem text, 12px × 16px.
- **Info:** `pine-50` fill, `pine-100` border, `pine-700` text.

### Navigation
- **Shell:** a 64px `pine-900` band. The logo (gift icon plus "Twój Tajny Mikołaj" in Półtawski, white) sits left; signed-in links sit right in 0.875rem, bold white for the main link and `pine-100` for sign-out, underlined on hover.
- **Tabs:** 0.875rem bold `stone-700` labels on a `ground-line` baseline; hover adds a `ground-line` underline, the active tab a 3px cranberry underline with pine text.
- **Back link:** bold 0.875rem `pine-700` with a 2px-stroke left arrow.
- **Icons:** a small set of 16×16 line icons drawn in one 2px round-capped stroke (chevron, arrow, pair).

### Gift Tag (signature)
The product's object for a secret name. A paper tag with cut left corners and a punched hole, tied with two strands of cranberry twine that leave it on the left. Sealed, it shows "You give a gift to", a 64px cranberry wax seal with a pale-gold inner ring, a title, and a primary "reveal" button. Revealed, the name slides out from under the seal left to right (clip-path, 600ms, `cubic-bezier(0.16, 1, 0.3, 1)`), set in Name Reveal type over a gold foil rule, with a quiet "hide" action. It is sealed again each time the page opens. Twine is hidden in print.

### Sealed Envelope (signature)
What the draw produced for each participant, without showing what is inside: a small paper envelope with a stroked flap and a 40px cranberry seal bearing the person's initial in gold Półtawski, the name below. A row of them is pressed on in sequence (420ms, 90ms stagger, landing from 1.35× scale). Motion is off under reduced motion.

### Confirm Panel
Inline confirmation below a dashed fold, never a modal. It takes focus when it opens, and Escape cancels. Destructive tone: bold deep-cranberry text and a cranberry button. Commit tone: pine text and the pine commit button.

## Do's and Don'ts

### Do:
- **Do** lay every section on its own paper sheet (paper, 0.375rem, paper shadow) directly on the ground.
- **Do** separate parts of one sheet with a dashed `kraft-400` fold line and 2rem either side.
- **Do** keep a secret sealed until the person taps to reveal it, and seal it again when they leave.
- **Do** give each sheet at most one cranberry primary action, and use the pine commit button to confirm a step forward.
- **Do** set names, event titles and numerals in Półtawski Nowy, and everything read in Atkinson Hyperlegible Next at 1rem or larger.
- **Do** keep every control at least 44px tall and use the single 2px pine focus ring.
- **Do** wrap motion in `prefers-reduced-motion` and let content be visible before any animation finishes.

### Don't:
- **Don't** nest a sheet inside a sheet, or group content inside a sheet with a tinted panel; error and info alerts are the only tinted boxes.
- **Don't** fill surfaces with gold or set text in it.
- **Don't** use `stone-500` or lighter text directly on the ground.
- **Don't** build a centred hero slab, a three-card step grid, or rows of identical white cards on a plain page.
- **Don't** add shadows inside a sheet or lift any object above the paper shadow.
- **Don't** show a drawn name on page load without the seal.
