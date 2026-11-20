---
name: MSO
description: The offline savings and loan register of Mogh Students Organization, kept as the organisation's bahi-khata, a red cloth-bound account book.
colors:
  ink-blue: "hsl(216, 58%, 30%)"
  ink-blue-dark: "hsl(214, 75%, 74%)"
  teller-green: "hsl(150, 48%, 27%)"
  teller-green-dark: "hsl(150, 42%, 54%)"
  red-ink: "hsl(3, 66%, 42%)"
  red-ink-dark: "hsl(3, 78%, 66%)"
  brass: "hsl(38, 78%, 52%)"
  brass-dark: "hsl(40, 82%, 58%)"
  binding-maroon: "hsl(358, 56%, 27%)"
  binding-maroon-dark: "hsl(358, 44%, 18%)"
  binding-hover: "hsl(358, 46%, 33%)"
  binding-cream: "hsl(30, 40%, 91%)"
  binding-brass-label: "hsl(40, 85%, 60%)"
  binding-thread: "hsl(36, 55%, 88%)"
  ledger-margin-red: "hsl(2, 68%, 54%)"
  ledger-rule-blue: "hsl(212, 45%, 87%)"
  ledger-wash: "hsl(212, 70%, 96%)"
  ledger-zebra: "hsl(212, 62%, 97%)"
  desk-ground: "hsl(213, 28%, 94%)"
  desk-ground-dark: "hsl(220, 24%, 8%)"
  sheet-white: "hsl(0, 0%, 100%)"
  sheet-dark: "hsl(220, 22%, 11.5%)"
  ink: "hsl(218, 40%, 14%)"
  ink-dark: "hsl(213, 30%, 90%)"
  muted-ink: "hsl(216, 16%, 38%)"
  border: "hsl(213, 26%, 85%)"
  input-border: "hsl(213, 24%, 80%)"
  chart-issued: "hsl(216, 55%, 42%)"
  chart-recovered: "hsl(150, 45%, 32%)"
typography:
  display:
    fontFamily: "Zilla Slab, Georgia, serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.005em"
  headline:
    fontFamily: "Zilla Slab, Georgia, serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.33
    letterSpacing: "-0.005em"
  title:
    fontFamily: "Zilla Slab, Georgia, serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.5
  balance:
    fontFamily: "Public Sans, system-ui, -apple-system, sans-serif"
    fontSize: "34px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.025em"
    fontFeature: "\"tnum\" 1, \"lnum\" 1"
  figure:
    fontFamily: "Public Sans, system-ui, -apple-system, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "0"
    fontFeature: "\"tnum\" 1, \"lnum\" 1"
  body:
    fontFamily: "Public Sans, system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  slip-label:
    fontFamily: "Public Sans, system-ui, -apple-system, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.25
  column-head:
    fontFamily: "Public Sans, system-ui, -apple-system, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.07em"
  tag:
    fontFamily: "Public Sans, system-ui, -apple-system, sans-serif"
    fontSize: "10.5px"
    fontWeight: 600
    letterSpacing: "0.06em"
rounded:
  sm: "3px"
  md: "4.5px"
  lg: "6px"
spacing:
  page: "24px"
  section-gap: "16px"
  sheet-inset: "20px"
  cell-x: "16px"
  cell-y: "10px"
  header-height: "56px"
components:
  button-primary:
    backgroundColor: "{colors.ink-blue}"
    textColor: "{colors.sheet-white}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    height: "36px"
  button-outline:
    backgroundColor: "{colors.sheet-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    height: "36px"
  button-outline-hover:
    backgroundColor: "{colors.ledger-wash}"
  button-destructive:
    backgroundColor: "{colors.red-ink}"
    textColor: "{colors.sheet-white}"
    rounded: "{rounded.sm}"
  table-head:
    backgroundColor: "{colors.ledger-wash}"
    textColor: "{colors.ink-blue}"
    typography: "{typography.column-head}"
    height: "40px"
  table-total:
    backgroundColor: "{colors.ledger-wash}"
    textColor: "{colors.ink}"
  balance-slip:
    backgroundColor: "{colors.sheet-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "16px"
  amounts-note:
    backgroundColor: "{colors.ledger-wash}"
    textColor: "{colors.ink-blue}"
    typography: "{typography.column-head}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  nav-item:
    textColor: "{colors.binding-cream}"
    rounded: "{rounded.sm}"
    height: "40px"
    padding: "0 12px"
  nav-item-active:
    backgroundColor: "{colors.binding-brass-label}"
    textColor: "{colors.binding-maroon}"
  input:
    backgroundColor: "{colors.desk-ground}"
    rounded: "{rounded.sm}"
    height: "32px"
    padding: "4px 12px"
