import { useCallback, useEffect, useState } from "react";
import { addDays, format } from "date-fns";
import { dbQuery, getDbActor } from "@/lib/db";

/**
 * The move from the paper registers to the app.
 *
 * The cut-over date is the last day kept in the paper registers. Everything up to it is summed
 * into the opening balances (imported from an Excel file, electron/openingBalances.cjs); from the
 * next day the app is the record, so no money entry may be dated on or before it. Stored in the
 * database (app_config) rather than on this computer, so backups and restores carry it.
 */

export interface OpeningSummary {
  importedAt: string;
  fileName: string | null;
  members: number;
  savings: number;
  loans: number;
  reserve: number;
  /** The year's profit not yet shared, brought in with the opening balances (31 December cut-over). */
  profit?: { year: number; bankProfit: number; interest: number; penalties: number; absences: number } | null;
}

/**
 * The year whose profit was still to be shared at the cut-over (a 31 December cut-over), as entered
 * from the paper registers. Its bank profit is an opening bank_profits row; the interest, penalties
 * and each member's absences are used for that year's AGM instead of the app's own records.
 */
export interface OpeningProfit {
  year: number;
  /** The cut-over date: the day the money is counted in the books. */
  asAt: string;
  bankProfit: number;
  interest: number;
  penalties: number;
  /** Meetings each member was marked absent at in that year, by member id. */
  absences: Record<string, number>;
}

export interface BooksConfig {
  /** yyyy-MM-dd, or null while the app holds the whole history. */
  cutoverDate: string | null;
  opening: OpeningSummary | null;
  openingProfit: OpeningProfit | null;
  /** The move is finished: Settings hides the paper-registers section and "Clear all records". */
  registersHidden: boolean;
}

const CHANGED_EVENT = "books:changed";
const EMPTY: BooksConfig = { cutoverDate: null, opening: null, openingProfit: null, registersHidden: false };
let cached: BooksConfig = EMPTY;

const localDay = (key: string) => {
  const [y, m, d] = key.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
};

export async function fetchBooksConfig(): Promise<BooksConfig> {
  const rows = await dbQuery<{ key: string; value: string | null }>(
    "SELECT key, value FROM public.app_config WHERE key IN ('cutover_date', 'opening_summary', 'opening_profit', 'registers_hidden')",
  );
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const parse = <T,>(v: string | null | undefined): T | null => {
    try {
      return v ? (JSON.parse(v) as T) : null;
    } catch {
      return null;
    }
  };
  cached = {
    cutoverDate: map.cutover_date ? String(map.cutover_date).slice(0, 10) : null,
    opening: parse<OpeningSummary>(map.opening_summary),
    openingProfit: parse<OpeningProfit>(map.opening_profit),
    registersHidden: map.registers_hidden === "true",
  };
  return cached;
}

/** The cut-over settings, refreshed whenever they change anywhere in the app. */
export function useBooksConfig() {
  const [config, setConfig] = useState<BooksConfig>(cached);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      setConfig(await fetchBooksConfig());
    } catch {
      // No database (browser-only dev server): behave as if no cut-over is set.
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    refresh();
    window.addEventListener(CHANGED_EVENT, refresh);
    return () => window.removeEventListener(CHANGED_EVENT, refresh);
  }, [refresh]);
  return { config, loading, refresh };
}

const announce = () => window.dispatchEvent(new CustomEvent(CHANGED_EVENT));

/** The first day the app keeps the books: the day after the cut-over. */
export const firstBookDay = (cutoverDate: string) => format(addDays(localDay(cutoverDate), 1), "yyyy-MM-dd");

export function cutoverMessage(cutoverDate: string, dateFormat: string) {
  const d = format(localDay(cutoverDate), dateFormat || "dd/MM/yyyy");
  return `Records up to ${d} are kept in the paper registers and are already included in the opening balances. Choose a date after ${d}.`;
}

/**
 * Why a money entry dated `date` (yyyy-MM-dd) can't be saved, or null when it can. Reads the
 * cut-over from the database each time, so a change made in Settings applies at once.
 */
