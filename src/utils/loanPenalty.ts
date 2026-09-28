import { addDays, addMonths, format } from "date-fns";
import { ORGANIZATION_CONFIG } from "@/config/organization";

const toKey = (d: Date) => format(d, "yyyy-MM-dd");

// Local calendar date, not `new Date(str)` (which parses as UTC and can shift a day).
const fromKey = (key: string) => {
  const [y, m, d] = key.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** yyyy-MM-dd by which a loan must be repaid in full: one loan period after it was issued. */
export function loanDueDate(loanDate: string): string {
  return toKey(addMonths(fromKey(loanDate), ORGANIZATION_CONFIG.LOAN_PERIOD_MONTHS));
}

export interface PenaltyCharge {
  /** 1 for the first full month late, 2 for the second, and so on. */
  month: number;
  /** The day the charge applies: the day after that month ends. */
  chargeDate: string;
  amount: number;
}

export interface PenaltyInput {
  loanDate: string;
  /** Amount lent + interest. */
  totalPayable: number;
  penaltyPerMonth: number;
  /** Repayment the loan row reflects but no dated payment explains (loans recorded before
   * per-payment tracking); counted as paid from the start. */
  paidUndated: number;
  payments: { date: string; amount: number }[];
}

/**
 * Late penalties a loan has incurred by `asOf` (yyyy-MM-dd).
 *
 * A loan may be repaid in instalments or as a lump sum at any time before its due date. For each
 * full month after the due date that the loan is still not cleared, a flat penalty is added to what
 * is owed: due 1 Jan and still unpaid at the end of 1 Feb gives the first charge on 2 Feb. "Cleared"
 * means everything owed — the total payable plus every penalty charged so far — so penalties keep
 * being added each month until the member has paid all of it, penalties included.
 */
export function penaltiesDue(loan: PenaltyInput, asOf: string): PenaltyCharge[] {
  const charges: PenaltyCharge[] = [];
  if (!(loan.penaltyPerMonth > 0)) return charges;
  const due = fromKey(loanDueDate(loan.loanDate));
  for (let month = 1; month <= 1200; month++) {
    // Computed from the due date each time so month-end clamping (31 Jan -> 28 Feb) doesn't drift.
    const monthEnd = toKey(addMonths(due, month));
    if (monthEnd >= asOf) break;
    const paid = loan.payments.reduce((s, p) => (p.date.slice(0, 10) <= monthEnd ? s + Number(p.amount) : s), loan.paidUndated);
    // Owed at this month's end: the total payable plus the penalties charged in earlier months.
    const owed = loan.totalPayable + charges.reduce((s, c) => s + c.amount, 0);
    if (paid >= owed - 0.005) break;
    charges.push({ month, chargeDate: toKey(addDays(fromKey(monthEnd), 1)), amount: loan.penaltyPerMonth });
  }
  return charges;
}
