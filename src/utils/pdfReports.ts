/**
 * MSO PDF reports.
 *
 * Every report is rendered from the derived ledger in ./accounting so figures agree
 * across documents. House style follows common practice for audited statements:
 * A4, MSO letterhead with logo on every page, document reference and issue date,
 * right-aligned figures to two decimals, negatives in (parentheses), nil as "-",
 * single rules above subtotals and double rules under totals, balances carried
 * forward, "Page x of y", and signature panels where approval is expected.
 */
import jsPDF from "jspdf";
import { autoTable, type CellDef, type RowInput, type Styles } from "jspdf-autotable";
import { format } from "date-fns";
import { timePattern } from "@/lib/utils";
import logoUrl from "@/assets/mso-logo.png";
import {
  AGING_LABELS,
  EPS,
  KIND_LABELS,
  type AgingBucket,
  type Books,
  type LedgerEntry,
  type LoanPosition,
  type ReportPeriod,
  entriesInPeriod,
  openingDate,
  parseDay,
  r2,
} from "./accounting";

export type ReportKind =
  | "financial-statements"
  | "trial-balance"
  | "cash-book"
  | "member-statement"
  | "member-register"
  | "loan-portfolio"
  | "loan-statement"
  | "contribution-register"
  | "reserve-ledger"
  | "profit-distribution"
  | "meetings-register";

export interface ReportRequest {
  kind: ReportKind;
  period: ReportPeriod;
  memberId?: string;
  loanId?: string;
  distributionId?: string;
}

export interface ReportSettings {
  organizationName?: string;
  dateFormat?: string;
  timeFormat?: string;
  currency?: string;
  reserveSharePercent?: number;
}

// ───────────────────────── Formatting ─────────────────────────

type RGB = [number, number, number];

const C = {
  navy: [36, 66, 118] as RGB,
  gold: [226, 150, 40] as RGB,
  ink: [28, 32, 38] as RGB,
  muted: [104, 112, 124] as RGB,
  rule: [204, 210, 218] as RGB,
  zebra: [246, 248, 251] as RGB,
  band: [233, 238, 246] as RGB,
  panel: [249, 250, 252] as RGB,
  good: [28, 110, 68] as RGB,
  bad: [168, 44, 34] as RGB,
  white: [255, 255, 255] as RGB,
};

const nf = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Accounting format: 1,234.00 · (1,234.00) for negatives · "-" for nil. */
export const money = (n: number | null | undefined) => {
  if (n === null || n === undefined || Number.isNaN(n)) return "";
  if (Math.abs(n) < EPS) return "-";
  return n < 0 ? `(${nf.format(-n)})` : nf.format(n);
};

/** Inline/headline figures: like `money` but a nil amount reads "0.00" rather than "-". */
const plain = (n: number) => (Math.abs(n) < EPS ? "0.00" : money(n));

const amt = (cur: string, n: number) => `${cur} ${plain(n)}`;

const pct = (n: number | null, digits = 2) => (n === null || !Number.isFinite(n) ? "-" : `${(n * 100).toFixed(digits)}%`);

const sumOf = <T>(items: T[], pick: (t: T) => number) => r2(items.reduce((s, t) => s + (pick(t) || 0), 0));

const slug = (s: string) => s.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

/** Settings default the name to the "MSO" abbreviation; documents carry the full registered name. */
const resolveOrgName = (name?: string) => {
  const n = (name || "").trim();
  return !n || n.toUpperCase() === "MSO" ? "Mogh Students Organisation" : n;
};

// ───────────────────────── Logo ─────────────────────────

let logoPromise: Promise<string | null> | null = null;

/** Loads the bundled MSO seal once, flattened onto white so it embeds without an alpha mask. */
function loadLogo(): Promise<string | null> {
  if (!logoPromise) {
    logoPromise = new Promise<string | null>((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(null);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = logoUrl;
    }).then((result) => {
      if (!result) logoPromise = null; // allow a retry on the next report
      return result;
    });
  }
  return logoPromise;
}

// ───────────────────────── Page layout ─────────────────────────

interface ReportContext {
  orgName: string;
  dateFormat: string;
  timeFormat: string;
  currency: string;
  /** Reserve share of profit (%) as currently set. */
  reserveSharePercent: number;
  logo: string | null;
  generatedAt: Date;
}

interface ReportMeta {
  code: string;
  title: string;
  subtitle: string;
  landscape?: boolean;
  confidential?: boolean;
}

type Align = "l" | "r" | "c";

interface TableSpec {
  head: string[];
  body: RowInput[];
  foot?: RowInput[];
  align: Align[];
  widths?: Array<number | "auto">;
  fontSize?: number;
  empty?: string;
  /** Double rule under numeric footer cells (grand totals). Default true. */
  doubleRule?: boolean;
}

type Line =
  | { t: "section"; label: string }
  | { t: "item"; label: string; note?: string; v: Array<number | null>; indent?: number; bold?: boolean }
  | { t: "sub"; label: string; v: Array<number | null> }
  | { t: "total"; label: string; v: Array<number | null> }
  | { t: "gap" };

const HALIGN: Record<Align, "left" | "right" | "center"> = { l: "left", r: "right", c: "center" };

type Fmt = (key: string) => string;

const fmtDay = (key: string, pattern: string) => format(parseDay(key), pattern);

/** "01/01/2026 to 25/09/2026" or "Inception to 25/09/2026". */
const rangeText = (d: Fmt, p: ReportPeriod) => (p.from ? `${d(p.from)} to ${d(p.to)}` : `Inception to ${d(p.to)}`);

const periodSubtitle = (d: Fmt, p: ReportPeriod) => (p.from ? `For the period ${rangeText(d, p)}` : `From inception to ${d(p.to)}`);
const PT = 0.3528; // mm per point

class Report {
  readonly doc: jsPDF;
  readonly W: number;
  readonly H: number;
  readonly M = 14;
  readonly TOP = 26;
  readonly FIRST_TOP = 52.5;
  readonly BOTTOM: number;
  readonly ref: string;
  y: number;

  constructor(readonly meta: ReportMeta, readonly ctx: ReportContext) {
    this.doc = new jsPDF({ orientation: meta.landscape ? "landscape" : "portrait", unit: "mm", format: "a4", compress: true });
    this.W = this.doc.internal.pageSize.getWidth();
    this.H = this.doc.internal.pageSize.getHeight();
    this.BOTTOM = this.H - 18;
    this.y = this.FIRST_TOP;
    this.ref = `MSO/${meta.code}/${format(ctx.generatedAt, "yyyyMMdd-HHmm")}`;
    this.doc.setProperties({
      title: `${ctx.orgName} - ${meta.title}`,
      subject: `${meta.title} - ${meta.subtitle}`,
      author: ctx.orgName,
      creator: "MSO",
      keywords: `MSO, ${meta.title}, ${this.ref}`,
    });
    this.doc.setLanguage("en-GB");
  }

  get cw() {
    return this.W - 2 * this.M;
  }

  readonly d: Fmt = (key) => fmtDay(key, this.ctx.dateFormat);

  readonly long: Fmt = (key) => fmtDay(key, "d MMMM yyyy");

  private font(size: number, style: "normal" | "bold" | "italic" | "bolditalic" = "normal", color: RGB = C.ink) {
    this.doc.setFont("helvetica", style);
    this.doc.setFontSize(size);
    this.doc.setTextColor(...color);
  }

  private text(s: string, x: number, y: number, opts: { align?: "left" | "right" | "center"; charSpace?: number } = {}) {
    const { align = "left", charSpace = 0 } = opts;
    if (!charSpace || align === "left") {
      this.doc.text(s, x, y, { baseline: "top", align, charSpace });
      return;
    }
    // jsPDF aligns on the unspaced width, so letter-spaced text drifts; position it from the left instead.
    const w = this.spacedWidth(s, charSpace);
    this.doc.text(s, align === "right" ? x - w : x - w / 2, y, { baseline: "top", charSpace });
  }

  private spacedWidth(s: string, charSpace: number) {
    return this.doc.getTextWidth(s) + charSpace * Math.max(0, s.length - 1);
  }

  private fit(s: string, width: number) {
    if (this.doc.getTextWidth(s) <= width) return s;
    let t = s;
    while (t.length > 1 && this.doc.getTextWidth(`${t}...`) > width) t = t.slice(0, -1);
    return `${t.trimEnd()}...`;
  }