export async function cutoverBlock(date: string, dateFormat: string): Promise<string | null> {
  let cutoverDate: string | null = null;
  try {
    cutoverDate = (await fetchBooksConfig()).cutoverDate;
  } catch {
    return null;
  }
  if (!cutoverDate || String(date).slice(0, 10) > cutoverDate) return null;
  return cutoverMessage(cutoverDate, dateFormat);
}

/** Money entries (not opening balances) dated on or before `date`, by kind; empty when none. */
export async function entriesOnOrBefore(date: string): Promise<{ label: string; count: number }[]> {
  const [row] = await dbQuery<Record<string, number>>(
    `SELECT
       (SELECT COUNT(*) FROM public.meetings WHERE meeting_date <= $1)::int AS meetings,
       (SELECT COUNT(*) FROM public.monthly_contributions WHERE contribution_date <= $1 AND NOT is_opening)::int AS contributions,
       (SELECT COUNT(*) FROM public.loans WHERE loan_date <= $1 AND opening_as_at IS NULL)::int AS loans,
       (SELECT COUNT(*) FROM public.loan_installments WHERE payment_date <= $1)::int AS repayments,
       (SELECT COUNT(*) FROM public.reserve_transactions WHERE transaction_date <= $1 AND transaction_type <> 'opening')::int AS reserve,
       (SELECT COUNT(*) FROM public.bank_profits WHERE credited_on <= $1 AND NOT is_opening)::int AS bank_profits,
       (SELECT COUNT(*) FROM public.profit_distributions WHERE distribution_date <= $1)::int AS distributions`,
    [date],
  );
  const labels: Record<string, [string, string]> = {
    meetings: ["meeting", "meetings"],
    contributions: ["contribution", "contributions"],
    loans: ["loan", "loans"],
    repayments: ["loan repayment", "loan repayments"],
    reserve: ["reserve fund entry", "reserve fund entries"],
    bank_profits: ["bank profit entry", "bank profit entries"],
    distributions: ["profit distribution", "profit distributions"],
  };
  return Object.entries(labels)
    .map(([k, [one, many]]) => ({ count: Number(row?.[k]) || 0, one, many }))
    .filter((x) => x.count > 0)
    .map((x) => ({ count: x.count, label: `${x.count} ${x.count === 1 ? x.one : x.many}` }));
}

