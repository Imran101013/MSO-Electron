import type { Settings } from "@/contexts/SettingsContext";

/**
 * The layout every WhatsApp message from MSO shares: a letterhead, bold capital section headings,
 * figures in monospace blocks with the amounts right-aligned in one column, and a footer.
 * WhatsApp formatting: *bold*, _italic_, ```monospace```, "> " quote.
 */

/** Monospace blocks are this many characters wide, so they don't wrap on a phone held upright. */
export const BLOCK_WIDTH = 28;

export const RULE = "━".repeat(16);

/** The organisation's full name: the one set in Settings, or Mogh Students Organisation. */
export const orgName = (settings: Pick<Settings, "organizationName">) => {
  const name = settings.organizationName?.trim();
  return name && name.toUpperCase() !== "MSO" ? name : "Mogh Students Organisation";
};

/** Organisation name in bold capitals, the kind of message, and a rule. */
export const letterhead = (settings: Pick<Settings, "organizationName">, title: string) => [
  `*${orgName(settings).toUpperCase()} (MSO)*`,
  title,
  RULE,
];

export const heading = (text: string) => `*${text.toUpperCase()}*`;

/** A blank line, the rule, and one italic line. */
export const footer = (text: string) => ["", RULE, `_${text}_`];

export interface FigureRow {
  label: string;
  /** A number is formatted as money; text (e.g. "absent", "18 of 20") is shown as it is. */
  amount: number | string;
  /** "+", "-" or "=" in a column of its own before the label, for workings. */
  sign?: "+" | "-" | "=";
}

const hasPaise = (n: number) => Math.abs(n - Math.round(n)) > 0.005;

/**
 * Label / amount lines in a monospace block, every amount right-aligned at the block's edge.
 * "rule" draws a line under the figures above it. If any amount has paise, all of them show two
 * decimals, so the digits line up; otherwise none do.
 */
export function figureBlock(rows: Array<FigureRow | "rule">): string {
  const figures = rows.filter((r): r is FigureRow => r !== "rule");
  const decimals = figures.some((r) => typeof r.amount === "number" && hasPaise(r.amount)) ? 2 : 0;
  const text = (a: number | string) =>
    typeof a === "number" ? a.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : a;
  const signs = figures.some((r) => r.sign);
  const amountWidth = Math.max(0, ...figures.map((r) => text(r.amount).length));
  const labelWidth = Math.max(1, BLOCK_WIDTH - (signs ? 2 : 0) - amountWidth - 2);
  const fit = (s: string) => (s.length > labelWidth ? `${s.slice(0, labelWidth - 1)}…` : s.padEnd(labelWidth));
  const lines = rows.map((r) =>
    r === "rule"
      ? "-".repeat(BLOCK_WIDTH)
      : `${signs ? `${r.sign ?? " "} ` : ""}${fit(r.label)}  ${text(r.amount).padStart(amountWidth)}`,
  );
  return "```" + lines.join("\n") + "```";
}