---

# Design System: MSO

## Overview

**Creative North Star: "The Bahi-Khata"**

MSO is the organisation's account book: the red cloth-bound ledger a South Asian treasurer keeps and brings to the monthly meeting. The binding is flat maroon cloth. It forms the sidebar and the login panel, and one solid cream thread line runs down its inner edge. The pages are cool white sheets lying on a grey-blue desk. They are ruled like an account book: blue row lines, a double red rule closing every page title and every table head, and a thin red rule before each money column. Writing and actions are in ink blue. Brass, the sun on the seal, marks the open page and anything that needs attention. Green and red keep their banking meanings.

The story the screens tell is the treasurer's: open the khata, see the balance and what needs attention, post the entries, close it. The Dashboard leads with one large figure in its page head, the money in the bank (Total Budget), and summary slips sit in a row beneath it. Below them are ruled tables with tinted alternate rows and a ruled total line. Density is a working register's: compact rows, tabular figures, almost no decoration beyond the rules themselves.

The system turns down two things. It is not a blue SaaS card grid with gradient hero numbers, and it is not a cream "old ledger" costume with parchment textures and handwriting fonts. The pages are clean, modern sheets. The book shows in the ruling, the binding and the slab headings.

**Key Characteristics:**
- Maroon cloth binding with one cream thread line, and a brass label on the open page.
- Cool white sheets on a grey-blue desk, each sheet bound at its top edge by a 3px maroon line.
- A double red rule under every page title and every table head.
- Money columns are right-aligned tabular figures, each with a thin red rule on its left.
- Totals are ruled the way an account book rules them: a single line above, a double line below.
- Zilla Slab for headings, Public Sans with tabular lining figures for everything else.
- Turning the page: each page settles in as it opens, and its title rule draws across.

## Colors

The palette is restrained and works by role. Ink blue does the writing, maroon is the binding, brass marks the place, and green and red carry money meaning. Every colour is a CSS custom property in `src/index.css` with its own light and dark value. The binding stays maroon in both themes.

### Primary
- **Ink Blue** (ink-blue): buttons, links, focus rings, the caret, table column heads, the "Amounts in" note and small tags. In dark mode it becomes a light periwinkle (ink-blue-dark) so it still reads as ink.

### Secondary
- **Teller Green** (teller-green): money coming in, paid, present. Used for dividends credited, repaid status, recovered amounts and the "All settings saved" tick. Never decorative.

### Tertiary
- **Brass** (brass): the seal's sun. It is used as a wash or a fill: the active nav label (binding-brass-label, with maroon text on it), the backup reminder strip at 10% with a 50% border, the Settings save bar's top border when there are unsaved changes, and text selection at 35%. Text on brass is always ink or maroon.
- **Red Ink** (red-ink): overdue, loss, absence charges, negative figures, destructive buttons and the logout icon.

### Neutral
- **Desk Ground** (desk-ground): the grey-blue surface the sheets lie on. It is also the field colour inside inputs.
- **Sheet White** (sheet-white): cards, dialogs, popovers and the header bar (at 95% with a backdrop blur).
- **Ink** (ink): body text and figures. **Muted Ink** (muted-ink): slip labels, descriptions, notes and dates.
- **Border** (border) and **Input Border** (input-border): card edges, dividers and field strokes.
- **Ledger Rule Blue** (ledger-rule-blue): the horizontal row lines in tables and the rule under a slip's figure.
- **Ledger Margin Red** (ledger-margin-red): the double rule under page titles (85%) and table heads (90%), and the money-column rule (28%).
- **Ledger Wash** (ledger-wash): the pale blue under table heads, total rows, the Amounts note, and outline and ghost button hovers.
- **Ledger Zebra** (ledger-zebra): the tint on every other table row.
- **Binding Maroon** (binding-maroon), **Binding Hover** (binding-hover), **Binding Cream** (binding-cream), **Binding Thread** (binding-thread): the cloth, the hovered nav row, the text on the cloth, and the thread line (at 35% down the inner edge, 25% between nav groups).
- **Chart Issued / Chart Recovered**: the two Dashboard loan series, ink blue against green, set apart in both hue and lightness so they stay distinct under colour-blind vision.