/** Sets (or, with null, removes) the cut-over date. Refuses a date that would leave entries before it. */
export async function setCutoverDate(date: string | null): Promise<{ error?: string }> {
  const current = await fetchBooksConfig();
  if (current.opening) {
    return { error: "Opening balances have been imported for the current date. Remove them first, then change the date and import again." };
  }
  if (date) {
    const conflicts = await entriesOnOrBefore(date);
    if (conflicts.length > 0) {
      return {
        error: `The app already has ${conflicts.map((c) => c.label).join(", ")} dated on or before that day. Choose an earlier cut-over date, or clear those records first.`,
      };
    }
    await dbQuery(
      `INSERT INTO public.app_config (key, value, updated_at) VALUES ('cutover_date', $1, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [date],
    );
  } else {
    await dbQuery("DELETE FROM public.app_config WHERE key = 'cutover_date'");
  }
  await fetchBooksConfig();
  announce();
  return {};
}

/**
 * Hides (or shows again) the paper-registers section and "Clear all records" in Settings once the
 * move is finished. Only what Settings shows changes: the cut-over date, the opening balances and
 * the block on entries dated on or before the cut-over all stay.
 */
export async function setRegistersHidden(hidden: boolean): Promise<void> {
  if (hidden) {
    await dbQuery(
      `INSERT INTO public.app_config (key, value, updated_at) VALUES ('registers_hidden', 'true', now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    );
  } else {
    await dbQuery("DELETE FROM public.app_config WHERE key = 'registers_hidden'");
  }
  await fetchBooksConfig();
  announce();
}

/** How many records the app holds, for the "clear all records" confirmation. */
export async function recordCounts() {
  const [row] = await dbQuery<Record<string, number>>(
    `SELECT
       (SELECT COUNT(*) FROM public.members)::int AS members,
       (SELECT COUNT(*) FROM public.meetings)::int AS meetings,
       (SELECT COUNT(*) FROM public.monthly_contributions)::int AS contributions,
       (SELECT COUNT(*) FROM public.loans)::int AS loans,
       (SELECT COUNT(*) FROM public.reserve_transactions)::int AS reserve,
       (SELECT COUNT(*) FROM public.profit_distributions)::int AS distributions`,
  );
  return {
    members: Number(row?.members) || 0,
    meetings: Number(row?.meetings) || 0,
    contributions: Number(row?.contributions) || 0,
    loans: Number(row?.loans) || 0,
    reserve: Number(row?.reserve) || 0,
    distributions: Number(row?.distributions) || 0,
  };
}

// ── Main-process actions (electron/openingBalances.cjs)

type Result<T = unknown> = { canceled?: boolean; error?: string; success?: boolean } & T;
type Bridge = {
  openingTemplate?: (cutoverDate: string, currency: string, absenceFine: number) => Promise<Result<{ path?: string }>>;
  openingRead?: () => Promise<Result<RawOpeningFile>>;
  openingImport?: (payload: unknown) => Promise<Result<{ summary?: OpeningSummary }>>;
  openingRemove?: (actor: string | null) => Promise<Result<{ removedMembers?: number }>>;
  clearRecords?: (actor: string | null) => Promise<Result>;
};
const bridge = () => (window as unknown as { electronAPI?: Bridge }).electronAPI;
const DESKTOP_ONLY: Result = { error: "This is available in the desktop app." };

/** One row of the filled template as read from Excel: raw cell values, checked in utils/openingBalances.ts. */
export type RawCell = string | number | null;
export interface RawOpeningFile {
  fileName?: string;
  meta?: { version: RawCell; cutoverDate: RawCell; currency: RawCell };
  members?: Array<{ row: number; name: RawCell; fatherName: RawCell; phone: RawCell; address: RawCell; joinDate: RawCell; savings: RawCell; absences?: RawCell }>;
  loans?: Array<{ row: number; memberName: RawCell; fatherName: RawCell; loanDate: RawCell; amount: RawCell; interest: RawCell; repaid: RawCell; penalties: RawCell; defaulted: RawCell; note: RawCell }>;
  reserve?: RawCell;
  /** The "Profit not yet shared" sheet (31 December cut-over templates only). */
  profit?: { year: RawCell; bankProfit: RawCell; interest: RawCell; penalties: RawCell } | null;
}

/** absenceFine only fills the template's worked-out absence charges, shown for checking. */
export async function saveOpeningTemplate(cutoverDate: string, currency: string, absenceFine: number): Promise<Result<{ path?: string }>> {
  const api = bridge();
  return api?.openingTemplate ? api.openingTemplate(cutoverDate, currency, absenceFine) : DESKTOP_ONLY;
}

export async function readOpeningFile(): Promise<Result<RawOpeningFile>> {
  const api = bridge();
  return api?.openingRead ? api.openingRead() : DESKTOP_ONLY;
}

export async function importOpeningBalances(payload: object): Promise<Result<{ summary?: OpeningSummary }>> {
  const api = bridge();
  if (!api?.openingImport) return DESKTOP_ONLY;
  const res = await api.openingImport({ ...payload, actor: getDbActor() });
  if (res?.success) {
    await fetchBooksConfig();
    announce();
  }
  return res;
}

export async function removeOpeningBalances(): Promise<Result<{ removedMembers?: number }>> {
  const api = bridge();
  if (!api?.openingRemove) return DESKTOP_ONLY;
  const res = await api.openingRemove(getDbActor());
  if (res?.success) {
    await fetchBooksConfig();
    announce();
  }
  return res;
}

export async function clearAllRecords(): Promise<Result> {
  const api = bridge();
  if (!api?.clearRecords) return DESKTOP_ONLY;
  const res = await api.clearRecords(getDbActor());
  if (res?.success) {
    await fetchBooksConfig();
    announce();
  }
  return res;
}
