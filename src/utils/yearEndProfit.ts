import type { Books } from "@/utils/accounting";

/**
 * Annual profit distribution (user-confirmed rules, 2026-09-30):
 *
 * - The year is January to December; its profit is shared out at the Annual General Meeting held
 *   in July of the following year.
 * - The year's profit = the bank's profit for the year (entered from the bank statement)
 *   + the interest and late penalties collected that year (loans repaid in full during the year)
 *   + the absence charges: a fixed amount for each meeting of the year a member was marked absent at.
 * - A fixed share of that total (Settings, 30%) goes to the reserve fund; the rest is shared among
 *   members in proportion to their savings balance on 31 December (past dividends included).
 * - Each member's absence charges are taken from their own share, never more than the share (any
 *   excess is waived). Because the charges are part of the total, they are in effect shared out
 *   again: 30% to the reserve and 70% among all members.
 *
 * Shares are worked out to the paisa with the largest-remainder method, so they add up to the
 * members' part exactly.
 */

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const EPS = 0.005;

export interface CollectedLoan {
  loanNo: string;
  memberName: string;
  repaidOn: string;
  interest: number;
  penalties: number;
}

export interface YearEndRow {
  memberId: string;
  name: string;
  /** Savings balance on 31 December of the year. */
  savings: number;
  ratio: number;
  /** Share of the members' part, before the member's absence charges. */
  gross: number;
  absences: number;
  /** Absences × the charge per meeting. */
  penaltyDue: number;
  /** What is actually taken: the charges, but never more than the share. */
  penalty: number;
  /** Charges not taken because the share was smaller. */
  waived: number;
  /** Credited to the member's savings. */
  dividend: number;
}

export interface YearEndPlan {
  year: number;
  yearStart: string;
  yearEnd: string;
  bankProfit: number;
  loanInterest: number;
  loanPenalties: number;
  collectedLoans: CollectedLoan[];
  /** The year is in the paper registers: interest, penalties and absences were entered from them
   * with the opening balances (lib/books.ts OpeningProfit) instead of coming from the app's records. */
  fromRegisters: boolean;
  /** Absence charges taken from dividends (part of the total). */
  absencePenalties: number;
  absences: number;
  absenceFine: number;
  /** Bank profit + loan interest + late penalties + absence charges. */
  totalProfit: number;
  reservePercent: number;
  /** The reserve fund's share of the total. */
  reserve: number;
  /** The members' share of the total, before absence charges are taken from it. */
  pool: number;
  rows: YearEndRow[];
  totalSavings: number;
  waived: number;
  /** Credited to members: their share less the absence charges. */
  dividends: number;
  /** Reasons the plan can't be saved (empty when it can). */
  problems: string[];
}

