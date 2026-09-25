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

## Do's and Don'ts

### Do:
- **Do** run every monetary amount, date-as-number, count, or ID through the `.figure` utility class.
- **Do** use the brass top-rule (`border-t-2 border-primary/70`) sparingly — one emphasized card per section, not every card.
- **Do** map status meaning strictly: teller-green = positive, brick-red = negative, brass/default = neutral, outline = informational.
- **Do** keep the sidebar and Login-page left panel charcoal-navy in both light and dark themes.
- **Do** use `rounded-sm` as the default corner radius for cards, buttons, inputs, badges, and avatars.

### Don't:
- **Don't** reintroduce filled gradient circles (`bg-gradient-primary` + white icon) for icon badges — the system uses bordered square "stamp" badges instead.
- **Don't** use `rounded-full`/`rounded-xl`/`rounded-2xl` on cards, dialogs, or icon badges — reserve fully-rounded shapes for switches, radios, and spinners only.
- **Don't** use raw ad-hoc colored `<span>` pills for status (e.g. `bg-emerald-100 text-emerald-700`) — always route status through the shared `<Badge>` component and its token-driven variants.
- **Don't** imply live sync, multi-device presence, or network/connectivity status anywhere in the UI — this is a strictly offline, single-machine product.