  private lastY() {
    return (this.doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  }

  ensure(h: number) {
    if (this.y + h > this.BOTTOM) this.newPage();
  }

  newPage() {
    this.doc.addPage();
    this.y = this.TOP;
  }

  gap(h = 3) {
    this.y += h;
  }

  heading(label: string, keepWithNext = 26) {
    this.ensure(keepWithNext);
    this.y += 1.5;
    this.font(9.6, "bold", C.navy);
    this.text(label.toUpperCase(), this.M, this.y, { charSpace: 0.25 });
    this.doc.setDrawColor(...C.gold);
    this.doc.setLineWidth(0.7);
    this.doc.line(this.M, this.y + 5, this.M + 16, this.y + 5);
    this.y += 8.5;
  }

  subheading(label: string) {
    this.ensure(14);
    this.font(8.6, "bold", C.ink);
    this.text(label, this.M, this.y);
    this.y += 5.2;
  }

  statementTitle(title: string, sub: string) {
    this.ensure(40);
    const cx = this.W / 2;
    this.font(11.5, "bold", C.navy);
    this.text(title.toUpperCase(), cx, this.y, { align: "center", charSpace: 0.3 });
    this.font(8.8, "normal", C.ink);
    this.text(sub, cx, this.y + 5.8, { align: "center" });
    this.font(7.2, "italic", C.muted);
    this.text(this.ctx.currency === "PKR" ? "(Amounts in Pakistani Rupees)" : `(Amounts in ${this.ctx.currency})`, cx, this.y + 10.4, { align: "center" });
    this.y += 16.5;
  }

  paragraph(s: string, o: { size?: number; style?: "normal" | "bold" | "italic"; color?: RGB; indent?: number; after?: number } = {}) {
    const size = o.size ?? 8.2;
    const lh = size * PT * 1.42;
    const x = this.M + (o.indent ?? 0);
    this.font(size, o.style ?? "normal", o.color ?? C.ink);
    const lines: string[] = this.doc.splitTextToSize(s, this.cw - (o.indent ?? 0));
    for (const ln of lines) {
      if (this.y + lh > this.BOTTOM) {
        this.newPage();
        this.font(size, o.style ?? "normal", o.color ?? C.ink);
      }
      this.text(ln, x, this.y);
      this.y += lh;
    }
    this.y += o.after ?? 2;
  }

  note(s: string) {
    this.paragraph(s, { size: 7.2, style: "italic", color: C.muted, after: 1.5 });
  }

  infoGrid(pairs: Array<[string, string]>, cols = 3) {
    const rowH = 9.6;
    const rows = Math.ceil(pairs.length / cols);
    const h = rows * rowH + 2.6;
    this.ensure(h + 4);
    this.doc.setFillColor(...C.panel);
    this.doc.setDrawColor(...C.rule);
    this.doc.setLineWidth(0.15);
    this.doc.rect(this.M, this.y, this.cw, h, "FD");
    const colW = this.cw / cols;
    pairs.forEach(([k, v], i) => {
      const x = this.M + (i % cols) * colW + 3;
      const y = this.y + 2.3 + Math.floor(i / cols) * rowH;
      this.font(6.1, "bold", C.muted);
      this.text(k.toUpperCase(), x, y, { charSpace: 0.2 });
      this.font(8.6, "bold", C.ink);
      this.text(this.fit(v || "-", colW - 6), x, y + 3.3);
    });
    this.y += h + 5;
  }

  kpis(items: Array<{ label: string; value: string; sub?: string; tone?: "good" | "bad" }>) {
    const gap = 3;
    const n = items.length;
    const w = (this.cw - gap * (n - 1)) / n;
    this.font(6.4, "normal");
    const subs = items.map((it) => (it.sub ? (this.doc.splitTextToSize(it.sub, w - 6) as string[]).slice(0, 2) : []));
    const h = 17.5 + (subs.some((s) => s.length > 1) ? 2.8 : 0);
    this.ensure(h + 5);
    items.forEach((it, i) => {
      const x = this.M + i * (w + gap);
      this.doc.setFillColor(...C.panel);
      this.doc.setDrawColor(...C.rule);
      this.doc.setLineWidth(0.15);
      this.doc.rect(x, this.y, w, h, "FD");
      this.doc.setDrawColor(...C.gold);
      this.doc.setLineWidth(0.9);
      this.doc.line(x, this.y + 0.45, x + w, this.y + 0.45);
      this.font(6, "bold", C.muted);
      this.text(this.fit(it.label.toUpperCase(), w - 6), x + 3, this.y + 3.2, { charSpace: 0.2 });
      this.font(11, "bold", it.tone === "good" ? C.good : it.tone === "bad" ? C.bad : C.ink);
      this.text(this.fit(it.value, w - 6), x + 3, this.y + 7.4);
      this.font(6.4, "normal", C.muted);
      subs[i].forEach((ln, k) => this.text(this.fit(ln, w - 6), x + 3, this.y + 13 + k * 2.8));
    });
    this.y += h + 5.5;
  }

  table(spec: TableSpec) {
    const fs = spec.fontSize ?? 7.8;
    const columnStyles: Record<number, Partial<Styles>> = {};
    spec.align.forEach((a, i) => {
      columnStyles[i] = { halign: HALIGN[a], cellWidth: spec.widths?.[i] ?? "auto" };
    });
    const body: RowInput[] = spec.body.length
      ? spec.body
      : [[{ content: spec.empty ?? "No records for the selected period.", colSpan: spec.head.length, styles: { halign: "center", fontStyle: "italic", textColor: C.muted } }]];
    this.ensure(20);
    autoTable(this.doc, {
      startY: this.y,
      head: [spec.head],
      body,
      foot: spec.foot,
      theme: "plain",
      margin: { top: this.TOP, bottom: this.H - this.BOTTOM, left: this.M, right: this.M },
      styles: {
        font: "helvetica",
        fontSize: fs,
        textColor: C.ink,
        cellPadding: { top: 1.45, bottom: 1.45, left: 1.7, right: 1.7 },
        lineColor: C.rule,
        lineWidth: { top: 0, right: 0, bottom: 0.1, left: 0 },
        valign: "middle",
        overflow: "linebreak",
      },
      headStyles: { fillColor: C.navy, textColor: C.white, fontStyle: "bold", fontSize: fs - 0.6, lineWidth: 0, valign: "bottom" },
      footStyles: { fillColor: C.band, textColor: C.ink, fontStyle: "bold", lineColor: C.navy, lineWidth: { top: 0.35, right: 0, bottom: 0, left: 0 } },
      alternateRowStyles: { fillColor: C.zebra },
      columnStyles,
      showHead: "everyPage",
      showFoot: "lastPage",
      rowPageBreak: "avoid",
      didParseCell: (h) => {
        if (h.section !== "body" && h.cell.colSpan === 1) h.cell.styles.halign = columnStyles[h.column.index]?.halign ?? "left";
      },
      didDrawCell: (h) => {
        if (spec.doubleRule === false || h.section !== "foot" || spec.align[h.column.index] !== "r" || h.cell.colSpan > 1) return;
        if (!h.cell.text.join("").trim()) return;
        const { x, y, width, height } = h.cell;
        this.doc.setDrawColor(...C.navy);
        this.doc.setLineWidth(0.18);
        this.doc.line(x + 2, y + height - 1.0, x + width - 0.6, y + height - 1.0);
        this.doc.line(x + 2, y + height - 0.4, x + width - 0.6, y + height - 0.4);
      },
    });
    this.y = this.lastY() + 5.5;
  }

  /** Financial-statement layout: particulars, optional note ref, value columns with sub/total rules. */
  statement(lines: Line[], headers: string[], opts: { note?: boolean; valueWidth?: number } = {}) {
    const noteCol = !!opts.note;
    const nVal = headers.length;
    const first = noteCol ? 2 : 1;
    const valW = opts.valueWidth ?? (nVal >= 4 ? 27 : nVal === 3 ? 30 : 34);
    const span = first + nVal;
    const kinds: Line["t"][] = [];
    const body: RowInput[] = lines.map((ln) => {
      kinds.push(ln.t);
      if (ln.t === "gap") return [{ content: "", colSpan: span, styles: { minCellHeight: 2.2, cellPadding: 0 } }];
      if (ln.t === "section") {
        return [{ content: ln.label.toUpperCase(), colSpan: span, styles: { fontStyle: "bold", textColor: C.navy, fontSize: 7.4, cellPadding: { top: 3.4, bottom: 1.1, left: 1.7, right: 1.7 } } }];
      }
      const strong = ln.t !== "item" || !!ln.bold;
      const indent = ln.t === "item" && !ln.bold ? 4 + (ln.indent ?? 0) * 4 : 1.7;
      const cells: CellDef[] = [{ content: ln.label, styles: { fontStyle: strong ? "bold" : "normal", cellPadding: { top: 1.35, bottom: 1.35, left: indent, right: 1.7 } } }];
      if (noteCol) cells.push({ content: ln.t === "item" ? ln.note ?? "" : "", styles: { halign: "center", textColor: C.muted } });
      ln.v.forEach((v) => cells.push({ content: money(v), styles: { fontStyle: strong ? "bold" : "normal" } }));
      return cells;
    });
    const columnStyles: Record<number, Partial<Styles>> = { 0: { cellWidth: "auto" } };
    if (noteCol) columnStyles[1] = { cellWidth: 11, halign: "center" };
    for (let i = first; i < span; i++) columnStyles[i] = { cellWidth: valW, halign: "right" };

    this.ensure(24);
    autoTable(this.doc, {
      startY: this.y,
      head: [["", ...(noteCol ? ["Note"] : []), ...headers]],
      body,
      theme: "plain",
      margin: { top: this.TOP, bottom: this.H - this.BOTTOM, left: this.M, right: this.M },
      styles: { font: "helvetica", fontSize: 8, textColor: C.ink, cellPadding: { top: 1.35, bottom: 1.35, left: 1.7, right: 1.7 }, lineWidth: 0, valign: "middle" },
      headStyles: { fontStyle: "bold", textColor: C.navy, fontSize: 7.3, lineColor: C.navy, lineWidth: { top: 0, right: 0, bottom: 0.4, left: 0 }, valign: "bottom" },
      columnStyles,
      showHead: "everyPage",
      rowPageBreak: "avoid",
      didParseCell: (h) => {
        if (h.section === "head") h.cell.styles.halign = h.column.index >= first ? "right" : h.column.index === 1 && noteCol ? "center" : "left";
      },
      didDrawCell: (h) => {
        if (h.section !== "body" || h.column.index < first || h.cell.colSpan > 1) return;
        const k = kinds[h.row.index];
        if ((k !== "sub" && k !== "total") || !h.cell.text.join("").trim()) return;
        const { x, y, width, height } = h.cell;
        this.doc.setDrawColor(...C.ink);
        this.doc.setLineWidth(0.2);
        this.doc.line(x + 3, y + 0.25, x + width - 0.6, y + 0.25);
        if (k === "total") {
          this.doc.line(x + 3, y + height - 0.9, x + width - 0.6, y + height - 0.9);
          this.doc.line(x + 3, y + height - 0.3, x + width - 0.6, y + height - 0.3);
        }
      },
    });
    this.y = this.lastY() + 5;
  }

  signatures(roles: string[], lead?: string) {
    this.ensure(36);
    if (lead) this.paragraph(lead, { size: 7.8, color: C.muted });
    this.y += 13;
    const gap = 10;
    const w = (this.cw - gap * (roles.length - 1)) / roles.length;
    roles.forEach((role, i) => {
      const x = this.M + i * (w + gap);
      this.doc.setDrawColor(...C.ink);
      this.doc.setLineWidth(0.25);
      this.doc.line(x, this.y, x + w, this.y);
      this.font(7.6, "bold", C.ink);
      this.text(role, x, this.y + 1.8);
      this.font(6.3, "normal", C.muted);
      this.text("Name, signature and date", x, this.y + 5.4);
    });
    this.y += 12;
  }

  private drawLogo(x: number, y: number, size: number) {
    if (this.ctx.logo) {
      this.doc.addImage(this.ctx.logo, "PNG", x, y, size, size, "mso-logo", "FAST");
      return;
    }
    // Fallback mark if the image asset could not be loaded.
    this.doc.setFillColor(...C.navy);
    this.doc.circle(x + size / 2, y + size / 2, size / 2, "F");
    this.doc.setDrawColor(...C.gold);
    this.doc.setLineWidth(size * 0.04);
    this.doc.circle(x + size / 2, y + size / 2, size / 2 - size * 0.08, "S");
    this.font(size * 0.9, "bold", C.white);
    this.doc.text("MSO", x + size / 2, y + size / 2, { align: "center", baseline: "middle" });
  }

  private drawLetterhead() {
    const { M, W } = this;
    // The seal spans the reference/date block on the right (top of "DOCUMENT REF." to the date's
    // baseline), and the name and tagline are centred against it.
    this.drawLogo(M, 10.3, 14.4);
    const x = M + 18.4;
    this.font(14.5, "bold", C.navy);
    this.text(this.ctx.orgName.toUpperCase(), x, 12.45, { charSpace: 0.35 });
    this.font(7.9, "normal", C.muted);
    this.text("MSO  |  Member Savings, Loans & Reserve Fund Records", x, 19.85);
    // this.text(this.ctx.currency === "PKR" ? "All amounts in Pakistani Rupees (PKR)" : `All amounts in ${this.ctx.currency}`, x, 21.6);

    this.font(6, "bold", C.muted);
    this.text("DOCUMENT REF.", W - M, 10.2, { align: "right", charSpace: 0.25 });
    this.text("DATE OF ISSUE", W - M, 19, { align: "right", charSpace: 0.25 });
    this.font(8.4, "bold", C.ink);
    this.text(this.ref, W - M, 13.3, { align: "right" });
    this.text(`${format(this.ctx.generatedAt, this.ctx.dateFormat)}  ${format(this.ctx.generatedAt, timePattern(this.ctx.timeFormat))}`, W - M, 22.1, { align: "right" });

    this.doc.setDrawColor(...C.navy);
    this.doc.setLineWidth(0.7);
    this.doc.line(M, 29.5, W - M, 29.5);
    this.doc.setDrawColor(...C.gold);
    this.doc.setLineWidth(0.35);
    this.doc.line(M, 30.6, W - M, 30.6);

    this.font(15, "bold", C.ink);
    this.text(this.meta.title, M, 35);
    this.font(8.8, "normal", C.muted);
    this.text(this.meta.subtitle, M, 42.2);
    if (this.meta.confidential) {
      this.font(6.4, "bold", C.bad);
      const label = "CONFIDENTIAL";
      const w = this.spacedWidth(label, 0.3) + 4.8;
      this.doc.setDrawColor(...C.bad);
      this.doc.setLineWidth(0.3);
      this.doc.rect(W - M - w, 35.5, w, 5.2, "S");
      this.text(label, W - M - w / 2, 36.8, { align: "center", charSpace: 0.3 });
    }
  }

  private drawRunningHeader() {
    const { M, W } = this;
    // Sized to the two text lines beside it, as on the letterhead.
    this.drawLogo(M, 8, 6.6);
    this.font(8.6, "bold", C.navy);
    this.text(this.ctx.orgName.toUpperCase(), M + 9.4, 7.8, { charSpace: 0.25 });
    this.font(7.8, "normal", C.ink);
    this.text(this.meta.title, M + 9.4, 12.4);
    this.font(7.2, "normal", C.muted);
    this.text(this.meta.subtitle, W - M, 7.8, { align: "right" });
    this.text(this.ref, W - M, 12.4, { align: "right" });
    this.doc.setDrawColor(...C.navy);
    this.doc.setLineWidth(0.4);
    this.doc.line(M, 20.2, W - M, 20.2);
    this.doc.setDrawColor(...C.gold);
    this.doc.setLineWidth(0.25);
    this.doc.line(M, 21, W - M, 21);
  }

  private drawFooter(page: number, pages: number) {
    const { M, W, H } = this;
    this.doc.setDrawColor(...C.rule);
    this.doc.setLineWidth(0.2);
    this.doc.line(M, H - 12.5, W - M, H - 12.5);
    this.font(6.5, "normal", C.muted);
    const left = `Computer-generated by MSO from the records of ${this.ctx.orgName}  |  ${this.ref}`;
    this.text(this.meta.confidential ? `${left}  |  CONFIDENTIAL` : left, M, H - 10.4);
    this.font(6.8, "bold", C.ink);
    this.text(`Page ${page} of ${pages}`, W - M, H - 10.4, { align: "right" });
  }

  finalize() {
    const pages = this.doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      this.doc.setPage(i);
      if (i === 1) this.drawLetterhead();
      else this.drawRunningHeader();
      this.drawFooter(i, pages);
    }
    return this.doc;
  }
}