/** Shares `totalPaisa` in proportion to `weights`, to the paisa, adding up exactly. */
function shareOut(totalPaisa: number, weights: number[]): number[] {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (!(sum > 0) || totalPaisa <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (totalPaisa * w) / sum);
  const out = raw.map((x) => Math.floor(x + 1e-9));
  let left = totalPaisa - out.reduce((s, p) => s + p, 0);
  const order = raw.map((x, i) => ({ i, frac: x - Math.floor(x + 1e-9) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; left > 0 && k < order.length; k++, left--) out[order[k].i] += 1;
  return out;
}

export function planYearEnd(
  books: Books,
  opts: {
    year: number;
    bankProfit: number;
    reservePercent: number;
    absenceFine: number;
    /** For the year in the paper registers: its interest and penalties collected and each member's absences. */
    registers?: { interest: number; penalties: number; absences: Record<string, number> } | null;
  },
): YearEndPlan {
  const { year } = opts;
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const inYear = (d: string | null) => !!d && d >= yearStart && d <= yearEnd;
  const problems: string[] = [];

  const bankProfit = r2(Math.max(0, Number(opts.bankProfit) || 0));
  const absenceFine = r2(Math.max(0, Number(opts.absenceFine) || 0));
  const reservePercent = Math.min(100, Math.max(0, Number(opts.reservePercent) || 0));

  const registers = opts.registers ?? null;

  // Interest and penalties collected: loans repaid in full during the year (for a year in the paper
  // registers, the totals entered from them).
  const collectedLoans: CollectedLoan[] = registers
    ? []
    : books.loans
        .filter((l) => inYear(l.paidInFullOn) && (l.interest > EPS || l.penaltyTotal > EPS))
        .map((l) => ({ loanNo: l.loanNo, memberName: l.memberName, repaidOn: l.paidInFullOn as string, interest: l.interest, penalties: l.penaltyTotal }))
        .sort((a, b) => a.repaidOn.localeCompare(b.repaidOn) || a.loanNo.localeCompare(b.loanNo));
  const loanInterest = registers ? r2(Math.max(0, Number(registers.interest) || 0)) : r2(collectedLoans.reduce((s, l) => s + l.interest, 0));
  const loanPenalties = registers ? r2(Math.max(0, Number(registers.penalties) || 0)) : r2(collectedLoans.reduce((s, l) => s + l.penalties, 0));
  const base = r2(bankProfit + loanInterest + loanPenalties);

  // Absences at the year's meetings, from the attendance marked at each meeting (for a year in the
  // paper registers, the counts entered from them). A member on leave is excused, not absent.
  const meetingDate = new Map(books.meetings.map((m) => [m.dbId, m.date]));
  const absencesOf = (memberId: string) => {
    if (registers) return Math.max(0, Math.floor(Number(registers.absences[memberId]) || 0));
    const mr = books.memberById.get(memberId);
    return (mr?.source.attendance ?? []).filter((a) => a.meetingId && a.present === false && !a.onLeave && inYear(meetingDate.get(a.meetingId) ?? null)).length;
  };

  // Savings on 31 December; members with nothing saved get no share (and so pay no charges).
  const members = books.members
    .map((m) => ({ memberId: m.dbId, name: m.name, savings: r2(books.memberSavingsAt(m.dbId, yearEnd)), absences: absencesOf(m.dbId) }))
    .filter((m) => m.savings > EPS);
  const totalSavings = r2(members.reduce((s, m) => s + m.savings, 0));
  if (members.length === 0) problems.push(`No member has savings on 31/12/${year}, so there is no one to share the profit with.`);

  // The charges are part of the total they are taken from, and a charge is never more than the
  // member's share, so the amount actually collected is found by repeating until it settles.
  const split = (charges: number) => {
    const totalProfit = r2(base + charges);
    const reserve = r2((totalProfit * reservePercent) / 100);
    const pool = r2(totalProfit - reserve);
    const gross = shareOut(Math.round(pool * 100), members.map((m) => m.savings)).map((p) => p / 100);
    const taken = members.map((m, i) => r2(Math.min(m.absences * absenceFine, gross[i])));
    return { totalProfit, reserve, pool, gross, taken, collected: r2(taken.reduce((s, t) => s + t, 0)) };
  };
  let charges = r2(members.reduce((s, m) => s + m.absences * absenceFine, 0));
  let result = split(charges);
  for (let k = 0; k < 50 && Math.abs(result.collected - charges) > EPS; k++) {
    charges = result.collected;
    result = split(charges);
  }

  const rows: YearEndRow[] = members
    .map((m, i) => {
      const gross = result.gross[i];
      const penaltyDue = r2(m.absences * absenceFine);
      const penalty = result.taken[i];
      return {
        memberId: m.memberId,
        name: m.name,
        savings: m.savings,
        ratio: totalSavings > 0 ? m.savings / totalSavings : 0,
        gross,
        absences: m.absences,
        penaltyDue,
        penalty,
        waived: r2(penaltyDue - penalty),
        dividend: r2(gross - penalty),
      };
    })
    .sort((a, b) => books.memberOrder(a.memberId, b.memberId));

  if (result.totalProfit <= EPS) problems.push(`There is no profit to distribute for ${year}: no bank profit is recorded for it and no loan was repaid in full that year.`);

  return {
    year,
    yearStart,
    yearEnd,
    bankProfit,
    loanInterest,
    loanPenalties,
    collectedLoans,
    fromRegisters: !!registers,
    absencePenalties: result.collected,
    absences: rows.reduce((s, r) => s + r.absences, 0),
    absenceFine,
    totalProfit: result.totalProfit,
    reservePercent,
    reserve: result.reserve,
    pool: result.pool,
    rows,
    totalSavings,
    waived: r2(rows.reduce((s, r) => s + r.waived, 0)),
    dividends: r2(rows.reduce((s, r) => s + r.dividend, 0)),
    problems,
  };
}