### Named Rules
**The Money Meaning Rule.** Green means money in, paid or present. Red ink means loss, overdue or destructive. Neither is ever used for decoration, section colour or emphasis.

**The Brass Is a Place Rule.** Brass marks the open page and things that need attention, and it appears only as a fill, wash or border. Brass is never used for small text on a white sheet.

**The Ink Writes Rule.** Every action and every column heading is ink blue. A second accent colour for buttons does not exist.

## Typography

**Display Font:** Zilla Slab (with Georgia, serif), bundled at 500, 600 and 700.
**Body Font:** Public Sans (with system-ui, -apple-system, sans-serif), bundled at 400, 500, 600 and 700.

**Character:** The slab is the printed heading of an account book: sturdy, a little old-fashioned, never ornamental. Public Sans is the clerk's hand, plain and legible, and its tabular lining figures keep every column of money aligned.

Both faces are bundled from `@fontsource` so the app looks the same offline. Every `h1`, `h2` and `h3` is set in the slab at 700 with -0.005em tracking, so card titles (which are `h3`) are slab as well. Headings from `h4` down use Public Sans at 600.

### Hierarchy
- **Display** (Zilla Slab 700, 36px): the cover title on the Login binding panel only.
- **Headline** (Zilla Slab 700, 24px): the page title in every page head, sitting on the double red rule. The Login form's heading uses 30px.
- **Title** (Zilla Slab 700, 16px): card and section titles ("Active Loans", "Money rules", "Members' dividends for 2026").
- **Balance** (Public Sans 600, 34px, line-height 1, tabular): the one large balance figure in the Dashboard page head. There is one per screen at most.
- **Figure** (Public Sans 600, 24px, tabular): the amount on a balance slip.
- **Body** (Public Sans 400, 14px): table cells, form text and descriptions. Help text and notes use 12px in muted ink.
- **Slip label** (Public Sans 500, 13px, sentence case, muted ink): the caption above a slip's figure and above the Dashboard balance.
- **Column head** (Public Sans 600, 11px, uppercase, 0.07em tracking, ink blue): table heads and the "Amounts in PKR" note.
- **Tag** (Public Sans 600, 10.5px, uppercase, 0.06em tracking): badges.
- **Form group label** (Public Sans 600, 12px, uppercase, wider tracking, muted ink): the heading of a group of fields inside a dialog or detail panel ("Personal Information", "Repayments"). It names the group itself; it is not a line placed above another heading.

### Named Rules
**The Tabular Figures Rule.** Every money amount, count and numeric date has tabular lining figures (the `.figure` utility, or the `num` cell class in tables). Proportional figures in a column of money are a defect.

**The Slab Is for Headings Rule.** Zilla Slab sets headings only. Figures, labels and body text are always Public Sans.

## Layout

The app shell is a fixed binding sidebar on the left and a page area on the right. The page area has a sticky 56px header bar (sheet white at 95% with a backdrop blur, a bottom border and a small shadow) holding the sidebar toggle, the member search, the theme switch, the seal with the signed-in name, and the login-details and logout buttons. Page content is padded 24px and stacks its blocks with a 16px gap.

Every page opens with a page head: the slab title, a one-line muted description where it helps, and the Amounts note, closed by the double red rule with 12 to 16px of padding above it. Actions sit at the right of the head. On the Dashboard the right side of the head carries the bank balance instead: a 13px label, the 34px figure, and today's date.

Summary slips run in a grid: one column on narrow windows, two from 768px, four from 1024px. Detail areas pair a wide sheet with a narrow one (2fr to 1fr) from 1024px. Inside sheets, horizontal padding is 20px. Table cells are 16px by 10px, and the Dashboard loan sheet tightens them to 12px by 8px. Wide tables scroll inside their own sheet rather than widening the page.

The Settings and Reports sheets lay out by their own width (container queries), not by the window. Setting rows go to two columns from 54rem of sheet width. Report rows stack when narrow, put actions on the right from 36rem, and read across in four columns from 54rem.

## Elevation & Depth

Depth is mostly flat and comes from layering: grey-blue desk, white sheet, pale-blue wash. Shadows are small and tinted with ink, never black.