// ───────────────────────── Shared helpers ─────────────────────────

const periodLong = (r: Report, p: ReportPeriod) =>
  p.from ? `For the period from ${r.long(p.from)} to ${r.long(p.to)}` : `For the period from inception to ${r.long(p.to)}`;

/** A distribution's reserve share as a percentage (one decimal). */
const shareOf = (d: { totalProfit: number; reserveAllocation: number }) =>
  d.totalProfit > 0 ? Math.round((Number(d.reserveAllocation) / Number(d.totalProfit)) * 1000) / 10 : 0;
const pctText = (n: number) => `${Math.round(n * 10) / 10}%`;

/** How the reserve's share of bank profit reads in the policy notes: one figure while every
 *  distribution used the same share, otherwise the share set at each (with today's setting). */
function reserveShareWords(books: Books, current: number) {
  const shares = [...new Set(books.distributions.map(shareOf))];
  if (shares.length <= 1) {
    const s = shares[0] ?? current;
    return { credited: pctText(s), split: `${pctText(s)} to the reserve fund and ${pctText(100 - s)} to members` };
  }
  const now = `currently ${pctText(current)}`;
  return {
    credited: `a share, set when each distribution is made (${now}),`,
    split: `a share set when each distribution is made (${now}) to the reserve fund and the rest to members`,
  };
}

const loanStatus = (pos: LoanPosition) =>
  pos.state === "paid" ? "Repaid" : pos.state === "defaulted" ? "Defaulted" : pos.daysPastDue > 0 ? "Overdue" : "Current";

const bfRow = (cols: number, label: string, date: string, balance: number, balanceCol: number): RowInput => {
  const cells: CellDef[] = Array.from({ length: cols }, () => ({ content: "" }));
  cells[0] = { content: date };
  cells[2] = { content: label };
  cells[balanceCol] = { content: money(balance) };
  return cells.map((c) => ({ ...c, styles: { fontStyle: "bold", fillColor: C.band } }));
};

function portfolio(books: Books, asAt: string) {
  const positions = books.loans.map((l) => books.loanPositionAt(l, asAt)).filter((p): p is LoanPosition => !!p);
  const open = positions.filter((p) => p.state !== "paid");
  const principal = sumOf(open, (p) => p.principalOutstanding);
  const buckets = (Object.keys(AGING_LABELS) as AgingBucket[]).map((b) => {
    const ps = open.filter((p) => p.bucket === b);
    const bp = sumOf(ps, (p) => p.principalOutstanding);
    return {
      bucket: b,
      label: AGING_LABELS[b],
      count: ps.length,
      principal: bp,
      gross: sumOf(ps, (p) => p.outstanding),
      arrears: sumOf(ps, (p) => p.arrears),
      share: principal > 0 ? bp / principal : null,
      allowance: b === "defaulted" ? bp : 0,
    };
  });
  const atRisk = (minDays: number) => sumOf(open.filter((p) => p.state === "defaulted" || p.daysPastDue >= minDays), (p) => p.principalOutstanding);
  const par = [
    { label: "PAR > 0 days (past due date)", amount: atRisk(1) },
    { label: "PAR > 30 days", amount: atRisk(31) },
    { label: "PAR > 90 days", amount: atRisk(91) },
  ].map((x) => ({ ...x, ratio: principal > 0 ? x.amount / principal : null }));
  return { positions, open, principal, gross: sumOf(open, (p) => p.outstanding), arrears: sumOf(open, (p) => p.arrears), buckets, par };
}

function agingTable(r: Report, pf: ReturnType<typeof portfolio>, cur: string) {
  r.table({
    head: ["Classification", "Loans", `Principal outstanding (${cur})`, "% of portfolio", `Gross outstanding (${cur})`, `Arrears (${cur})`, `Allowance (${cur})`],
    align: ["l", "r", "r", "r", "r", "r", "r"],
    widths: ["auto", 14, 32, 22, 30, 26, 26],
    body: pf.buckets.map((b) => [b.label, String(b.count), money(b.principal), pct(b.share, 1), money(b.gross), money(b.arrears), money(b.allowance)]),
    foot: [["Total loan portfolio", String(pf.open.length), money(pf.principal), pf.principal > 0 ? "100.0%" : "-", money(pf.gross), money(pf.arrears), money(sumOf(pf.buckets, (b) => b.allowance))]],
  });
}

// ───────────────────────── Reports ─────────────────────────

