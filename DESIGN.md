---
name: MSO
description: An offline savings & loan ledger for Mogh Students Organisation, styled as a bank teller's statement register.
colors:
  seal-navy:
    light: "hsl(217, 52%, 29%)"
    dark: "hsl(214, 62%, 72%)"
  sunrise:
    light: "hsl(36, 80%, 54%)"
    dark: "hsl(36, 86%, 58%)"
  teller-green:
    light: "hsl(152, 45%, 26%)"
    dark: "hsl(152, 44%, 48%)"
  brick-red:
    light: "hsl(5, 60%, 41%)"
    dark: "hsl(4, 76%, 64%)"
  ground:
    light: "hsl(216, 33%, 97%)"
    dark: "hsl(221, 47%, 7%)"
  statement-card:
    light: "hsl(0, 0%, 100%)"
    dark: "hsl(220, 42%, 11%)"
  ink:
    light: "hsl(220, 45%, 13%)"
    dark: "hsl(214, 32%, 92%)"
  counter-ring:
    light: "hsl(219, 54%, 15%)"
    dark: "hsl(221, 54%, 9%)"
typography:
  chrome:
    fontFamily: "IBM Plex Sans, system-ui, -apple-system, sans-serif"
    fontWeight: 400
  heading:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontWeight: 700
    letterSpacing: "-0.015em"
  figure:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    letterSpacing: "-0.01em"
  eyebrow:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "10px"
    fontWeight: 600
    letterSpacing: "0.08em"
rounded:
  sm: "0.625rem"
  md: "0.469rem"
  lg: "0.3125rem"
spacing:
  card-padding: "1rem"
  section-gap: "1.5rem"
components:
  card-primary:
    backgroundColor: "{colors.statement-card}"
    rounded: "{rounded.sm}"
  badge-positive:
    backgroundColor: "{colors.teller-green}"
    textColor: "{colors.teller-green}"
    rounded: "{rounded.lg}"
  badge-negative:
    backgroundColor: "{colors.brick-red}"
    textColor: "{colors.brick-red}"
    rounded: "{rounded.lg}"
  button-primary:
    backgroundColor: "{colors.seal-navy}"
    textColor: "{colors.statement-card}"
    rounded: "{rounded.sm}"
---

# Design System: MSO

## Overview

**Creative North Star: "The Bank Teller Counter & Statement Register"**

MSO reads as a trusted institutional counter, not another blue SaaS card grid. The product digitizes a small student organization's savings/loan committee ledger, so every screen is built to behave like a statement being printed at the window in front of the admin: precise columns, tabular figures, sunrise-orange rules dividing sections like a printed slip, and status shown as an ink stamp rather than a soft rounded pill. The world was chosen over a skeuomorphic "leather ledger" challenger specifically because it keeps dense financial tables scannable — the product's users are a single admin doing short, focused sessions with real money figures, and clarity of numbers wins over decorative texture every time.

Corners are only lightly rounded (a precise, rectangular register character, not a bubbly consumer-app one), and the signature sunrise top-rule border is used deliberately and repeatedly as the system's one recurring accent motif — it is a chosen invariant, not an accident.

**Key Characteristics:**
- The seal's deep-navy "counter" chrome (sidebar, login scene) framing white (or deep-navy, in dark mode) "statement" content panels
- Every number renders in tabular monospace so columns line up like a printed register
- Status is a bordered "ink stamp" badge, never a soft filled pill
- A sunrise (`accent`) top-rule or bottom-rule marks the start of a section, page header, or emphasized card
- Numbered navigation ("01, 02, 03…") evokes counter-window numbering

## Colors

The palette is the MSO seal's own (`src/assets/mso-logo.png`): its navy ring and wordmark, the sun rising over the book, the book's steel-blue pages on white. It is a Restrained-to-Committed strategy: a cool white ground carries most of the surface, seal navy carries action and ink, the sun is the one recurring warm accent, and teller-green/brick-red stay reserved strictly for positive/negative financial meaning. The PDF reports use the same navy and sun (`C.navy`, `C.gold` in `src/utils/pdfReports.ts`), so screen and paper match.