### Shadow Vocabulary
- **Resting** (`box-shadow: 0 1px 2px hsl(218 40% 20% / 0.07)`): every sheet, slip, button and the header bar.
- **Raised** (`box-shadow: 0 6px 18px hsl(218 40% 20% / 0.10), 0 2px 6px hsl(218 40% 16% / 0.06)`): a balance slip on hover, and the Login submit button.
- **Floating** (`box-shadow: 0 16px 36px hsl(218 40% 20% / 0.14), 0 4px 10px hsl(218 40% 16% / 0.08)`): the member search dropdown, the Login form sheet and dialogs.

In dark mode the same three steps use near-black shadows at 45%, 50% and 60%.

### Named Rules
**The Sheet Lies Flat Rule.** A sheet rests at the smallest shadow. Only hover, a popover or a dialog lifts it further.

## Shapes

Corners are tight, like trimmed paper: 3px is the working radius (`rounded-sm`) on sheets, slips, buttons, inputs, badges, nav rows and dialogs. The base radius token is 6px, and the shadcn default of 6px is left on the few primitives that keep it.

The recurring forms are rules rather than shapes:
- **The bound top edge:** a 3px maroon line across the top of a sheet that stands for a page of the book: settings sheets, form sheets, the member and meeting dialogs, the member search dropdown and the Login form.
- **The double red rule:** two 1px lines 4px apart in margin red, under page titles; and a 3px double border under table heads.
- **The total rule:** a 1px line above and a 3px double line below, in ink at 45%.
- **The money-column rule:** a 1px margin-red line at 28% on the left of each money column.
- **The thread line:** one solid 1px cream line, 7px in from the binding's inner edge, plus short thread lines between nav groups.

Icon wells (the next-meeting date tile, report row icons, the backup reminder icon) are small 3px-radius squares with a 2px tinted border and a matching 5 to 15% fill.

## Components

### Buttons
Plain and ink-coloured, like a stamped instruction.
- **Shape:** 3px corners on page buttons (the shadcn default is 6px, and pages set 3px).
- **Primary:** ink blue fill with white text, 36px tall, 16px side padding, 14px medium weight, resting shadow. Hover goes to 90% ink. Press scales to 98%.
- **Outline:** sheet white with an input-border stroke and ink text. Hover tints the border ink blue at 40% and fills with the ledger wash. Reports uses outline "View" buttons in every row.
- **Ghost:** no fill. Hover fills with the ledger wash and turns the text ink blue. Used for header icon buttons, "Discard" and "Reminder settings".
- **Destructive:** red ink fill with white text. A destructive action inside a page uses an outline button with a red-ink border at 50% and red text.
- **Focus:** a 2px ink-blue ring with a 2px offset.
- **Sizes:** small is 32px with 12px text; large is 44px with 16px text (the Login submit).

### Badges and the Amounts note
- **Badge:** 3px corners, a 1px tinted border, a 7 to 8% fill of the same colour, 10.5px uppercase semibold text. Variants: ink blue (default), teller green, red ink, and a dashed outline in ink at 30% for provisional states ("Preview, not saved").
- **Amounts note:** "Amounts in PKR" in ink blue column-head type on the ledger wash with a light ink border. It sits under the page title or in a section head, so the figures below can be shown without the currency.

### Sheets (cards)
- **Corner style:** 3px.
- **Background:** sheet white (sheet-dark in dark mode) with a 1px border.
- **Shadow:** resting.
- **Bound top edge:** the 3px maroon line on sheets that stand for a page of the book.
- **Header:** a slab title at 16px with an optional muted count or description, 20px by 12px, divided from the body by a border. "View all" links sit on the right.

### Balance slip
The Dashboard's summary slip. A 3px sheet with 16px padding: a 13px sentence-case label in muted ink with a 14px icon in its meaning colour (ink for counts, red for loans out and overdue, brass for the reserve), then the figure in 24px semibold tabular type. A note or trend, when there is one, is ruled off below by a blue ledger rule. On hover it lifts to the raised shadow. The Member dialog uses the same slip labels.

### Ledger table
The signature component, and the one every list in the app uses.
- **Head:** the ledger wash, 40px tall, 11px uppercase ink-blue column heads, closed by a 3px double margin-red border.
- **Rows:** a 1px blue ledger rule between rows. Every other row is tinted ledger zebra (the user asked for these stripes). Hover tints a row with ink blue at 5%. A row's own highlight always wins over the stripe.
- **Money columns:** right-aligned tabular figures that do not wrap, each with the thin red rule on its left. Applies to the head cell as well as the body cells.
- **Totals:** a footer row (or a total row inside the body) on the ledger wash in semibold, with a single rule above and a double rule below. It is used for Total outstanding, the dividends footer, Budget and Reserve totals and balances, and the meeting dialog's Total savings.
- **Figures in meaning colours:** dividends in green, charges and overdue dates in red, everything else in ink.

