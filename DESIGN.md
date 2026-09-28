---
name: MSO
description: An offline savings & loan ledger for Mogh Students Organisation, styled as a bank teller's statement register.
colors:
  brass:
    light: "hsl(38, 58%, 38%)"
    dark: "hsl(38, 70%, 58%)"
  teller-green:
    light: "hsl(150, 38%, 27%)"
    dark: "hsl(150, 40%, 42%)"
  brick-red:
    light: "hsl(6, 55%, 40%)"
    dark: "hsl(6, 60%, 52%)"
  amber-accent:
    light: "hsl(38, 68%, 52%)"
    dark: "hsl(38, 70%, 58%)"
  paper-bg:
    light: "hsl(40, 26%, 95%)"
    dark: "hsl(222, 32%, 8%)"
  statement-card:
    light: "hsl(42, 38%, 98%)"
    dark: "hsl(222, 28%, 11%)"
  ink:
    light: "hsl(222, 32%, 14%)"
    dark: "hsl(40, 22%, 92%)"
  counter-grille:
    value: "hsl(222, 40%, 9%)"
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
    backgroundColor: "{colors.brass}"
    textColor: "{colors.paper-bg}"
    rounded: "{rounded.sm}"
---

# Design System: MSO

## Overview

**Creative North Star: "The Bank Teller Counter & Statement Register"**

MSO reads as a trusted institutional counter, not another blue SaaS card grid. The product digitizes a small student organization's savings/loan committee ledger, so every screen is built to behave like a statement being printed at the window in front of the admin: precise columns, tabular figures, brass rules dividing sections like a printed slip, and status shown as an ink stamp rather than a soft rounded pill. The world was chosen over a skeuomorphic "leather ledger" challenger specifically because it keeps dense financial tables scannable — the product's users are a single admin doing short, focused sessions with real money figures, and clarity of numbers wins over decorative texture every time.

Corners are only lightly rounded (a precise, rectangular register character, not a bubbly consumer-app one), and the signature brass top-rule border is used deliberately and repeatedly as the system's one recurring accent motif — it is a chosen invariant, not an accident.

**Key Characteristics:**
- Charcoal-navy "counter" chrome (sidebar, login scene) framing paper-white/charcoal "statement" content panels
- Every number renders in tabular monospace so columns line up like a printed register
- Status is a bordered "ink stamp" badge, never a soft filled pill
- A brass (`primary`) top-rule or bottom-rule marks the start of a section, page header, or emphasized card
- Numbered navigation ("01, 02, 03…") evokes counter-window numbering

## Colors

The palette is a Restrained-to-Committed strategy: a warm paper/charcoal neutral ground carries most of the surface, with brass as the one recurring accent, and teller-green/brick-red reserved strictly for positive/negative financial meaning.

### Primary
- **Brass** (`hsl(38 58% 38%)` light / `hsl(38 70% 58%)` dark): the counter's signature accent — primary buttons, active nav state, top-rule dividers, eyebrow labels, focus rings. Used sparingly as an accent, never as a large fill.

### Secondary
- **Teller Green** (`hsl(150 38% 27%)` light / `hsl(150 40% 42%)` dark): positive/inflow meaning only — recovered loans, deposits, "Paid"/"Approved"/"Present" status, savings totals.

### Tertiary
- **Amber Accent** (`hsl(38 68% 52%)`): a lighter cousin of brass used for reserve-fund and "warning-adjacent but not negative" values (e.g. overdue counts framed as attention, pending states).

### Neutral
- **Paper** (`hsl(40 26% 95%)` light / charcoal-navy `hsl(222 32% 8%)` dark): page background.
- **Statement Card** (`hsl(42 38% 98%)` light / `hsl(222 28% 11%)` dark): card/panel surface, one step lighter (light mode) or lighter-but-still-dark (dark mode) than the page background.
- **Ink** (`hsl(222 32% 14%)` light / `hsl(40 22% 92%)` dark): body text.
- **Counter Grille** (`hsl(222 40% 9%)`, constant in both themes): the sidebar and the Login page's left panel stay a fixed dark charcoal-navy regardless of light/dark mode — the "counter" is always the counter.
- **Brick Red** (`hsl(6 55% 40%)` light / `hsl(6 60% 52%)` dark): negative/outflow meaning only — overdue, defaulted, rejected, absent, destructive actions.