function financialStatements(r: Report, books: Books, p: ReportPeriod) {
  const cur = r.ctx.currency;
  const open = openingDate(p);
  const comparative = open !== null && books.firstActivity !== null && books.firstActivity <= open;
  const cb = books.balancesAt(p.to);
  const ob = books.balancesAt(open);
  const mv = books.movements(p);
  const toHead = `As at\n${r.d(p.to)}`;
  const openHead = open ? `As at\n${r.d(open)}` : "Opening";
  const vals = (a: number, b: number) => (comparative ? [a, b] : [a]);
  const headers = comparative ? [toHead, openHead] : [toHead];
  const openLabel = open ? `Balance as at ${r.d(open)}` : "Balance at inception";
  const closeLabel = `Balance as at ${r.d(p.to)}`;

  // Statement of Financial Position
  r.statementTitle("Statement of Financial Position", `As at ${r.long(p.to)}`);
  r.statement(
    [
      { t: "section", label: "Assets" },
      { t: "item", label: "Cash and cash equivalents", note: "3", v: vals(cb.cash, ob.cash) },
      { t: "item", label: "Loans to members - net of allowance", note: "4", v: vals(cb.netLoans, ob.netLoans) },
      { t: "total", label: "Total assets", v: vals(cb.totalAssets, ob.totalAssets) },
      { t: "section", label: "Members' funds and reserves" },
      { t: "item", label: "Members' savings accounts", note: "5", v: vals(cb.savings, ob.savings) },
      { t: "item", label: "Reserve fund (restricted)", note: "6", v: vals(cb.reserve, ob.reserve) },
      { t: "item", label: cb.surplus < 0 ? "Accumulated deficit" : "Accumulated surplus", note: "7", v: vals(cb.surplus, ob.surplus) },
      { t: "sub", label: "Total members' funds and reserves", v: vals(cb.totalFunds, ob.totalFunds) },
      { t: "section", label: "Liabilities" },
      { t: "item", label: "No liabilities recorded", v: vals(0, 0) },
      { t: "total", label: "Total funds and liabilities", v: vals(cb.totalFunds, ob.totalFunds) },
    ],
    headers,
    { note: true },
  );
  r.note("The accompanying notes 1 to 8 and Schedule A form an integral part of these financial statements.");

  // Statement of Income and Expenditure
  r.newPage();
  r.statementTitle("Statement of Income and Expenditure", periodLong(r, p));
  const loanIncome = r2(mv.interestIncome + mv.penaltyIncome);
  const genSurplus = r2(loanIncome + mv.bankProfit - mv.impairment);
  const resSurplus = r2(mv.donations - mv.expenses);
  r.statement(
    [
      { t: "section", label: "Income" },
      { t: "item", label: "Interest on loans to members", note: "2.1", v: [mv.interestIncome, null, mv.interestIncome] },
      { t: "item", label: "Late payment penalties on loans", note: "2.1", v: [mv.penaltyIncome, null, mv.penaltyIncome] },
      { t: "item", label: "Bank profit on funds held in the account", note: "2.5", v: [mv.bankProfit, null, mv.bankProfit] },
      { t: "item", label: "Donations received", note: "6", v: [null, mv.donations, mv.donations] },
      { t: "sub", label: "Total income", v: [r2(loanIncome + mv.bankProfit), mv.donations, r2(loanIncome + mv.bankProfit + mv.donations)] },
      { t: "section", label: "Expenditure" },
      { t: "item", label: "Expenses charged to reserve fund", note: "6", v: [null, mv.expenses, mv.expenses] },
      { t: "item", label: mv.impairment < 0 ? "Reversal of impairment on loans" : "Impairment loss on loans", note: "4", v: [mv.impairment, null, mv.impairment] },
      { t: "sub", label: "Total expenditure", v: [mv.impairment, mv.expenses, r2(mv.impairment + mv.expenses)] },
      { t: "gap" },
      { t: "total", label: "Surplus / (deficit) for the period", v: [genSurplus, resSurplus, r2(genSurplus + resSurplus)] },
    ],
    ["General fund", "Reserve fund", "Total"],
    { note: true },
  );
  r.note(
    "Bank profit shared with members and the reserve fund is an appropriation of surplus, not an expense. It is presented in the Statement of Changes in Members' Funds and Reserves.",
  );

  // Statement of Changes in Funds
  r.gap(4);
  r.statementTitle("Statement of Changes in Members' Funds and Reserves", periodLong(r, p));
  const row = (label: string, s: number | null, res: number | null, sur: number | null, t: "item" | "total" = "item", bold = false): Line => {
    const v = [s, res, sur, r2((s ?? 0) + (res ?? 0) + (sur ?? 0))];
    return t === "item" ? { t, label, v, bold } : { t, label, v };
  };
  r.statement(
    [
      row(openLabel, ob.savings, ob.reserve, ob.surplus, "item", true),
      row("Contributions received from members", mv.contributions, null, null),
      row("Surplus / (deficit) for the period", null, resSurplus, genSurplus),
      row("Bank profit credited to members", mv.profitToMembers, null, -mv.profitToMembers),
      row("Bank profit credited to reserve fund", null, mv.profitToReserve, -mv.profitToReserve),
      row(closeLabel, cb.savings, cb.reserve, cb.surplus, "total"),
    ],
    ["Members'\nsavings", "Reserve\nfund", "Accumulated\nsurplus", "Total"],
  );

  // Statement of Cash Flows
  r.newPage();
  r.statementTitle("Statement of Cash Flows", periodLong(r, p));
  const opNet = r2(mv.interestIncome + mv.penaltyIncome + mv.bankProfit + mv.donations - mv.expenses - mv.disbursements + mv.principalRepaid);
  const netChange = r2(opNet + mv.contributions);
  r.statement(
    [
      { t: "section", label: "Cash flows from operating activities" },
      { t: "item", label: "Interest received on loans", v: [mv.interestIncome] },
      { t: "item", label: "Late payment penalties received", v: [mv.penaltyIncome] },
      { t: "item", label: "Bank profit received", v: [mv.bankProfit] },
      { t: "item", label: "Donations received for reserve fund", v: [mv.donations] },
      { t: "item", label: "Reserve fund expenses paid", v: [-mv.expenses] },
      { t: "item", label: "Loans disbursed to members", v: [-mv.disbursements] },
      { t: "item", label: "Loan principal repaid by members", v: [mv.principalRepaid] },
      { t: "sub", label: "Net cash from / (used in) operating activities", v: [opNet] },
      { t: "section", label: "Cash flows from financing activities" },
      { t: "item", label: "Contributions received from members", v: [mv.contributions] },
      { t: "sub", label: "Net cash from financing activities", v: [mv.contributions] },
      { t: "gap" },
      { t: "sub", label: "Net increase / (decrease) in cash and cash equivalents", v: [netChange] },
      { t: "item", label: "Cash and cash equivalents at beginning of period", v: [ob.cash] },
      { t: "total", label: "Cash and cash equivalents at end of period", v: [r2(ob.cash + netChange)] },
    ],
    [rangeText(r.d, p)],
    { valueWidth: 44 },
  );
  r.note(
    "Prepared using the direct method. Lending to members is the scheme's principal activity and is therefore classified as operating; member contributions are classified as financing.",
  );

  // Notes
  r.newPage();
  r.statementTitle("Notes to the Financial Statements", periodLong(r, p));
  r.subheading("1. Reporting entity and basis of preparation");
  r.paragraph(
    `${r.ctx.orgName} ("MSO") operates a savings and loan scheme for its members. These financial statements are prepared from the transaction records maintained in MSO on a modified cash basis: receipts and payments are recognised when they occur, loans to members are carried as assets net of an allowance for impairment, and interest is recognised when received. Fund accounting is applied, so members' savings, the restricted reserve fund and the general accumulated surplus are reported separately. Amounts are in ${cur === "PKR" ? "Pakistani Rupees (PKR)" : cur} under the historical cost convention.`,
  );
  r.subheading("2. Significant accounting policies");
  const shareWords = reserveShareWords(books, r.ctx.reserveSharePercent);
  const policies: Array<[string, string]> = [
    ["2.1 Interest and late penalties on loans", "Loans are issued for one year with a flat interest charge fixed when the loan is issued, and may be repaid in monthly instalments or as a lump sum within the year. Interest is recognised as income only when received: each repayment is apportioned between principal and interest in the proportion that the loan's principal bears to its total payable amount. Interest not yet received is unearned and is excluded from both income and assets. A late payment penalty, fixed per month when the loan is issued, is charged for each full month the loan remains unpaid after its due date. Repayments settle the loan's total payable before any penalties, and penalties are likewise recognised as income only when received."],
    ["2.2 Loans to members and impairment", "Loans are stated at principal outstanding less an allowance for impairment. Loans flagged as defaulted are provided for in full. Loans are aged by the number of days since their one-year due date; instalments missed within the year are not treated as arrears, as the loan may be repaid as a lump sum."],
    ["2.3 Members' savings", "Members' savings comprise contributions received and profit shares credited to each member's account. Individual balances are set out in Schedule A."],
    ["2.4 Reserve fund", `The reserve fund is a restricted fund. It is credited with donations and with ${shareWords.credited} of each year's bank profit, and charged with expenses approved against it.`],
    ["2.5 Bank profit and its distribution", `The profit paid by the bank on the funds held in the organisation's account is recognised as income when it is distributed, and is shared in full: ${shareWords.split} in proportion to their total contributions. Interest on loans to members is not part of this distribution and remains in the accumulated surplus.`],
    ["2.6 Cash and cash equivalents", "Cash and cash equivalents represent the net of all recorded receipts and payments. The records do not separate cash in hand from bank balances, so this balance should be agreed to a physical cash count and bank statements at each reporting date."],
  ];
  for (const [h, body] of policies) {
    r.paragraph(h, { style: "bold", size: 8, after: 0.6 });
    r.paragraph(body, { indent: 4, after: 2.2 });
  }

  const allTo = { from: null, to: p.to };
  const allOpen = open ? { from: null, to: open } : null;
  r.subheading("3. Cash and cash equivalents");
  const rcTo = books.movements(allTo);
  const rcOpen = allOpen ? books.movements(allOpen) : null;
  r.statement(
    [
      { t: "item", label: "Total receipts recorded since inception", v: vals(rcTo.cashIn, rcOpen?.cashIn ?? 0) },
      { t: "item", label: "Less: total payments recorded since inception", v: vals(-rcTo.cashOut, -(rcOpen?.cashOut ?? 0)) },
      { t: "total", label: "Cash and cash equivalents", v: vals(cb.cash, ob.cash) },
    ],
    headers,
  );

  r.subheading("4. Loans to members");
  const pfTo = portfolio(books, p.to);
  const pfOpen = open ? portfolio(books, open) : null;
  r.statement(
    [
      { t: "item", label: "Gross loans outstanding (principal, unearned interest and penalties)", v: vals(pfTo.gross, pfOpen?.gross ?? 0) },
      { t: "item", label: "Less: unearned interest and uncollected penalties", v: vals(-r2(pfTo.gross - pfTo.principal), -r2((pfOpen?.gross ?? 0) - (pfOpen?.principal ?? 0))) },
      { t: "sub", label: "Principal outstanding", v: vals(cb.loansPrincipal, ob.loansPrincipal) },
      { t: "item", label: "Less: allowance for impairment on defaulted loans", v: vals(-cb.allowance, -ob.allowance) },
      { t: "total", label: "Loans to members - net", v: vals(cb.netLoans, ob.netLoans) },
    ],
    headers,
  );
  r.ensure(62);
  r.paragraph(`Ageing of the loan portfolio as at ${r.d(p.to)}:`, { size: 7.8, color: C.muted, after: 1.2 });
  agingTable(r, pfTo, cur);

  r.subheading("5. Members' savings accounts");
  r.statement(
    [
      { t: "item", label: openLabel, v: [ob.savings] },
      { t: "item", label: "Contributions received", v: [mv.contributions] },
      { t: "item", label: "Bank profit shares credited", v: [mv.profitToMembers] },
      { t: "total", label: `${closeLabel} (Schedule A)`, v: [cb.savings] },
    ],
    [cur],
  );

  r.subheading("6. Reserve fund (restricted)");
  r.statement(
    [
      { t: "item", label: openLabel, v: [ob.reserve] },
      { t: "item", label: "Donations received", v: [mv.donations] },
      { t: "item", label: "Share of bank profit", v: [mv.profitToReserve] },
      { t: "item", label: "Expenses charged to the fund", v: [-mv.expenses] },
      { t: "total", label: closeLabel, v: [cb.reserve] },
    ],
    [cur],
  );

  r.subheading("7. Accumulated surplus / (deficit)");
  r.statement(
    [
      { t: "item", label: openLabel, v: [ob.surplus] },
      { t: "item", label: "Interest income on loans", v: [mv.interestIncome] },
      { t: "item", label: "Late payment penalties received", v: [mv.penaltyIncome] },
      { t: "item", label: "Impairment (loss) / reversal on loans", v: [-mv.impairment] },
      { t: "item", label: "Bank profit received", v: [mv.bankProfit] },
      { t: "item", label: "Bank profit credited to members", v: [-mv.profitToMembers] },
      { t: "item", label: "Bank profit credited to reserve fund", v: [-mv.profitToReserve] },
      { t: "total", label: closeLabel, v: [cb.surplus] },
    ],
    [cur],
  );
  if (cb.surplus < -EPS) {
    const life = books.movements(allTo);
    r.note(
      `The accumulated deficit arises because the impairment allowance on defaulted loans (${amt(cur, cb.allowance)}) exceeds the income retained to date (${amt(cur, r2(life.interestIncome + life.penaltyIncome + life.bankProfit - life.profitToMembers - life.profitToReserve))}), being loan interest and penalties received plus any bank profit not distributed.`,
    );
  }

  r.subheading("8. Record control checks");
  const checks = books.controls(p.to);
  r.table({
    head: ["Control", `Expected (${cur})`, `Recorded (${cur})`, `Difference (${cur})`, "Result"],
    align: ["l", "r", "r", "r", "c"],
    widths: ["auto", 26, 26, 24, 21],
    body: checks.map((c) => [
      c.note && !c.ok ? `${c.label}\n${c.note}` : c.label,
      money(c.expected),
      money(c.actual),
      money(c.difference),
      { content: c.ok ? "Agreed" : "Investigate", styles: { fontStyle: "bold", textColor: c.ok ? C.good : C.bad } },
    ]),
    doubleRule: false,
  });

  // Schedule A
  r.newPage();
  r.heading(`Schedule A - Members' savings accounts as at ${r.d(p.to)}`);
  const listed = books.members.filter((m) => m.joinDate <= p.to || Math.abs(books.memberSavingsAt(m.dbId, p.to)) > EPS);
  const schedRows = listed.map((m) => {
    const opening = books.memberSavingsAt(m.dbId, open);
    const es = entriesInPeriod(books, p).filter((e) => e.memberId === m.dbId);
    const contrib = sumOf(es.filter((e) => e.kind === "contribution"), (e) => e.amount);
    const profit = sumOf(es.filter((e) => e.kind === "profit_member"), (e) => e.amount);
    const closing = r2(opening + contrib + profit);
    return { m, opening, contrib, profit, closing };
  });
  r.table({
    head: ["No.", "Member", `Opening (${cur})`, `Contributions (${cur})`, `Profit share (${cur})`, `Closing (${cur})`, "Share"],
    align: ["l", "l", "r", "r", "r", "r", "r"],
    widths: [15, "auto", 26, 28, 26, 27, 15],
    body: schedRows.map((x) => [x.m.memberNo, x.m.name, money(x.opening), money(x.contrib), money(x.profit), money(x.closing), pct(cb.savings > 0 ? x.closing / cb.savings : null, 1)]),
    foot: [["", "Total members' savings", money(sumOf(schedRows, (x) => x.opening)), money(sumOf(schedRows, (x) => x.contrib)), money(sumOf(schedRows, (x) => x.profit)), money(sumOf(schedRows, (x) => x.closing)), cb.savings > 0 ? "100.0%" : "-"]],
    empty: "No members recorded.",
  });

  r.heading("Approval of the financial statements", 60);
  r.signatures(
    ["Prepared by - Treasurer", "Reviewed by - Accounts Committee", "Approved by - President"],
    `These financial statements were approved by the Executive Committee of ${r.ctx.orgName} on ____________________ and signed on its behalf by:`,
  );
}