### Primary
- **Seal Navy** (`hsl(217 52% 29%)`, the seal's `#244271`, light / `hsl(214 62% 72%)` dark, lifted to the steel blue of the book's pages so it reads on a dark ground): primary buttons, links, focus rings, eyebrow labels, icon stamps, table header rules, the default badge. White text on it (dark-navy text in dark mode).

### Accent
- **Sunrise** (`hsl(36 80% 54%)`, the seal's sun `#E79C2A`, light / `hsl(36 86% 58%)` dark): the signature rule (page headers, emphasized cards, dropdown tops, the sticky save bar when there are unsaved changes), the active nav marker, the attention stamp, and fills that carry navy text (the "On leave" toggle). Never small text on white: at 2.3:1 it is a rule and a wash, not a text colour.

### Secondary
- **Teller Green** (`hsl(152 45% 26%)` light / `hsl(152 44% 48%)` dark): positive/inflow meaning only — recovered loans, deposits, "Paid"/"Approved"/"Present" status, savings totals.

### Neutral
- **Ground** (`hsl(216 33% 97%)` light, the seal's white with a steel-blue tint / `hsl(221 47% 7%)` dark): page background.
- **Statement Card** (white light / `hsl(220 42% 11%)` dark): card/panel surface.
- **Ink** (`hsl(220 45% 13%)` deep navy light / `hsl(214 32% 92%)` dark): body text. Muted text is a slate navy (`hsl(217 18% 37%)` / `hsl(215 20% 68%)`); borders and muted washes are steel blue (`hsl(216 24% 86%)`, `hsl(216 28% 93%)`).
- **Counter Ring** (`hsl(219 54% 15%)` light / `hsl(221 54% 9%)` dark): the sidebar and the Login page's left panel are the seal's deep navy ring in both themes — the "counter" is always the counter. The Login panel adds the sun rising from below (a radial sunrise over the navy, `--gradient-hero`).
- **Brick Red** (`hsl(5 60% 41%)` light / `hsl(4 76% 64%)` dark, with dark text): negative/outflow meaning only — overdue, defaulted, rejected, absent, destructive actions.
- **Charts:** loans issued in a mid navy blue (`--chart-issued`) against recovered in teller green (`--chart-recovered`), apart in hue and lightness so the series survive colour-blind vision; contributions in seal navy.
- **Browser surfaces:** text selection is a sun wash with ink text, the caret is navy, scrollbars are steel-blue thumbs on a clear track.

Every text pair above meets WCAG AA (4.5:1) in both themes; checked numerically when the palette was set.

### Named Rules
**The Meaning-Not-Decoration Rule.** Teller-green and brick-red are reserved exclusively for genuine positive/negative financial or status meaning. They never appear as arbitrary decoration or to differentiate unrelated UI chrome.

**The Fixed Counter Rule.** The sidebar and the Login screen's left panel are the seal's deep navy in both light and dark app themes — they represent the physical counter, which doesn't change with the visitor's theme preference. Text on them uses the sidebar tokens (sun for the active item and the login tagline), never `primary`, which is navy-on-navy in light mode.

**The Attention Stamp Rule.** When something needs the admin's attention but nothing has gone wrong (a backup that is due, no backup yet), it is stamped in the sun: a sun-tinted border (`accent` at 50-60%) over a sun wash (`accent` at 10-15%), with the words in navy (`text-primary`), not in orange, so the text keeps its contrast. An icon on a sun wash is navy in light mode and sun in dark mode (`text-accent-foreground dark:text-accent`). Brick-red stays reserved for genuine loss or destruction; a reminder is never red.

## Typography

**Chrome/Body Font:** IBM Plex Sans (with system-ui, -apple-system fallback)
**Figure/Mono Font:** IBM Plex Mono (with ui-monospace fallback)

**Character:** IBM Plex Sans is a clean, workhorse humanist sans built for institutional/technical registers — it never reads as decorative. IBM Plex Mono, used for every number, evokes a dot-matrix statement printer: it is what makes columns of PKR amounts feel like a printed register rather than a web page.

### Hierarchy
- **Heading** (700 weight, `-0.015em` tracking): page titles (h2) and card titles.
- **Eyebrow/Label** (IBM Plex Mono, 600 weight, 10px, `0.08em` tracking, uppercase): the small "statement letterhead" label above every page/section title (e.g. "DAILY STATEMENT", "LENDING LEDGER").
- **Body** (400 weight): default copy, descriptions, form labels.
- **Figure** (IBM Plex Mono, tabular-nums, `-0.01em` tracking): every money amount, date-as-number, count, ID, or timestamp anywhere in the app.

### Named Rules
**The Tabular Money Rule.** Any value that is a number a user might scan down a column to compare — PKR amounts, dates, counts, percentages, IDs — always renders through the `.figure` utility (IBM Plex Mono + tabular-nums). Plain body text never carries a raw monetary figure.

## Layout

Content pages follow a consistent letterhead pattern: a navy mono eyebrow label, then an h2 title, then a `border-b-2 border-accent/70` sunrise rule closing off the header block before the page body starts. Stat/summary cards sit in a responsive grid above supporting cards and tables. The app shell is a fixed left sidebar (counter grille, always dark) plus a sticky top header (statement letterhead bar with a `border-b-2 border-primary/50`) and a scrollable main content area. Density is comfortable, not enterprise-dense — the product's real data volumes are small (tens of members, a handful of active loans), so generous card padding and spacing are appropriate.

**Settings pages group by consequence.** A settings surface is split into sections by what a change touches (members' money, how the screen reads, the data itself), not into a grid of equal cards per topic. Each section is a full-width card with a bold title and plain consequence copy (capped at `90ch`, so it stays to one or two lines); section cards sit 16px apart, and the letterhead closes 12px above the first. The section whose changes move money is the one emphasized card and carries the sunrise top-rule; the others sit plain. Inside a section, settings are a single column of rows with hairline dividers, split into two row-columns when the section is long and its card is at least `54rem` wide (Money rules and Display & lists both do). The split follows the card's own width (a container query on the card), not the window's, so it holds in the default 1280px window, whose page area is narrower than the window. The page is kept short: no explanatory side panels beside the rows.

**The No-Reflow Hint Rule.** Where editing a field reveals a secondary line ("In force now: 10%", or a validation error), that line lives in a fixed one-line slot (16px tall, no wrap) that is reserved whether or not it has content, so typing never shifts the rows below.

## Elevation & Depth

Depth is conveyed structurally, not through heavy shadow stacking: a light `shadow-sm` on cards for lift, plus the signature sunrise top-rule (`border-t-2 border-t-accent`; always `border-t-accent`, so a card's other sides keep their hairline) to mark a card as primary/emphasized within a group — the rule does double duty as both hierarchy and brand signature. Shadows use a soft seal-navy tint (`hsl(220 40% 20%)`-family) at low opacity, so they read as a statement lifted off the counter rather than a generic grey drop shadow.

### Named Rules
**The Rule-Over-Shadow Rule.** When a card needs to stand out from its siblings (the first/primary card in a section, a hero stat), reach for the sunrise top-rule before reaching for a heavier shadow.

## Shapes

Corners use a single restrained radius scale (`0.625rem`/`0.469rem`/`0.3125rem`, i.e. Tailwind's `rounded-sm`/`rounded-md`/`rounded-lg` as remapped by `--radius`), deliberately less rounded than a typical consumer SaaS app — precise and rectangular, like a printed form. Status badges and small icon badges are `rounded-sm` bordered squares, never circles or fully-rounded pills. Avatars are `rounded-sm` (square), matching the badge/icon language, not circular. Genuinely circular controls (switch thumbs, radio buttons, loading spinners) are left round since that shape is a functional/expected affordance, not a decorative choice.

## Components

### Buttons
- **Shape:** `rounded-sm`, precise corners.
- **Primary:** seal-navy background, white text — the counter's "stamp of approval" action.
- **Hover/Focus:** slight opacity shift on hover (`/90`), `active:scale-[0.98]` press feedback, navy focus ring.
- **Secondary/Outline/Ghost:** token-driven per shadcn conventions, unchanged in structure from the base primitive, only recolored via tokens.

### Badges ("ink stamps")
- **Style:** `rounded-sm`, `border-2`, uppercase, tracked, tinted background (10% opacity fill of its tone color) rather than a solid fill — reads as a stamped impression, not a filled pill.
- **State:** `default` = navy/neutral-positive, `secondary` = teller-green/positive, `destructive` = brick-red/negative, `outline` = purely informational.

### Cards / Containers
- **Corner Style:** `rounded-sm`.
- **Background:** statement-card token (white in light mode, deep navy panel in dark mode).
- **Shadow Strategy:** `shadow-sm` at rest; primary/emphasized cards add the sunrise top-rule (see Elevation & Depth).
- **Border:** none by default besides the optional top-rule; `CardHeader` on multi-section cards gets a `border-b border-border` divider.

### Inputs / Fields
- **Style:** `rounded-sm`, hairline border using the steel-blue `border` token.
- **Focus:** navy ring (`ring-primary`), consistent with buttons.

### Tables ("the register")
- **Header:** `border-b-2 border-primary/60` double-rule under the header row (navy, like the navy header row of the PDF registers), column labels uppercase/tracked/11px.
- **Rows:** hairline dividers, hover tint via `bg-muted/50` — no zebra striping.
- **Numeric columns:** always `.figure` (tabular mono), typically right-context but not forced right-aligned everywhere existing layouts didn't already do so.

### Navigation (sidebar)
- **Style:** fixed deep seal-navy "counter," always dark regardless of app theme.
- **Item:** icon + label, prefixed with a two-digit tabular-mono counter number (`01`, `02`, …) evoking numbered teller windows.
- **Active state:** sun left-border (`border-l-2 border-sidebar-primary`) plus a subtle sun-tinted background, sun icon/number color.
- **Default state:** muted foreground at 65% opacity, brightening on hover.

### Statement Header (signature component)
The top app bar and every page's own header both carry the "letterhead" pattern: a small navy tracked-mono eyebrow line, the heading below it, and a sunrise rule closing the block. This recurs identically across all 13+ pages and is the single most repeated signature move in the system — it is what makes every page feel like a page from the same printed ledger.

### Settings Rows
- **Structure:** label (14px, medium) with a short help line (12px, muted, relaxed leading) on the left; the control right-aligned on the right, top-aligned with the label. Rows are separated by hairline `border-border` dividers with 12px vertical padding and 8px between label and control when they stack; on narrow windows the control drops below the label.
- **Held-hint variant:** the Money rules rows always reserve the No-Reflow hint slot under the control, where an edited value shows the one in force ("In force now: 10%") or its error.
- **Help copy** may carry a live preview of the setting as a figure ("Today reads 28/09/2026"), rendered through `.figure`.

### Unit Input
- **Style:** one bordered field (`rounded-sm`, 40px tall, hairline `input` border, page-background fill) holding the number with its unit inside the border: an optional prefix (currency code, mono, muted 12px) and suffix (`%`, `/ month`, `rows`, muted 12px).
- **Figures:** the number is right-aligned and tabular (`.figure`), so a column of unit inputs aligns like a register.
- **Focus / Error / Disabled:** the whole field takes the navy focus ring (`focus-within`); invalid turns the border brick-red with the message in the row's hint slot; disabled fades the field to 50% (e.g. the interest rate while interest is switched off).

### Segmented Control
- **Style:** for two or three mutually exclusive, short options (theme, 12/24-hour). A `rounded-sm` hairline-bordered track on a muted wash (`muted` at 50%) with a 2px inset; segments are 32px tall with muted text, and the selected segment lifts onto the statement-card colour with ink text and `shadow-sm`. No accent fill on the selected segment: selection reads as a raised slip, not an accent.
- **Use a Select instead** when options are long or more than three.

### Sticky Save Bar
- **Style:** a full-bleed bar pinned to the bottom of a settings form, statement-card background, with a `border-t-2` that is a neutral hairline when everything is saved and turns sunrise (`accent`) the moment there are unsaved changes (200ms colour transition).
- **Content:** on the left, a live status line (`aria-live="polite"`): "Unsaved changes in Money rules and Display & lists", naming the dirty sections, or a teller-green check with "All settings saved". On the right, a ghost **Discard** and the primary **Save changes**, both disabled while clean.
- **Rule:** settings are staged, never applied on change; "Reset to defaults" only fills the form, and Save or Discard still decides.

### Report Index (Reports page)
Reports are listed like the index of a register, not as a grid of equal cards: each section is one card (a header with its stamp icon and title over a hairline), and each report is a row in it.
- **Row:** a 32px stamp icon; the report's name (14px semibold) with its scope under it ("PERIOD · INCEPTION – 05/10/2026", tracked mono 10px, navy); the description (12px muted); then the picker, when the report is for one member, loan or distribution, and the **View** button at the right edge. Rows are 12px top and bottom with hairline dividers.
- **Widths:** the row follows its section card's width (`.report-row` in `index.css`, a container query), not the window's: from `54rem` the name, description and actions read across in columns, so descriptions and View buttons line up down the page; from `36rem` the description sits under the name with the actions on the right; narrower, everything stacks.

### Attention Strip
- **Style:** a full-width `rounded-sm` strip in the Attention Stamp colours (sun border at 50%, sun wash at 10%), led by a 36px square stamp icon box (`border-2`, sun at 50%, navy icon; sun in dark mode), with a semibold one-line statement plus a muted explanation, and actions on the right (a ghost link to the relevant settings, then the primary action). Used for the Dashboard backup reminder; it renders only while the condition holds rather than sitting as a permanent banner.
- **Badge form:** the same colours on an outline `<Badge>` ("Backup due", "No backup"); the resolved state switches to the teller-green `secondary` badge ("Backed up").

### Destructive Footer Strip
- **Style:** a destructive action inside an otherwise safe section is walled off in its own footer strip at the bottom of the card: hairline top border, a faint brick-red wash (`destructive` at 4%), a title and one-line consequence on the left, and an outline button in brick-red (border at 50%, brick-red text, 10% brick-red hover wash) on the right.
- **Confirmation:** the button always opens an alert dialog that names exactly what will be overwritten and that it cannot be undone. The confirm action is the solid brick-red button with a specific verb ("Choose file and restore"), with Cancel beside it.

## Do's and Don'ts

### Do:
- **Do** run every monetary amount, date-as-number, count, or ID through the `.figure` utility class.
- **Do** use the sunrise top-rule (`border-t-2 border-t-accent`) sparingly — one emphasized card per section, not every card.
- **Do** map status meaning strictly: teller-green = positive, brick-red = negative, navy/default = neutral, outline = informational.
- **Do** keep the sidebar and Login-page left panel the seal's deep navy in both light and dark themes.
- **Do** use `rounded-sm` as the default corner radius for cards, buttons, inputs, badges, and avatars.
- **Do** show the value in force under an edited money setting ("In force now: 10%") until it is saved. (The Settings worked example was removed on request, 2026-10-05, to shorten the page.)
- **Do** stage settings behind a sticky save bar that names the unsaved sections; nothing applies until Save.
- **Do** reserve the hint slot under editable money fields so revealing a hint or error never moves the rows below.

### Don't:
- **Don't** reintroduce filled gradient circles (`bg-gradient-primary` + white icon) for icon badges — the system uses bordered square "stamp" badges instead.
- **Don't** use `rounded-full`/`rounded-xl`/`rounded-2xl` on cards, dialogs, or icon badges — reserve fully-rounded shapes for switches, radios, and spinners only.
- **Don't** use raw ad-hoc colored `<span>` pills for status (e.g. `bg-emerald-100 text-emerald-700`) — always route status through the shared `<Badge>` component and its token-driven variants.
- **Don't** imply live sync, multi-device presence, or network/connectivity status anywhere in the UI — this is a strictly offline, single-machine product.
- **Don't** lay out settings as a grid of equal cards; group them by consequence, with the money section as the one sunrise-ruled card.
- **Don't** colour a reminder or overdue-backup state brick-red; attention is the sun, and red is for loss and destructive actions.
- **Don't** place a destructive action inline among ordinary settings rows; wall it off in a tinted footer strip behind a confirmation dialog.