### Inputs / Fields
- **Style:** 32px tall, 3px corners, a 1px input-border stroke, filled with the desk ground so a field reads as a space to write in. Login fields are 44px.
- **Focus:** a 2px ink-blue ring with a 2px offset. The caret is ink blue.
- **Error / disabled:** the stroke turns red ink and a red message sits below. Disabled fields drop to 50% opacity.
- **Units:** money settings show a suffix such as "/ month" inside the field.

### Navigation (the binding)
- **Cover label:** at the top of the binding, a 3px box with a brass border at 45% on a darker maroon wash. It holds the 56px seal, "MSO" in 30px Zilla Slab and "Mogh Students Organization" in 11px cream at 75%.
- **Groups:** three blocks split by short thread lines: Dashboard; the entry pages (Meetings, Loans, Members, Reserve Fund) in semibold full cream with brass icons; then the viewing and occasional pages (Profit Distribution, Budget, Reports, Audit Log, Settings) in medium cream at 70% with dimmer icons.
- **Rows:** 40px, 3px corners, 14px text, 16px icon. Hover fills with binding hover and brightens the text.
- **Active:** the brass label: a brass fill, maroon text and icon, semibold, with a fine inner edge and a 1px shadow below.

### Page head
The slab title on the double red rule, which draws across from the left in 420ms when the page opens. The whole page settles in over 260ms, rising 6px from 40% opacity. Both animations stop under reduced motion and when Settings turns animations off. Spinners keep turning.

### Settings patterns
- **Setting row:** the label and its help text on the left; the field, its hint and any error on the right. Rows are divided by borders inside a bound sheet.
- **Sticky save bar:** fixed to the bottom of the page, sheet white, with a 2px top border that turns brass when there are unsaved changes. It says what is unsaved and in which sections ("Unsaved changes in Money rules") or shows a green tick for "All settings saved", with Discard (ghost) and Save changes (primary) on the right.
- **Destructive footer strip:** at the foot of the data sheet, a strip on red ink at 4% above a border, explaining the action, with a red-outline button (Restore from backup, Clear all records) that opens a confirmation dialog.

### Reports index
One report per row inside a section sheet: a 32px icon well, the report name in 14px semibold, a scope line in ink-blue uppercase tracked type, a muted description, and the period picker with an outline View button on the right.

### Login
The left half is the binding: maroon cloth with a cream thread border inset 16px, and a cover label holding the 128px seal, the title in 36px slab and a tagline. The right half is the desk with one bound white form sheet (floating shadow, 32px padding). On narrow windows the binding panel is hidden and the seal sits above the form.

### Attention strip
The backup reminder: a full-width strip in a brass wash (10%) with a brass border at 50%, an icon well, a semibold reason, a muted explanation, and a ghost link with a small primary action on the right.

## Do's and Don'ts

### Do:
- **Do** put the double red rule under every page title, and the 3px double margin-red border under every table head.
- **Do** give every money column the `num` treatment: right-aligned tabular figures with the thin red rule on the left.
- **Do** close summed tables with a total row on the ledger wash, with a single rule above and a double rule below.
- **Do** keep the alternate-row stripes on every ledger table. The user chose them.
- **Do** use the MSO seal as the only mark: on the cover label, in the header beside the signed-in name and on the Login cover. Never redraw or replace it.
- **Do** label the Dashboard's large figure as Total Budget, the money in the bank account.
- **Do** use the 3px maroon top edge on a sheet that stands for a page of the book, and 3px corners on everything you build.
- **Do** write labels in sentence case at 13px for slip captions, and keep uppercase for column heads, badges, the Amounts note and form group labels.

### Don't:
- **Don't** use green or red for anything except money meaning (in, paid and present; loss, overdue and destructive).
- **Don't** set small text in brass on a white sheet. Brass is a fill, wash or border.
- **Don't** add a second action colour. Actions are ink blue, and destructive actions are red ink.
- **Don't** put the large balance figure on more than one place per screen, or turn slips into gradient hero numbers.
- **Don't** add parchment textures, stitching, weave patterns or handwriting fonts. The binding is flat maroon with one solid thread line.
- **Don't** show member registration or member numbers anywhere. Members have none.
- **Don't** use proportional figures in columns of money.
- **Don't** add web-font links. Fonts are bundled.