function trialBalance(r: Report, books: Books, p: ReportPeriod) {
  const cur = r.ctx.currency;
  const open = openingDate(p);
  const cb = books.balancesAt(p.to);
  const ob = books.balancesAt(open);
  const mv = books.movements(p);
  type Acc = { code: string; name: string; side: "Dr" | "Cr"; v: number };
  const accounts: Acc[] = [
    { code: "1000", name: "Cash and cash equivalents", side: "Dr", v: cb.cash },
    { code: "1100", name: "Loans to members - principal", side: "Dr", v: cb.loansPrincipal },
    { code: "1190", name: "Allowance for loan impairment", side: "Cr", v: cb.allowance },
    { code: "2000", name: "Members' savings accounts (closing)", side: "Cr", v: cb.savings },
    { code: "3000", name: open ? `Reserve fund - balance b/f at ${r.d(open)}` : "Reserve fund - balance b/f", side: "Cr", v: ob.reserve },
    { code: "3010", name: "Reserve fund - share of bank profit", side: "Cr", v: mv.profitToReserve },
    { code: "3100", name: open ? `Accumulated surplus - balance b/f at ${r.d(open)}` : "Accumulated surplus - balance b/f", side: "Cr", v: ob.surplus },
    { code: "4000", name: "Interest income on loans", side: "Cr", v: mv.interestIncome },
    { code: "4010", name: "Late payment penalties on loans", side: "Cr", v: mv.penaltyIncome },
    { code: "4100", name: "Donations received (reserve fund)", side: "Cr", v: mv.donations },
    { code: "4200", name: "Bank profit received", side: "Cr", v: mv.bankProfit },
    { code: "5000", name: "Reserve fund expenses", side: "Dr", v: mv.expenses },
    { code: "5100", name: "Impairment loss on loans", side: "Dr", v: mv.impairment },
    { code: "6000", name: "Bank profit credited to members", side: "Dr", v: mv.profitToMembers },
    { code: "6010", name: "Bank profit credited to reserve fund", side: "Dr", v: mv.profitToReserve },
  ];
  const rows = accounts.map((a) => {
    // A negative balance sits on the opposite side (e.g. an accumulated deficit is a debit).
    const dr = (a.side === "Dr" && a.v >= 0) || (a.side === "Cr" && a.v < 0) ? Math.abs(a.v) : 0;
    const cr = (a.side === "Cr" && a.v >= 0) || (a.side === "Dr" && a.v < 0) ? Math.abs(a.v) : 0;
    return { ...a, dr: r2(dr), cr: r2(cr) };
  });
  const totDr = sumOf(rows, (x) => x.dr);
  const totCr = sumOf(rows, (x) => x.cr);
  r.infoGrid([
    ["Balances as at", r.d(p.to)],
    ["Income & expense period", rangeText(r.d, p)],
    ["Result", Math.abs(totDr - totCr) < 0.01 ? "Debits equal credits" : `Out of balance by ${money(totDr - totCr)}`],
  ]);
  r.table({
    head: ["Code", "Account", `Debit (${cur})`, `Credit (${cur})`],
    align: ["l", "l", "r", "r"],
    widths: [16, "auto", 36, 36],
    fontSize: 8.2,
    body: rows.map((x) => [x.code, x.name, money(x.dr), money(x.cr)]),
    foot: [["", "Totals", money(totDr), money(totCr)]],
  });
  r.ensure(50);
  r.note(
    "Balance-sheet accounts (1000-2000) show closing balances; reserve fund and accumulated surplus are shown at their opening balances with the period's movements listed separately (3010, 4000-6010), so the trial balance agrees before closing entries.",
  );
  r.signatures(["Prepared by - Treasurer", "Checked by"]);
}

function cashBook(r: Report, books: Books, p: ReportPeriod) {
  const cur = r.ctx.currency;
  const open = openingDate(p);
  const opening = books.balancesAt(open).cash;
  const es = entriesInPeriod(books, p).filter((e) => e.cashIn > 0 || e.cashOut > 0);
  let bal = opening;
  const body: RowInput[] = [bfRow(7, open ? "Balance brought forward" : "Opening balance (inception)", r.d(p.from ?? es[0]?.date ?? p.to), opening, 6)];
  for (const e of es) {
    bal = r2(bal + e.cashIn - e.cashOut);
    const particulars = e.kind === "donation" || e.kind === "expense" ? (e.detail ? `${KIND_LABELS[e.kind]} - ${e.detail}` : KIND_LABELS[e.kind]) : e.particulars;
    body.push([r.d(e.date), e.voucher, particulars, e.memberName ? `${e.memberNo ?? ""} ${e.memberName}`.trim() : "-", money(e.cashIn), money(e.cashOut), money(bal)]);
  }
  const rec = sumOf(es, (e) => e.cashIn);
  const pay = sumOf(es, (e) => e.cashOut);
  r.kpis([
    { label: "Opening balance", value: amt(cur, opening) },
    { label: "Receipts", value: amt(cur, rec), sub: `${es.filter((e) => e.cashIn > 0).length} receipt vouchers`, tone: "good" },
    { label: "Payments", value: amt(cur, pay), sub: `${es.filter((e) => e.cashOut > 0).length} payment vouchers`, tone: "bad" },
    { label: "Closing balance", value: amt(cur, bal) },
  ]);
  r.table({
    head: ["Date", "Voucher", "Particulars", "Member", `Receipts (${cur})`, `Payments (${cur})`, `Balance (${cur})`],
    align: ["l", "l", "l", "l", "r", "r", "r"],
    widths: [20, 22, "auto", 55, 30, 30, 32],
    body,
    foot: [["", "", "Totals / balance carried forward", "", money(rec), money(pay), money(bal)]],
  });

  r.heading("Summary by transaction type");
  const by = (k: LedgerEntry["kind"], pick: (e: LedgerEntry) => number = (e) => e.amount) => sumOf(es.filter((e) => e.kind === k), pick);
  r.table({
    head: ["Transaction type", "Vouchers", `Receipts (${cur})`, `Payments (${cur})`],
    align: ["l", "r", "r", "r"],
    widths: ["auto", 22, 36, 36],
    body: [
      [KIND_LABELS.contribution, String(es.filter((e) => e.kind === "contribution").length), money(by("contribution")), "-"],
      ["Loan repayments - principal", String(es.filter((e) => e.kind === "repayment").length), money(by("repayment", (e) => e.principal)), "-"],
      ["Loan repayments - interest", "", money(by("repayment", (e) => e.interest)), "-"],
      ["Loan repayments - late penalties", "", money(by("repayment", (e) => e.penalty)), "-"],
      [KIND_LABELS.donation, String(es.filter((e) => e.kind === "donation").length), money(by("donation")), "-"],
      [KIND_LABELS.bank_profit, String(es.filter((e) => e.kind === "bank_profit").length), money(by("bank_profit")), "-"],
      [KIND_LABELS.disbursement, String(es.filter((e) => e.kind === "disbursement").length), "-", money(by("disbursement"))],
      [KIND_LABELS.expense, String(es.filter((e) => e.kind === "expense").length), "-", money(by("expense"))],
    ],
    foot: [["Total", String(es.length), money(rec), money(pay)]],
  });
  r.ensure(50);
  r.note(
    "Voucher series: RV = receipt voucher, PV = payment voucher. Bank profit is shown as received when it is distributed; crediting it to members and the reserve fund is a journal entry (JV) and does not appear here. Reconcile the closing balance with cash in hand and bank statements before approval.",
  );
  r.signatures(["Prepared by - Treasurer", "Verified by"]);
}