### Named Rules
**The Meaning-Not-Decoration Rule.** Teller-green and brick-red are reserved exclusively for genuine positive/negative financial or status meaning. They never appear as arbitrary decoration or to differentiate unrelated UI chrome.

**The Fixed Counter Rule.** The sidebar and the Login screen's left panel are charcoal-navy in both light and dark app themes — they represent the physical counter, which doesn't change with the visitor's theme preference.

**The Attention Stamp Rule.** When something needs the admin's attention but nothing has gone wrong (a backup that is due, no backup yet), it is stamped in amber: an amber-tinted border (`accent` at 50-60%) over an amber wash (`accent` at 10-15%), with the words in brass (`text-primary`), not in amber itself, so the text keeps its contrast on paper. Brick-red stays reserved for genuine loss or destruction; a reminder is never red.

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

Content pages follow a consistent letterhead pattern: a brass-mono eyebrow label, then an h2 title, then a `border-b-2 border-primary/40` rule closing off the header block before the page body starts. Stat/summary cards sit in a responsive grid above supporting cards and tables. The app shell is a fixed left sidebar (counter grille, always dark) plus a sticky top header (statement letterhead bar with a `border-b-2 border-primary/50`) and a scrollable main content area. Density is comfortable, not enterprise-dense — the product's real data volumes are small (tens of members, a handful of active loans), so generous card padding and spacing are appropriate.

