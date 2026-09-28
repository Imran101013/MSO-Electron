/**
 * Interest and late penalties on a loan, for the Interest & Penalties sections of the Loans page,
 * member details and PDF reports.
 *
 * Interest is a flat charge worked out once, when the loan is issued; after the due date a late
 * penalty is added for each full month the loan stays unpaid (utils/loanPenalty.ts). Both are added
 * to the one balance the member owes, and repayments only reduce that balance — they are never split
 * between the amount lent, interest and penalties. So a loan's interest and penalties count as
 * received together, when the loan is repaid in full (on the date of the repayment that cleared
 * it), and are outstanding until then.
 */

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * yyyy-MM-dd of the repayment that brought the total repaid up to `owed`, or null if it hasn't been
 * reached. `paidUndated` (repayments with no dated record, from before per-payment tracking) counts
 * from `loanDate`.
 */
export function paidInFullOn(
  owed: number,
  loanDate: string,
  payments: { date: string; amount: number }[],
  paidUndated = 0,
): string | null {
  let paid = paidUndated;
  if (paid >= owed - 0.005) return loanDate.slice(0, 10);
  const sorted = [...payments].sort((a, b) => a.date.localeCompare(b.date));
  for (const p of sorted) {
    paid += Number(p.amount);
    if (paid >= owed - 0.005) return p.date.slice(0, 10);
  }
  return null;
}

export interface LoanIncome {
  /** Flat interest charged when the loan was issued. */
  interest: number;
  /** Late penalties added to the balance so far. */
  penaltiesCharged: number;
  /** When the loan was repaid in full, so its interest and penalties were received; null while anything is owed. */
  receivedOn: string | null;
  interestReceived: number;
  interestOutstanding: number;
  penaltiesReceived: number;
  penaltiesOutstanding: number;
}

export interface LoanIncomeInput {
  loanDate: string;
  /** Amount lent. */
  amount: number;
  totalPayable: number;
  /** remaining_amount as stored: everything still owed, penalties included. */
  remaining: number;
  penaltiesCharged: number;
  /** Dated repayments on this loan. */
  payments: { date: string; amount: number }[];
}

export function loanIncome(loan: LoanIncomeInput): LoanIncome {
  const totalPayable = Number(loan.totalPayable) || Number(loan.amount) || 0;
  const interest = r2(Math.max(0, totalPayable - (Number(loan.amount) || 0)));
  const penaltiesCharged = r2(Number(loan.penaltiesCharged) || 0);
  const owed = r2(totalPayable + penaltiesCharged);
  const repaid = r2(owed - (Number(loan.remaining) || 0));
  const itemised = loan.payments.reduce((s, p) => s + Number(p.amount), 0);
  const receivedOn =
    Number(loan.remaining) <= 0.005 ? paidInFullOn(owed, loan.loanDate, loan.payments, Math.max(0, r2(repaid - itemised))) : null;
  const interestReceived = receivedOn ? interest : 0;
  const penaltiesReceived = receivedOn ? penaltiesCharged : 0;
  return {
    interest,
    penaltiesCharged,
    receivedOn,
    interestReceived,
    interestOutstanding: r2(interest - interestReceived),
    penaltiesReceived,
    penaltiesOutstanding: r2(penaltiesCharged - penaltiesReceived),
  };
}