function memberStatement(r: Report, books: Books, p: ReportPeriod, memberId: string) {
  const cur = r.ctx.currency;
  const m = books.memberById.get(memberId);
  if (!m) throw new Error("Member not found");
  const open = openingDate(p);
  const es = entriesInPeriod(books, p).filter((e) => e.memberId === m.dbId);
  const openingSavings = books.memberSavingsAt(m.dbId, open);
  const closingSavings = books.memberSavingsAt(m.dbId, p.to);
  const openingOwed = books.memberLoanOwedAt(m.dbId, open);
  const closingOwed = books.memberLoanOwedAt(m.dbId, p.to);
  const totalSavings = books.balancesAt(p.to).savings;

  r.infoGrid([
    ["Member no.", m.memberNo],
    ["Member name", m.name],
    ["Father's name", m.fatherName],
    ["Phone", m.phone],
    ["Email", m.email],
    ["Member since", r.d(m.joinDate)],
    ["Address", m.address],
    ["Statement period", rangeText(r.d, p)],
    ["Statement date", r.d(p.to)],
  ]);
  r.kpis([
    { label: "Savings balance", value: amt(cur, closingSavings), sub: `as at ${r.d(p.to)}` },
    { label: "Loan balance owed", value: amt(cur, closingOwed), sub: "principal, interest and penalties due", tone: closingOwed > EPS ? "bad" : undefined },
    { label: "Net position", value: amt(cur, r2(closingSavings - closingOwed)), sub: "savings less loan owed", tone: closingSavings - closingOwed >= 0 ? "good" : "bad" },
    { label: "Share of members' fund", value: pct(totalSavings > 0 ? closingSavings / totalSavings : null), sub: "basis for profit sharing" },
  ]);

  r.heading("Savings account");
  let bal = openingSavings;
  const savingsRows: RowInput[] = [bfRow(6, open ? "Balance brought forward" : "Opening balance", r.d(p.from ?? m.joinDate), openingSavings, 5)];
  const savingsEntries = es.filter((e) => e.kind === "contribution" || e.kind === "profit_member");
  for (const e of savingsEntries) {
    bal = r2(bal + e.amount);
    savingsRows.push([r.d(e.date), e.voucher, e.kind === "contribution" ? "Contribution received" : e.particulars, "-", money(e.amount), money(bal)]);
  }
  r.table({
    head: ["Date", "Voucher", "Particulars", `Debit (${cur})`, `Credit (${cur})`, `Balance (${cur})`],
    align: ["l", "l", "l", "r", "r", "r"],
    widths: [20, 22, "auto", 26, 26, 30],
    body: savingsRows,
    foot: [["", "", "Totals / closing balance", "-", money(sumOf(savingsEntries, (e) => e.amount)), money(closingSavings)]],
  });

  r.heading("Loan account");
  const memberLoans = books.loans.filter((l) => l.memberId === m.dbId);
  type LoanLine = { date: string; order: number; voucher: string; text: string; dr: number; cr: number };
  const loanLines: LoanLine[] = [];
  for (const l of memberLoans) {
    if (l.date >= (p.from ?? "0000-00-00") && l.date <= p.to) {
      loanLines.push({ date: l.date, order: 0, voucher: l.disbursementVoucher, text: `Loan ${l.loanNo} disbursed`, dr: l.principal, cr: 0 });
      if (l.interest > EPS) loanLines.push({ date: l.date, order: 1, voucher: l.loanNo, text: `Interest charged @ ${l.interestRate}% flat on ${l.loanNo}`, dr: l.interest, cr: 0 });
    }
    for (const pen of l.penalties) {
      if (pen.date >= (p.from ?? "0000-00-00") && pen.date <= p.to) {
        loanLines.push({ date: pen.date, order: 1, voucher: l.loanNo, text: `Late payment penalty - month ${pen.month} past due on ${l.loanNo}`, dr: pen.amount, cr: 0 });
      }
    }
    for (const rc of l.receipts) {
      if (rc.date >= (p.from ?? "0000-00-00") && rc.date <= p.to) {
        loanLines.push({ date: rc.date, order: 2, voucher: rc.voucher, text: rc.itemised ? `Repayment - ${l.loanNo}` : `Repayment b/f (not itemised) - ${l.loanNo}`, dr: 0, cr: rc.amount });
      }
    }
  }
  loanLines.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order || a.voucher.localeCompare(b.voucher));
  let owed = openingOwed;
  const loanRows: RowInput[] = [bfRow(6, open ? "Balance brought forward" : "Opening balance", r.d(p.from ?? m.joinDate), openingOwed, 5)];
  for (const ln of loanLines) {
    owed = r2(owed + ln.dr - ln.cr);
    loanRows.push([r.d(ln.date), ln.voucher, ln.text, money(ln.dr), money(ln.cr), money(owed)]);
  }
  r.table({
    head: ["Date", "Voucher", "Particulars", `Debit (${cur})`, `Credit (${cur})`, `Balance owed (${cur})`],
    align: ["l", "l", "l", "r", "r", "r"],
    widths: [20, 22, "auto", 26, 26, 30],
    body: loanRows,
    foot: [["", "", "Totals / closing balance", money(sumOf(loanLines, (x) => x.dr)), money(sumOf(loanLines, (x) => x.cr)), money(closingOwed)]],
  });

  const positions = memberLoans.map((l) => books.loanPositionAt(l, p.to)).filter((x): x is LoanPosition => !!x);
  if (positions.length) {
    r.subheading("Loans summary");
    r.table({
      head: ["Loan no.", "Disbursed", `Principal (${cur})`, "Rate", `Total payable (${cur})`, `Repaid (${cur})`, `Outstanding (${cur})`, "Next due", "Status"],
      align: ["l", "l", "r", "r", "r", "r", "r", "l", "l"],
      widths: [18, 19, 22, 12, 24, 22, 24, "auto", 17],
      fontSize: 7.4,
      body: positions.map((x) => [
        x.loan.loanNo,
        r.d(x.loan.date),
        money(x.loan.principal),
        `${x.loan.interestRate}%`,
        money(x.loan.totalPayable),
        money(x.repaid),
        money(x.outstanding),
        x.nextDueDate ? `${r.d(x.nextDueDate)} (${money(x.nextDueAmount)})` : "-",
        loanStatus(x),
      ]),
    });
  }

  const att = books.attendanceSummary(p).find((a) => a.member.dbId === m.dbId);
  if (att && att.eligible > 0) {
    r.paragraph(`Meeting attendance in the period: present at ${att.present} of ${att.eligible} recorded meetings (${pct(att.rate, 0)}).`, { size: 7.8 });
  }
  r.gap(2);
  r.note(
    "Please examine this statement. Any discrepancy should be reported in writing to the Treasurer within 15 days of issue; otherwise the balances shown will be taken as confirmed. Loan balances include flat interest charged at disbursement and any late payment penalties charged after a loan's one-year due date.",
  );
}

function memberRegister(r: Report, books: Books, p: ReportPeriod) {
  const cur = r.ctx.currency;
  const listed = books.members.filter((m) => m.joinDate <= p.to);
  const rows = listed.map((m) => ({ m, savings: books.memberSavingsAt(m.dbId, p.to), owed: books.memberLoanOwedAt(m.dbId, p.to) }));
  const admittedInPeriod = p.from ? listed.filter((m) => m.joinDate >= p.from!).length : listed.length;
  r.kpis([
    { label: "Members on register", value: String(listed.length), sub: `as at ${r.d(p.to)}` },
    { label: "Admitted in period", value: String(admittedInPeriod), sub: rangeText(r.d, p) },
    { label: "Members' savings", value: amt(cur, sumOf(rows, (x) => x.savings)) },
    { label: "Loans owed by members", value: amt(cur, sumOf(rows, (x) => x.owed)), sub: `${rows.filter((x) => x.owed > EPS).length} member(s) with loans` },
  ]);
  r.table({
    head: ["Reg. no.", "Member name", "Father's name", "Phone", "Email", "Address", "Admitted", `Savings (${cur})`, `Loan owed (${cur})`],
    align: ["l", "l", "l", "l", "l", "l", "l", "r", "r"],
    widths: [15, 36, 32, 25, 42, "auto", 19, 25, 25],
    fontSize: 7.4,
    body: rows.map((x) => [x.m.memberNo, x.m.name, x.m.fatherName || "-", x.m.phone || "-", x.m.email || "-", x.m.address || "-", r.d(x.m.joinDate), money(x.savings), money(x.owed)]),
    foot: [["", `${rows.length} members`, "", "", "", "", "", money(sumOf(rows, (x) => x.savings)), money(sumOf(rows, (x) => x.owed))]],
    empty: "No members on the register at this date.",
  });
  r.note("Register numbers are assigned in order of admission. Savings balances are per the members' ledger; loan balances include flat interest charged at disbursement and any late payment penalties. Personal data in this register must be handled in confidence.");
}

function loanPortfolio(r: Report, books: Books, p: ReportPeriod) {
  const cur = r.ctx.currency;
  const pf = portfolio(books, p.to);
  const par30 = pf.par[1];
  r.kpis([
    { label: "Loans outstanding", value: String(pf.open.length), sub: `${pf.positions.length} loans issued to date` },
    { label: "Principal outstanding", value: amt(cur, pf.principal) },
    { label: "Gross outstanding", value: amt(cur, pf.gross), sub: "incl. unearned interest and penalties" },
    { label: "Arrears", value: amt(cur, pf.arrears), sub: "owed past due date", tone: pf.arrears > EPS ? "bad" : "good" },
    { label: "PAR > 30 days", value: pct(par30.ratio, 1), sub: `${amt(cur, par30.amount)} at risk`, tone: (par30.ratio ?? 0) > 0.05 ? "bad" : "good" },
  ]);
  r.table({
    head: ["Loan no.", "Borrower", "Disbursed", `Principal (${cur})`, "Rate", `Total payable (${cur})`, `Repaid (${cur})`, `Outstanding (${cur})`, `Arrears (${cur})`, "DPD", "Next due", "Status"],
    align: ["l", "l", "l", "r", "r", "r", "r", "r", "r", "r", "l", "l"],
    widths: [17, "auto", 18, 24, 11, 25, 24, 25, 22, 10, 18, 17],
    fontSize: 7.3,
    body: pf.positions.map((x) => [
      x.loan.loanNo,
      `${x.loan.memberNo} ${x.loan.memberName}`,
      r.d(x.loan.date),
      money(x.loan.principal),
      `${x.loan.interestRate}%`,
      money(x.loan.totalPayable),
      money(x.repaid),
      money(x.outstanding),
      money(x.arrears),
      x.daysPastDue > 0 ? String(x.daysPastDue) : "-",
      x.nextDueDate ? r.d(x.nextDueDate) : "-",
      { content: loanStatus(x), styles: { fontStyle: "bold", textColor: x.state === "defaulted" || x.daysPastDue > 0 ? C.bad : x.state === "paid" ? C.muted : C.good } },
    ]),
    foot: [["", `${pf.positions.length} loans`, "", money(sumOf(pf.positions, (x) => x.loan.principal)), "", money(sumOf(pf.positions, (x) => x.loan.totalPayable)), money(sumOf(pf.positions, (x) => x.repaid)), money(sumOf(pf.positions, (x) => x.outstanding)), money(sumOf(pf.positions, (x) => x.arrears)), "", "", ""]],
    empty: "No loans issued as at this date.",
  });

  r.heading("Portfolio quality and ageing", 60);
  agingTable(r, pf, cur);
  r.table({
    head: ["Portfolio at risk (PAR)", `Principal at risk (${cur})`, "Ratio to principal outstanding"],
    align: ["l", "r", "r"],
    widths: ["auto", 40, 48],
    body: pf.par.map((x) => [x.label, money(x.amount), pct(x.ratio)]),
    doubleRule: false,
  });
  r.note(
    "Loans run for one year and may be repaid in instalments or as a lump sum, so a loan is in arrears only once its due date has passed; arrears are then everything still owed, including late payment penalties. DPD = days since the due date. PAR measures principal outstanding on loans past their due date by more than the stated days (defaulted loans always included) as a share of total principal outstanding. Defaulted loans are provided for in full. Repayments are apportioned between principal and interest pro rata to each loan's terms, and anything beyond the total payable is applied to penalties.",
  );
}