**Settings pages group by consequence.** A settings surface is split into sections by what a change touches (members' money, how the screen reads, the data itself), not into a grid of equal cards per topic. Each section is a full-width card with a bold title and one line of plain consequence copy (capped at `68ch`). The section whose changes move money is the one emphasized card and carries the brass top-rule; the others sit plain. Inside a section, settings are a single column of rows with hairline dividers, split into two row-columns at `xl` when the section is long.

**The No-Reflow Hint Rule.** Where editing a field reveals a secondary line ("In force now: 10%", or a validation error), that line lives in a fixed one-line slot (16px tall, no wrap) that is reserved whether or not it has content, so typing never shifts the rows below.

## Elevation & Depth

Depth is conveyed structurally, not through heavy shadow stacking: a light `shadow-sm` on cards for lift, plus the signature brass top-rule (`border-t-2 border-primary/70`) to mark a card as primary/emphasized within a group — the rule does double duty as both hierarchy and brand signature. Shadows use a warm charcoal tint (`hsl(30 28% 18%)`-family) rather than a cool blue-black, so they read as "paper lifted off a counter" rather than a generic UI drop shadow.

### Named Rules
**The Rule-Over-Shadow Rule.** When a card needs to stand out from its siblings (the first/primary card in a section, a hero stat), reach for the brass top-rule before reaching for a heavier shadow.

## Shapes

Corners use a single restrained radius scale (`0.625rem`/`0.469rem`/`0.3125rem`, i.e. Tailwind's `rounded-sm`/`rounded-md`/`rounded-lg` as remapped by `--radius`), deliberately less rounded than a typical consumer SaaS app — precise and rectangular, like a printed form. Status badges and small icon badges are `rounded-sm` bordered squares, never circles or fully-rounded pills. Avatars are `rounded-sm` (square), matching the badge/icon language, not circular. Genuinely circular controls (switch thumbs, radio buttons, loading spinners) are left round since that shape is a functional/expected affordance, not a decorative choice.

## Components

### Buttons
- **Shape:** `rounded-sm`, precise corners.
- **Primary:** brass background, paper-white text — the counter's "stamp of approval" action.
- **Hover/Focus:** slight opacity shift on hover (`/90`), `active:scale-[0.98]` press feedback, brass focus ring.
- **Secondary/Outline/Ghost:** token-driven per shadcn conventions, unchanged in structure from the base primitive, only recolored via tokens.

### Badges ("ink stamps")
- **Style:** `rounded-sm`, `border-2`, uppercase, tracked, tinted background (10% opacity fill of its tone color) rather than a solid fill — reads as a stamped impression, not a filled pill.
- **State:** `default` = brass/neutral-positive, `secondary` = teller-green/positive, `destructive` = brick-red/negative, `outline` = purely informational.

### Cards / Containers
- **Corner Style:** `rounded-sm`.
- **Background:** statement-card token (paper-white in light mode, deep charcoal panel in dark mode).
- **Shadow Strategy:** `shadow-sm` at rest; primary/emphasized cards add the brass top-rule (see Elevation & Depth).
- **Border:** none by default besides the optional top-rule; `CardHeader` on multi-section cards gets a `border-b border-border` divider.

### Inputs / Fields
- **Style:** `rounded-sm`, hairline border using the warm neutral `border` token.
- **Focus:** brass ring (`ring-primary`), consistent with buttons.

### Tables ("the register")
- **Header:** `border-b-2 border-primary/60` double-rule under the header row (the brass rule, again), column labels uppercase/tracked/11px.
- **Rows:** hairline dividers, hover tint via `bg-muted/50` — no zebra striping.
- **Numeric columns:** always `.figure` (tabular mono), typically right-context but not forced right-aligned everywhere existing layouts didn't already do so.

### Navigation (sidebar)
- **Style:** fixed dark charcoal-navy "counter grille," always dark regardless of app theme.
- **Item:** icon + label, prefixed with a two-digit tabular-mono counter number (`01`, `02`, …) evoking numbered teller windows.
- **Active state:** brass left-border (`border-l-2 border-sidebar-primary`) plus a subtle brass-tinted background, brass icon/number color.
- **Default state:** muted foreground at 65% opacity, brightening on hover.

### Statement Header (signature component)
The top app bar and every page's own header both carry the "letterhead" pattern: a small brass tracked-mono eyebrow line, the heading below it, and a brass rule closing the block. This recurs identically across all 13+ pages and is the single most repeated signature move in the system — it is what makes every page feel like a page from the same printed ledger.

### Settings Rows
- **Structure:** label (14px, medium) with a short help line (12px, muted, relaxed leading) on the left; the control right-aligned on the right, top-aligned with the label. Rows are separated by hairline `border-border` dividers with 16px vertical padding; on narrow windows the control drops below the label.
- **Compact variant:** used in a column that shares its card with a side panel. Where that column is narrow (`lg`), the row stacks to one column with the control and its hint on one line; it returns to label-left/control-right at `xl`. The compact row always reserves the No-Reflow hint slot.
- **Help copy** may carry a live preview of the setting as a figure ("Today reads 28/09/2026"), rendered through `.figure`.

### Unit Input
- **Style:** one bordered field (`rounded-sm`, 40px tall, hairline `input` border, page-background fill) holding the number with its unit inside the border: an optional prefix (currency code, mono, muted 12px) and suffix (`%`, `/ month`, `rows`, muted 12px).
- **Figures:** the number is right-aligned and tabular (`.figure`), so a column of unit inputs aligns like a register.
- **Focus / Error / Disabled:** the whole field takes the brass focus ring (`focus-within`); invalid turns the border brick-red with the message in the row's hint slot; disabled fades the field to 50% (e.g. the interest rate while interest is switched off).

### Segmented Control
- **Style:** for two or three mutually exclusive, short options (theme, 12/24-hour). A `rounded-sm` hairline-bordered track on a muted wash (`muted` at 50%) with a 2px inset; segments are 32px tall with muted text, and the selected segment lifts onto the statement-card colour with ink text and `shadow-sm`. No brass fill on the selected segment: selection reads as a raised slip, not an accent.
- **Use a Select instead** when options are long or more than three.

### Sticky Save Bar
- **Style:** a full-bleed bar pinned to the bottom of a settings form, statement-card background, with a `border-t-2` that is a neutral hairline when everything is saved and turns brass (`primary` at 70%) the moment there are unsaved changes (200ms colour transition).
- **Content:** on the left, a live status line (`aria-live="polite"`): "Unsaved changes in Money rules and Display & lists", naming the dirty sections, or a teller-green check with "All settings saved". On the right, a ghost **Discard** and the primary **Save changes**, both disabled while clean.
- **Rule:** settings are staged, never applied on change; "Reset to defaults" only fills the form, and Save or Discard still decides.

### Teller Slip (worked example)
A small printed-slip readout showing what the current values will do to a sample transaction. It sits as the emphasized card's own right-hand column (below the rows on narrow windows), separated by a hairline rule rather than being a separate card.
- **Lines:** 12px; label in muted text, a dotted leader (`border-dotted`, `border-border`) filling the gap, the figure right-aligned in `.figure`.
- **Totals:** an ink rule (`foreground` at 60%, 1px) above a subtotal; a double rule (3px `border-double`) closes the slip under the final total. Totals are bold ink; a line takes teller-green or brick-red only when its figure carries that meaning (members' share, a penalty charged).
- **Ledger correction:** when an edit changes a figure, the figure in force is shown struck through (muted, brick-red strike at 70%) beside the new one, wrapping above it in a narrow column, with screen-reader "was" / "now" text. A caption says so ("Struck-through figures are the ones in force now"). A figure that cannot be computed from an invalid field reads "—", never a guessed number.

### Attention Strip
- **Style:** a full-width `rounded-sm` strip in the Attention Stamp colours (amber border at 50%, amber wash at 10%), led by a 36px square stamp icon box (`border-2`, amber at 50%, brass icon), with a semibold one-line statement plus a muted explanation, and actions on the right (a ghost link to the relevant settings, then the primary action). Used for the Dashboard backup reminder; it renders only while the condition holds rather than sitting as a permanent banner.
- **Badge form:** the same colours on an outline `<Badge>` ("Backup due", "No backup"); the resolved state switches to the teller-green `secondary` badge ("Backed up").

### Destructive Footer Strip
- **Style:** a destructive action inside an otherwise safe section is walled off in its own footer strip at the bottom of the card: hairline top border, a faint brick-red wash (`destructive` at 4%), a title and one-line consequence on the left, and an outline button in brick-red (border at 50%, brick-red text, 10% brick-red hover wash) on the right.
- **Confirmation:** the button always opens an alert dialog that names exactly what will be overwritten and that it cannot be undone. The confirm action is the solid brick-red button with a specific verb ("Choose file and restore"), with Cancel beside it.

## Do's and Don'ts

### Do:
- **Do** run every monetary amount, date-as-number, count, or ID through the `.figure` utility class.
- **Do** use the brass top-rule (`border-t-2 border-primary/70`) sparingly — one emphasized card per section, not every card.
- **Do** map status meaning strictly: teller-green = positive, brick-red = negative, brass/default = neutral, outline = informational.
- **Do** keep the sidebar and Login-page left panel charcoal-navy in both light and dark themes.
- **Do** use `rounded-sm` as the default corner radius for cards, buttons, inputs, badges, and avatars.
- **Do** show what a money setting will do before it is saved: a teller slip with the in-force figure struck through beside the new one.
- **Do** stage settings behind a sticky save bar that names the unsaved sections; nothing applies until Save.
- **Do** reserve the hint slot under editable money fields so revealing a hint or error never moves the rows below.

### Don't:
- **Don't** reintroduce filled gradient circles (`bg-gradient-primary` + white icon) for icon badges — the system uses bordered square "stamp" badges instead.
- **Don't** use `rounded-full`/`rounded-xl`/`rounded-2xl` on cards, dialogs, or icon badges — reserve fully-rounded shapes for switches, radios, and spinners only.
- **Don't** use raw ad-hoc colored `<span>` pills for status (e.g. `bg-emerald-100 text-emerald-700`) — always route status through the shared `<Badge>` component and its token-driven variants.
- **Don't** imply live sync, multi-device presence, or network/connectivity status anywhere in the UI — this is a strictly offline, single-machine product.
- **Don't** lay out settings as a grid of equal cards; group them by consequence, with the money section as the one brass-ruled card.
- **Don't** colour a reminder or overdue-backup state brick-red; attention is amber, and red is for loss and destructive actions.
- **Don't** place a destructive action inline among ordinary settings rows; wall it off in a tinted footer strip behind a confirmation dialog.