function loanStatement(r: Report, books: Books, p: ReportPeriod, loanId: string) {
  const cur = r.ctx.currency;
  const loan = books.loanById.get(loanId);
  if (!loan) throw new Error("Loan not found");
  const asAt = p.to < loan.date ? loan.date : p.to;
  const pos = books.loanPositionAt(loan, asAt)!;
  const perInst = loan.schedule[0]?.dueAmount ?? loan.totalPayable;
  r.infoGrid([
    ["Loan no.", loan.loanNo],
    ["Borrower", `${loan.memberNo} ${loan.memberName}`],
    ["Disbursement date", `${r.d(loan.date)} (${loan.disbursementVoucher})`],
    ["Principal", amt(cur, loan.principal)],
    ["Interest (flat)", `${loan.interestRate}% = ${amt(cur, loan.interest)}`],
    ["Total payable", amt(cur, loan.totalPayable)],
    ["Repayment", `${loan.termMonths} monthly instalment${loan.termMonths === 1 ? "" : "s"} x ${amt(cur, perInst)}, or a lump sum by the due date`],
    ["Due date", r.d(loan.maturityDate)],
    ["Late penalty", loan.penaltyPerMonth > EPS ? `${amt(cur, loan.penaltyPerMonth)} per full month unpaid after the due date` : "None"],
    ["Status", `${loanStatus(pos)}${pos.daysPastDue > 0 ? ` - ${pos.daysPastDue} days past due` : ""}`],
  ]);
  const penaltyLine = (charged: number, other: number, label: string) => (charged > EPS ? `\n${label} ${plain(other)}` : "");
  r.kpis([
    { label: "Repaid to date", value: amt(cur, pos.repaid), sub: `Principal ${plain(pos.principalRepaid)}
Interest ${plain(pos.interestReceived)}${penaltyLine(pos.penaltiesCharged, pos.penaltyReceived, "Penalties")}`, tone: "good" },
    { label: "Outstanding", value: amt(cur, pos.outstanding), sub: `Principal ${plain(pos.principalOutstanding)}
Unearned interest ${plain(pos.unearnedInterest)}${penaltyLine(pos.penaltiesCharged, pos.penaltyOutstanding, "Penalties")}` },
    { label: "Arrears", value: amt(cur, pos.arrears), sub: "owed past due date", tone: pos.arrears > EPS ? "bad" : undefined },
    { label: "Next due", value: pos.nextDueDate ? r.d(pos.nextDueDate) : "-", sub: pos.nextDueDate ? amt(cur, pos.nextDueAmount) : pos.arrears > EPS ? "due date has passed" : "nothing further due" },
  ]);

  r.heading("Repayment schedule");
  r.table({
    head: ["No.", "Due date", `Amount due (${cur})`, `Paid (${cur})`, `Balance due (${cur})`, "Status", "Days overdue"],
    align: ["r", "l", "r", "r", "r", "l", "r"],
    widths: [11, 24, 32, 30, 32, "auto", 22],
    body: pos.schedule.map((s) => [
      String(s.no),
      r.d(s.dueDate),
      money(s.dueAmount),
      money(s.paid),
      money(s.balance),
      { content: s.status, styles: { fontStyle: "bold", textColor: s.status === "Overdue" ? C.bad : s.status === "Paid" ? C.good : C.ink } },
      s.daysOverdue ? String(s.daysOverdue) : "-",
    ]),
    foot: [["", "Total", money(sumOf(pos.schedule, (s) => s.dueAmount)), money(sumOf(pos.schedule, (s) => s.paid)), money(sumOf(pos.schedule, (s) => s.balance)), "", ""]],
  });
  if (loan.scheduleIsDerived) r.note("No instalment plan was stored for this loan; the schedule above is derived from its term using equal monthly instalments.");

  r.heading("Loan account transactions");
  const receipts = loan.receipts.filter((rc) => rc.date <= asAt);
  const charges = loan.penalties.filter((pen) => pen.date <= asAt);
  // The "of which penalty" column only appears once a loan has been charged a penalty.
  const withPenalty = charges.length > 0;
  const pick = <T,>(cells: T[]) => (withPenalty ? cells : [...cells.slice(0, 7), cells[8]]);
  // Penalties charged and receipts in date order; a charge sorts before a receipt on the same day.
  const moves = [
    ...charges.map((pen) => ({ date: pen.date, order: 0, dr: pen.amount, cr: 0, cells: (bal: number) => [r.d(pen.date), loan.loanNo, `Late payment penalty - month ${pen.month} past due`, money(pen.amount), "-", "-", "-", "-", money(bal)] })),
    ...receipts.map((rc) => ({ date: rc.date, order: 1, dr: 0, cr: rc.amount, cells: (bal: number) => [r.d(rc.date), rc.voucher, rc.itemised ? "Repayment received" : "Repayment b/f (not itemised)", "-", money(rc.amount), money(rc.principal), money(rc.interest), money(rc.penalty), money(bal)] })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
  const body: RowInput[] = [
    pick([r.d(loan.date), loan.disbursementVoucher, "Principal disbursed", money(loan.principal), "-", "-", "-", "-", money(loan.principal)]),
  ];
  if (loan.interest > EPS) body.push(pick([r.d(loan.date), loan.loanNo, `Interest charged @ ${loan.interestRate}% flat`, money(loan.interest), "-", "-", "-", "-", money(loan.totalPayable)]));
  let bal = loan.totalPayable;
  for (const mvmt of moves) {
    bal = r2(bal + mvmt.dr - mvmt.cr);
    body.push(pick(mvmt.cells(bal)));
  }
  r.table({
    head: pick(["Date", "Voucher", "Particulars", `Debit (${cur})`, `Credit (${cur})`, "of which principal", "of which interest", "of which penalty", `Balance (${cur})`]),
    align: pick<Align>(["l", "l", "l", "r", "r", "r", "r", "r", "r"]),
    widths: pick<number | "auto">([18, 19, "auto", 21, 21, 20, 19, 19, 22]),
    fontSize: withPenalty ? 7 : 7.3,
    body,
    foot: [pick(["", "", "Totals / balance outstanding", money(r2(loan.totalPayable + pos.penaltiesCharged)), money(pos.repaid), money(pos.principalRepaid), money(pos.interestReceived), money(pos.penaltyReceived), money(pos.outstanding)])],
  });
  r.note(
    `Position as at ${r.d(asAt)}. Each repayment is apportioned between principal and interest in the ratio ${plain(loan.principal)} : ${plain(loan.interest)} (principal : interest); interest is recognised as income only when received.${withPenalty ? " Repayments settle the total payable first; anything beyond it is applied to late payment penalties, which are recognised as income when received." : ""}`,
  );
  if (receipts.some((rc) => !rc.itemised)) {
    r.note("\"Repayment b/f (not itemised)\" is the amount the loan record shows as repaid but for which no individual payments were entered (loans recorded before instalment tracking). It is dated at disbursement.");
  }
}

function contributionRegister(r: Report, books: Books, p: ReportPeriod) {
  const cur = r.ctx.currency;
  const es = entriesInPeriod(books, p).filter((e) => e.kind === "contribution");
  const meetingDate = new Map(books.meetings.map((m) => [m.dbId, m.date]));
  const total = sumOf(es, (e) => e.amount);
  const contributors = new Set(es.map((e) => e.memberId)).size;
  r.kpis([
    { label: "Contributions received", value: amt(cur, total), tone: "good" },
    { label: "Receipts", value: String(es.length) },
    { label: "Contributing members", value: `${contributors} of ${books.members.filter((m) => m.joinDate <= p.to).length}` },
    { label: "Average per receipt", value: amt(cur, es.length ? total / es.length : 0) },
  ]);

  const body: RowInput[] = [];
  let month = "";
  let monthTotal = 0;
  let monthCount = 0;
  const flush = () => {
    if (!month) return;
    body.push([
      { content: `Total for ${format(parseDay(`${month}-01`), "MMMM yyyy")} (${monthCount} receipts)`, colSpan: 5, styles: { fontStyle: "bold", fillColor: C.band } },
      { content: money(monthTotal), styles: { fontStyle: "bold", fillColor: C.band } },
    ]);
  };
  for (const e of es) {
    const m = e.date.slice(0, 7);
    if (m !== month) {
      flush();
      month = m;
      monthTotal = 0;
      monthCount = 0;
    }
    monthTotal = r2(monthTotal + e.amount);
    monthCount++;
    const md = e.meetingId ? meetingDate.get(e.meetingId) : undefined;
    body.push([r.d(e.date), e.voucher, e.memberNo ?? "", e.memberName ?? "", md ? r.d(md) : "-", money(e.amount)]);
  }
  flush();
  r.table({
    head: ["Date", "Voucher", "Member no.", "Member", "Meeting", `Amount (${cur})`],
    align: ["l", "l", "l", "l", "l", "r"],
    widths: [21, 23, 19, "auto", 23, 30],
    body,
    foot: [[{ content: `Grand total (${es.length} receipts)`, colSpan: 5 }, money(total)]],
    empty: "No contributions were received in the selected period.",
  });

  r.heading("Summary by member");
  const rows = books.members
    .filter((m) => m.joinDate <= p.to)
    .map((m) => {
      const mine = es.filter((e) => e.memberId === m.dbId);
      return { m, count: mine.length, amount: sumOf(mine, (e) => e.amount) };
    });
  r.table({
    head: ["Member no.", "Member", "Receipts", `Amount (${cur})`, "% of total"],
    align: ["l", "l", "r", "r", "r"],
    widths: [21, "auto", 20, 32, 22],
    body: rows.map((x) => [x.m.memberNo, x.m.name, x.count ? String(x.count) : "-", money(x.amount), pct(total > 0 ? x.amount / total : null, 1)]),
    foot: [["", "Total", String(es.length), money(total), total > 0 ? "100.0%" : "-"]],
    empty: "No members recorded.",
  });
  r.note("Members shown with \"-\" made no contribution in the period and may require follow-up. Voucher numbers refer to the receipt voucher (RV) series used across all MSO reports.");
}

function reserveLedger(r: Report, books: Books, p: ReportPeriod) {
  const cur = r.ctx.currency;
  const open = openingDate(p);
  const opening = books.balancesAt(open).reserve;
  const es = entriesInPeriod(books, p).filter((e) => e.kind === "donation" || e.kind === "expense" || e.kind === "profit_reserve");
  const category = (e: LedgerEntry) => (e.kind === "donation" ? "Donation" : e.kind === "expense" ? "Expense" : "Bank profit share");
  let bal = opening;
  const body: RowInput[] = [bfRow(7, open ? "Balance brought forward" : "Opening balance (inception)", r.d(p.from ?? es[0]?.date ?? p.to), opening, 6)];
  for (const e of es) {
    const add = e.kind === "expense" ? 0 : e.amount;
    const ded = e.kind === "expense" ? e.amount : 0;
    bal = r2(bal + add - ded);
    body.push([r.d(e.date), e.voucher, e.kind === "profit_reserve" ? e.particulars : e.detail || KIND_LABELS[e.kind], category(e), money(add), money(ded), money(bal)]);
  }
  const donations = sumOf(es.filter((e) => e.kind === "donation"), (e) => e.amount);
  const allocations = sumOf(es.filter((e) => e.kind === "profit_reserve"), (e) => e.amount);
  const expenses = sumOf(es.filter((e) => e.kind === "expense"), (e) => e.amount);
  r.kpis([
    { label: "Opening balance", value: amt(cur, opening) },
    { label: "Donations", value: amt(cur, donations), tone: "good" },
    { label: "Bank profit share", value: amt(cur, allocations), tone: "good" },
    { label: "Expenses", value: amt(cur, expenses), tone: "bad" },
    { label: "Closing balance", value: amt(cur, bal) },
  ]);
  r.table({
    head: ["Date", "Voucher", "Particulars", "Category", `Additions (${cur})`, `Deductions (${cur})`, `Balance (${cur})`],
    align: ["l", "l", "l", "l", "r", "r", "r"],
    widths: [18, 19, "auto", 22, 23, 23, 25],
    fontSize: 7.5,
    body,
    foot: [["", "", "Totals / balance carried forward", "", money(r2(donations + allocations)), money(expenses), money(bal)]],
  });
  r.heading("Fund movement summary");
  r.statement(
    [
      { t: "item", label: open ? `Balance as at ${r.d(open)}` : "Balance at inception", v: [opening] },
      { t: "item", label: "Add: donations received", v: [donations] },
      { t: "item", label: "Add: share of bank profit", v: [allocations] },
      { t: "item", label: "Less: expenses charged to the fund", v: [-expenses] },
      { t: "total", label: `Balance as at ${r.d(p.to)}`, v: [bal] },
    ],
    [cur],
  );
  r.ensure(52);
  r.note("The reserve fund is a restricted fund. Donations and profit allocations are credited to it; expenses may be charged only with the approval of the Executive Committee. The 10% share of bank profit is credited by journal voucher (JV) when the profit is distributed.");
  r.signatures(["Prepared by - Treasurer", "Approved by - President"]);
}

function profitDistribution(r: Report, books: Books, distributionId?: string) {
  const cur = r.ctx.currency;
  const dists = books.distributions;
  if (!dists.length) throw new Error("No profit distributions have been recorded yet");
  const d = (distributionId && dists.find((x) => x.id === distributionId)) || dists[dists.length - 1];
  const bankProfit = r2(Number(d.totalProfit) || 0);
  const reserveShare = r2(Number(d.reserveAllocation) || 0);
  const membersShare = r2(bankProfit - reserveShare);
  const credited = sumOf(d.memberAllocations, (a) => a.amount);
  const leftOver = r2(membersShare - credited);
  const basis = books.distributionBasis(d.id);

  const rows = d.memberAllocations
    .map((a) => {
      const mr = books.memberById.get(a.memberId);
      const contributed = basis ? basis.byMember.get(a.memberId) ?? 0 : null;
      const share = basis ? (contributed ?? 0) / basis.total : credited > 0 ? a.amount / credited : 0;
      return { no: mr?.memberNo ?? "-", name: mr?.name ?? a.memberName, contributed, share, amount: r2(Number(a.amount) || 0) };
    })
    .sort((x, y) => x.no.localeCompare(y.no));

  r.infoGrid([
    ["Source of profit", "Annual bank profit"],
    ["Date of distribution", r.d(d.date.slice(0, 10))],
    ["Reference no.", d.voucher],
  ]);
  r.kpis([
    { label: "Bank profit received", value: amt(cur, bankProfit) },
    { label: `To reserve fund (${pctText(shareOf(d))})`, value: amt(cur, reserveShare) },
    { label: `Shared among members (${pctText(100 - shareOf(d))})`, value: amt(cur, membersShare), sub: `${rows.length} members`, tone: "good" },
  ]);

  r.heading("How each member's share is worked out");
  r.paragraph(
    `The members' share of ${amt(cur, membersShare)} is divided in proportion to each member's total contributions${basis ? ` (${amt(cur, basis.total)} contributed by all members)` : ""}. The more a member has contributed, the larger their share.`,
    { size: 8.6 },
  );
  
  r.heading("Share of each member");
  r.table({
    head: basis
      ? ["No.", "Member", `Total contributions (${cur})`, "Share", `Profit share (${cur})`]
      : ["No.", "Member", "Share", `Profit share (${cur})`],
    align: basis ? ["l", "l", "r", "r", "r"] : ["l", "l", "r", "r"],
    widths: basis ? [18, "auto", 44, 24, 40] : [18, "auto", 26, 40],
    fontSize: 8.4,
    body: rows.map((x) => (basis ? [x.no, x.name, money(x.contributed ?? 0), pct(x.share), money(x.amount)] : [x.no, x.name, pct(x.share), money(x.amount)])),
    foot: [
      basis
        ? ["", `Total (${rows.length} members)`, money(basis.total), "100.00%", money(credited)]
        : ["", `Total (${rows.length} members)`, "100.00%", money(credited)],
    ],
    empty: "No member shares were recorded for this distribution.",
  });
  if (!basis && rows.length) {
    r.note("The contribution totals used for this distribution no longer match the current records (contributions may have been changed since), so only each member's share is shown.");
  }

  if (Math.abs(leftOver) >= EPS) {
    r.note(
      leftOver > 0
        ? `Shares are rounded to the nearest paisa, so ${amt(cur, leftOver)} of the members' share is left over and stays with the organisation.`
        : `Shares are rounded to the nearest paisa, so members received ${amt(cur, -leftOver)} more than the members' share in total.`,
    );
  }

  r.signatures(["Prepared by - Treasurer", "Approved by - President"], "Approved for distribution by the Executive Committee.");
}

function meetingsRegister(r: Report, books: Books, p: ReportPeriod) {
  const cur = r.ctx.currency;
  const inP = (d: string) => (p.from === null || d >= p.from) && d <= p.to;
  const meetings = books.meetings.filter((m) => inP(m.date));
  const summary = books.attendanceSummary(p);
  const recorded = meetings.filter((m) => m.recorded);
  const totPresent = recorded.reduce((s, m) => s + m.present, 0);
  const totMarked = recorded.reduce((s, m) => s + m.present + m.absent, 0);
  r.kpis([
    { label: "Meetings held", value: String(meetings.length), sub: `${recorded.length} with attendance recorded` },
    { label: "Average attendance", value: pct(totMarked ? totPresent / totMarked : null, 0) },
    { label: "Collected at meetings", value: amt(cur, sumOf(meetings, (m) => m.collections)), tone: "good" },
  ]);
  r.table({
    head: ["No.", "Date", "Agenda", "Decisions / resolutions", "Present", "Absent", `Collections (${cur})`],
    align: ["r", "l", "l", "l", "r", "r", "r"],
    widths: [9, 20, 48, "auto", 14, 14, 27],
    fontSize: 7.4,
    body: meetings.map((m, i) => [String(i + 1), r.d(m.date), m.agenda || "-", m.decisions || "-", m.recorded ? String(m.present) : "n/r", m.recorded ? String(m.absent) : "n/r", money(m.collections)]),
    foot: [["", "", `${meetings.length} meetings`, "", String(totPresent), String(totMarked - totPresent), money(sumOf(meetings, (m) => m.collections))]],
    empty: "No meetings were held in the selected period.",
  });
  r.heading("Attendance by member");
  r.table({
    head: ["Member no.", "Member", "Meetings eligible", "Present", "Absent", "Attendance"],
    align: ["l", "l", "r", "r", "r", "r"],
    widths: [21, "auto", 28, 18, 18, 22],
    body: summary
      .filter((s) => s.eligible > 0)
      .map((s) => [
        s.member.memberNo,
        s.member.name,
        String(s.eligible),
        String(s.present),
        String(s.absent),
        { content: pct(s.rate, 0), styles: { fontStyle: "bold", textColor: (s.rate ?? 1) < 0.5 ? C.bad : C.ink } },
      ]),
    doubleRule: false,
    empty: "No attendance was recorded in the selected period.",
  });
  r.note("n/r = attendance not recorded. A member is eligible for meetings with recorded attendance held on or after their date of admission. Collections are contributions linked to the meeting at which they were received.");
}

// ───────────────────────── Public API ─────────────────────────

const META: Record<ReportKind, { code: string; title: string; stem: string; landscape?: boolean; confidential?: boolean; asAt?: boolean }> = {
  "financial-statements": { code: "FS", title: "Financial Statements", stem: "Financial_Statements" },
  "trial-balance": { code: "TB", title: "Trial Balance", stem: "Trial_Balance", asAt: true },
  "cash-book": { code: "CB", title: "Cash Book", stem: "Cash_Book", landscape: true },
  "member-statement": { code: "MS", title: "Member Account Statement", stem: "Member_Statement", confidential: true },
  "member-register": { code: "RM", title: "Register of Members", stem: "Register_of_Members", landscape: true, confidential: true, asAt: true },
  "loan-portfolio": { code: "LP", title: "Loan Portfolio and Ageing Report", stem: "Loan_Portfolio", landscape: true, asAt: true },
  "loan-statement": { code: "LS", title: "Loan Account Statement", stem: "Loan_Statement", confidential: true, asAt: true },
  "contribution-register": { code: "CR", title: "Contribution Register", stem: "Contribution_Register" },
  "reserve-ledger": { code: "RF", title: "Reserve Fund Ledger", stem: "Reserve_Fund_Ledger" },
  "profit-distribution": { code: "PD", title: "Profit Distribution Statement", stem: "Profit_Distribution" },
  "meetings-register": { code: "MR", title: "Meetings and Attendance Register", stem: "Meetings_Register" },
};

export const reportTitle = (kind: ReportKind) => META[kind].title;

/** Builds a report without saving it (used by the download action and for previews/tests). */
export async function buildReport(books: Books, req: ReportRequest, settings: ReportSettings, now = new Date()): Promise<{ doc: jsPDF; filename: string }> {
  const meta = META[req.kind];
  if (!meta) throw new Error("Invalid report type");
  const ctx: ReportContext = {
    orgName: resolveOrgName(settings.organizationName),
    dateFormat: settings.dateFormat || "dd/MM/yyyy",
    timeFormat: settings.timeFormat || "12",
    reserveSharePercent: settings.reserveSharePercent ?? 10,
    currency: settings.currency || "PKR",
    logo: await loadLogo(),
    generatedAt: now,
  };
  const p = req.period;
  const d: Fmt = (k) => fmtDay(k, ctx.dateFormat);

  let subtitle = meta.asAt ? `As at ${d(p.to)}` : periodSubtitle(d, p);
  let tag = meta.asAt ? `as_at_${p.to}` : p.from ? `${p.from}_to_${p.to}` : `to_${p.to}`;
  if (req.kind === "trial-balance") subtitle = `As at ${d(p.to)}  |  Income and expenses: ${rangeText(d, p)}`;
  if (req.kind === "member-statement") {
    const m = req.memberId ? books.memberById.get(req.memberId) : undefined;
    if (!m) throw new Error("Please select a member");
    subtitle = `${m.memberNo} ${m.name}  |  ${subtitle}`;
    tag = `${m.memberNo}_${slug(m.name)}_${tag}`;
  }
  if (req.kind === "loan-statement") {
    const l = req.loanId ? books.loanById.get(req.loanId) : undefined;
    if (!l) throw new Error("Please select a loan");
    subtitle = `${l.loanNo}  |  ${l.memberNo} ${l.memberName}  |  As at ${d(p.to < l.date ? l.date : p.to)}`;
    tag = `${l.loanNo}_${slug(l.memberName)}_as_at_${p.to}`;
  }
  if (req.kind === "profit-distribution") {
    const dist = (req.distributionId && books.distributions.find((x) => x.id === req.distributionId)) || books.distributions[books.distributions.length - 1];
    if (!dist) throw new Error("No profit distributions have been recorded yet");
    subtitle = `Bank profit distributed on ${d(dist.date.slice(0, 10))}  |  Ref. ${dist.voucher}`;
    tag = `${dist.date.slice(0, 4)}_${dist.voucher}`;
  }

  const r = new Report({ code: meta.code, title: meta.title, subtitle, landscape: meta.landscape, confidential: meta.confidential }, ctx);
  switch (req.kind) {
    case "financial-statements":
      financialStatements(r, books, p);
      break;
    case "trial-balance":
      trialBalance(r, books, p);
      break;
    case "cash-book":
      cashBook(r, books, p);
      break;
    case "member-statement":
      memberStatement(r, books, p, req.memberId!);
      break;
    case "member-register":
      memberRegister(r, books, p);
      break;
    case "loan-portfolio":
      loanPortfolio(r, books, p);
      break;
    case "loan-statement":
      loanStatement(r, books, p, req.loanId!);
      break;
    case "contribution-register":
      contributionRegister(r, books, p);
      break;
    case "reserve-ledger":
      reserveLedger(r, books, p);
      break;
    case "profit-distribution":
      profitDistribution(r, books, req.distributionId);
      break;
    case "meetings-register":
      meetingsRegister(r, books, p);
      break;
  }
  return { doc: r.finalize(), filename: `MSO_${meta.stem}_${tag}.pdf` };
}

/** Generates the report and triggers the download/save dialog. Returns the file name. */
export async function generateReport(books: Books, req: ReportRequest, settings: ReportSettings): Promise<string> {
  const { doc, filename } = await buildReport(books, req, settings);
  doc.save(filename);
  return filename;
}
