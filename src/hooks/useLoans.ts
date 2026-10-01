import { useState, useEffect } from "react";
import { addMonths, format } from "date-fns";
import { dbQuery } from "@/lib/db";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/contexts/SettingsContext";
import { ORGANIZATION_CONFIG } from "@/config/organization";
import { loanDueDate, penaltiesDue, type PenaltyInput } from "@/utils/loanPenalty";
import { cutoverBlock } from "@/lib/books";

export interface DbLoan {
  id: string;
  member_id: string;
  amount: number;
  /** Everything still owed: principal + profit + late penalties charged, less repayments. */
  remaining_amount: number;
  loan_date: string;
  status: string;
  term_months: number;
  interest_rate: number;
  total_payable: number;
  penalty_per_month: number;
  /** Set on loans brought in from the paper registers: the cut-over date they were open at. */
  opening_as_at?: string | null;
  /** Set when the committee marks the loan defaulted: the day it did. Penalties stop then. */
  defaulted_on?: string | null;
  /** The bank's charge on the cheque withdrawal, owed by the member with the loan (no interest on it). */
  bank_charge?: number;
  created_at: string;
  updated_at: string;
}

export interface DbLoanPenalty {
  id: string;
  loan_id: string;
  penalty_month: number;
  charge_date: string;
  amount: number;
  created_at: string;
}

export interface DbLoanInstallment {
  id: string;
  loan_id: string;
  amount: number;
  payment_date: string;
  created_at: string;
}

export interface DbLoanScheduleEntry {
  id: string;
  loan_id: string;
  installment_number: number;
  due_date: string;
  due_amount: number;
  paid_amount: number;
  status: "pending" | "paid";
  created_at: string;
}

export interface LoanWithMember extends DbLoan {
  member_name?: string;
  penalty_total: number;
}

export interface LoanFormData {
  member_id: string;
  amount: number;
  loan_date: string;
  /** The bank's charge on the cheque withdrawal (loans above the limit in Settings); the member repays it with the loan. */
  bank_charge?: number;
}

export interface InstallmentFormData {
  loan_id: string;
  amount: number;
  payment_date: string;
}

// Parsed as local calendar components (not `new Date(str)`, which parses as UTC and
// can shift a day in timezones behind UTC once reformatted).
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const todayKey = () => format(new Date(), "yyyy-MM-dd");

// A loan with its charged penalties and payments, read in one statement so a concurrent
// payment or penalty sync is never half-seen.
interface PenaltySnapshot {
  id: string;
  loan_date: string;
  total_payable: number;
  bank_charge: number;
  remaining_amount: number;
  penalty_per_month: number;
  opening_as_at: string | null;
  status: string;
  defaulted_on: string | null;
  penalties: { month: number; amount: number }[];
  payments: { date: string; amount: number }[];
}

const SNAPSHOT_SQL = `SELECT l.id, l.loan_date, l.total_payable, l.bank_charge, l.remaining_amount, l.penalty_per_month, l.opening_as_at, l.status, l.defaulted_on,
  COALESCE((SELECT json_agg(json_build_object('month', p.penalty_month, 'amount', p.amount)) FROM public.loan_penalties p WHERE p.loan_id = l.id), '[]') AS penalties,
  COALESCE((SELECT json_agg(json_build_object('date', i.payment_date, 'amount', i.amount)) FROM public.loan_installments i WHERE i.loan_id = l.id), '[]') AS payments
  FROM public.loans l`;

function penaltyInput(s: PenaltySnapshot): PenaltyInput {
  const charged = s.penalties.reduce((sum, p) => sum + Number(p.amount), 0);
  const itemised = s.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  // Owed before penalties: the total payable plus the bank charge.
  const owedBase = Number(s.total_payable) + (Number(s.bank_charge) || 0);
  const paidEver = owedBase + charged - Number(s.remaining_amount);
  return {
    loanDate: s.loan_date,
    totalPayable: owedBase,
    penaltyPerMonth: Number(s.penalty_per_month),
    paidUndated: Math.max(0, r2(paidEver - itemised)),
    payments: s.payments,
    // Month 0 is the penalty total a loan from the paper registers came in with.
    openingAsAt: s.opening_as_at,
    openingPenalty: s.penalties.filter((p) => p.month === 0).reduce((sum, p) => sum + Number(p.amount), 0),
    defaultedOn: s.defaulted_on,
  };
}

// Brings stored late penalties in line with penaltiesDue() for every unpaid loan (or just one).
// Charges are added as months pass and removed if a back-dated payment means they no longer
// apply. Each loan is updated in one statement that changes the charges and remaining_amount
// together, and only if remaining_amount still matches what was read, so two screens syncing
// at once can't apply a charge twice.
export async function syncLoanPenalties(loanId?: string) {
  try {
    const today = todayKey();
    const snapshots = await dbQuery<PenaltySnapshot>(
      loanId ? `${SNAPSHOT_SQL} WHERE l.id = $1` : `${SNAPSHOT_SQL} WHERE l.status <> 'paid'`,
      loanId ? [loanId] : []
    );
    for (const s of snapshots) {
      // Marked defaulted with no date (a backup restored from before the date was kept): leave its
      // penalties as they are until the next start-up gives it one.
      if (s.status === "defaulted" && !s.defaulted_on) continue;
      const expected = penaltiesDue(penaltyInput(s), today);
      const expectedMonths = new Set(expected.map((c) => c.month));
      // Month 0 (penalties brought forward from the paper registers) is never recalculated.
      const charged = new Set(s.penalties.filter((p) => p.month !== 0).map((p) => p.month));
      const missing = expected.filter((c) => !charged.has(c.month));
      const hasExtra = [...charged].some((m) => !expectedMonths.has(m));
      if (!missing.length && !hasExtra) continue;
      await dbQuery(
        `WITH cur AS (SELECT 1 FROM public.loans WHERE id = $1 AND remaining_amount = $2),
         del AS (
           DELETE FROM public.loan_penalties
           WHERE loan_id = $1 AND penalty_month <> 0 AND NOT (penalty_month = ANY($3::int[])) AND EXISTS (SELECT 1 FROM cur)
           RETURNING -amount AS change
         ),
         ins AS (
           INSERT INTO public.loan_penalties (loan_id, penalty_month, charge_date, amount)
           SELECT $1, t.month, t.charge_date, t.amount
           FROM unnest($4::int[], $5::date[], $6::numeric[]) AS t(month, charge_date, amount)
           WHERE EXISTS (SELECT 1 FROM cur)
           ON CONFLICT (loan_id, penalty_month) DO NOTHING
           RETURNING amount AS change
         ),
         delta AS (SELECT COALESCE(SUM(change), 0) AS change FROM (SELECT change FROM del UNION ALL SELECT change FROM ins) c)
         UPDATE public.loans l
         SET remaining_amount = l.remaining_amount + delta.change,
             status = CASE WHEN l.remaining_amount + delta.change <= 0.005 THEN 'paid' ELSE l.status END
         FROM delta WHERE l.id = $1 AND delta.change <> 0`,
        [s.id, s.remaining_amount, expected.map((c) => c.month), missing.map((c) => c.month), missing.map((c) => c.chargeDate), missing.map((c) => c.amount)]
      );
    }
  } catch (err) {
    console.error("Error updating loan penalties:", err);
  }
}

export function useLoans() {
  const [loans, setLoans] = useState<LoanWithMember[]>([]);
  const [installments, setInstallments] = useState<DbLoanInstallment[]>([]);
  const [schedule, setSchedule] = useState<DbLoanScheduleEntry[]>([]);
  const [penalties, setPenalties] = useState<DbLoanPenalty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { settings } = useSettings();

  const fetchLoans = async () => {
    setIsLoading(true);
    await syncLoanPenalties();
    try {
      const [data, penaltyRows] = await Promise.all([
        dbQuery<LoanWithMember>(
          `SELECT l.*, m.name as member_name,
             COALESCE((SELECT SUM(p.amount) FROM public.loan_penalties p WHERE p.loan_id = l.id), 0) AS penalty_total
           FROM public.loans l LEFT JOIN public.members m ON m.id = l.member_id ORDER BY l.created_at DESC`
        ),
        dbQuery<DbLoanPenalty>('SELECT * FROM public.loan_penalties ORDER BY loan_id, penalty_month'),
      ]);
      setLoans(data);
      setPenalties(penaltyRows);
    } catch (err: any) {
      toast({ title: "Error", description: "Failed to load loans", variant: "destructive" });
    }
    setIsLoading(false);
  };

  const fetchInstallments = async (loanId?: string) => {
    try {
      const sql = loanId
        ? 'SELECT * FROM public.loan_installments WHERE loan_id=$1 ORDER BY payment_date DESC'
        : 'SELECT * FROM public.loan_installments ORDER BY payment_date DESC';
      const data = await dbQuery<DbLoanInstallment>(sql, loanId ? [loanId] : []);
      setInstallments(data);
    } catch (err: any) {
      console.error("Error fetching installments:", err);
    }
  };

  // Without a loanId, fetches every schedule row (used for overdue stats across all loans).
  // With one, returns just that loan's installment plan for the schedule dialog.
  const fetchSchedule = async (loanId?: string) => {
    try {
      const sql = loanId
        ? 'SELECT * FROM public.loan_schedule WHERE loan_id=$1 ORDER BY installment_number ASC'
        : 'SELECT * FROM public.loan_schedule ORDER BY due_date ASC';
      const data = await dbQuery<DbLoanScheduleEntry>(sql, loanId ? [loanId] : []);
      if (!loanId) setSchedule(data);
      return data;
    } catch (err: any) {
      console.error("Error fetching loan schedule:", err);
      return [];
    }
  };

  const issueLoan = async (formData: LoanFormData) => {
    try {
      const block = await cutoverBlock(formData.loan_date, settings.dateFormat);
      if (block) { toast({ title: "Date is before the cut-over", description: block, variant: "destructive" }); return null; }
      // Every loan runs for the full loan period. The schedule below is a monthly plan for members
      // who repay in instalments; a lump sum any time before the due date is equally fine.
      const termMonths = ORGANIZATION_CONFIG.LOAN_PERIOD_MONTHS;
      const rate = settings.applyLoanInterest ? settings.loanInterestRate : 0;
      const totalPayable = Math.round(formData.amount * (1 + rate / 100) * 100) / 100;
      const penaltyPerMonth = Math.max(0, Number(settings.latePenaltyPerMonth) || 0);
      // The bank's charge on the withdrawal is repaid with the loan, so it is in the balance and the
      // instalment plan; interest is still worked out on the amount lent only.
      const bankCharge = r2(Math.max(0, Number(formData.bank_charge) || 0));
      const owed = r2(totalPayable + bankCharge);

      const rows = await dbQuery<DbLoan>(
        'INSERT INTO public.loans (member_id, amount, remaining_amount, loan_date, status, term_months, interest_rate, total_payable, penalty_per_month, bank_charge) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
        [formData.member_id, formData.amount, owed, formData.loan_date, 'active', termMonths, rate, totalPayable, penaltyPerMonth, bankCharge]
      );
      const loan = rows[0];

      if (loan) {
        const baseDate = parseLocalDate(formData.loan_date);
        const baseInstallment = Math.floor((owed / termMonths) * 100) / 100;
        let allocated = 0;
        for (let i = 1; i <= termMonths; i++) {
          const dueAmount = i === termMonths ? Math.round((owed - allocated) * 100) / 100 : baseInstallment;
          allocated += dueAmount;
          const dueDate = format(addMonths(baseDate, i), "yyyy-MM-dd");
          await dbQuery(
            'INSERT INTO public.loan_schedule (loan_id, installment_number, due_date, due_amount) VALUES ($1,$2,$3,$4)',
            [loan.id, i, dueDate, dueAmount]
          );
        }
      }

      toast({ title: "Loan Issued", description: `Loan of ${settings.currency} ${formData.amount.toLocaleString()} has been issued.` });
      await fetchLoans();
      await fetchSchedule();
      return loan;
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to issue loan", variant: "destructive" });
      return null;
    }
  };

  const recordPayment = async (formData: InstallmentFormData) => {
    try {
      const block = await cutoverBlock(formData.payment_date, settings.dateFormat);
      if (block) { toast({ title: "Date is before the cut-over", description: block, variant: "destructive" }); return false; }
      const [snapshot] = await dbQuery<PenaltySnapshot>(`${SNAPSHOT_SQL} WHERE l.id = $1`, [formData.loan_id]);
      if (!snapshot) { toast({ title: "Error", description: "Loan not found", variant: "destructive" }); return false; }
      // A payment dated before a penalty was charged can cancel that penalty, so check it against
      // what is owed once penalties are recalculated with this payment included.
      const input = penaltyInput(snapshot);
      // Only the penalties the app works out can change; month 0 came from the paper registers.
      const chargedNow = snapshot.penalties.filter((p) => p.month !== 0).reduce((s, p) => s + Number(p.amount), 0);
      const chargedAfter = penaltiesDue(
        { ...input, payments: [...input.payments, { date: formData.payment_date, amount: formData.amount }] },
        todayKey()
      ).reduce((s, c) => s + c.amount, 0);
      const owed = r2(Number(snapshot.remaining_amount) - chargedNow + chargedAfter);
      if (formData.amount > owed + 0.005) {
        toast({ title: "Error", description: `Payment exceeds the balance owed (${settings.currency} ${owed.toLocaleString()})`, variant: "destructive" });
        return false;
      }

      await dbQuery('INSERT INTO public.loan_installments (loan_id, amount, payment_date) VALUES ($1,$2,$3)', [formData.loan_id, formData.amount, formData.payment_date]);

      // Apply the payment as a waterfall across the earliest unpaid installments first.
      const pendingRows = await dbQuery<DbLoanScheduleEntry>(
        "SELECT * FROM public.loan_schedule WHERE loan_id=$1 AND status='pending' ORDER BY installment_number ASC",
        [formData.loan_id]
      );
      let remainingPayment = formData.amount;
      for (const row of pendingRows) {
        if (remainingPayment <= 0) break;
        const outstanding = Number(row.due_amount) - Number(row.paid_amount);
        const applied = Math.min(outstanding, remainingPayment);
        const newPaid = Number(row.paid_amount) + applied;
        const newStatus = Math.abs(newPaid - Number(row.due_amount)) < 0.01 ? "paid" : "pending";
        await dbQuery('UPDATE public.loan_schedule SET paid_amount=$1, status=$2 WHERE id=$3', [newPaid, newStatus, row.id]);
        remainingPayment -= applied;
      }

      // Anything left after the schedule is covered pays off late penalties.
      await dbQuery(
        "UPDATE public.loans SET remaining_amount = remaining_amount - $1, status = CASE WHEN remaining_amount - $1 <= 0.005 THEN 'paid' ELSE 'active' END WHERE id = $2",
        [formData.amount, formData.loan_id]
      );
      await syncLoanPenalties(formData.loan_id);

      toast({ title: "Payment Recorded", description: `Payment of ${settings.currency} ${formData.amount.toLocaleString()} has been recorded.` });
      await fetchLoans();
      // All loans' payments, not just this one's: the Loans page's interest & penalties section needs every loan's.
      await fetchInstallments();
      await fetchSchedule();
      return true;
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to record payment", variant: "destructive" });
      return false;
    }
  };

  // `date` (yyyy-MM-dd) is the day the committee decided. No late penalty is charged after it, and
  // any already charged for later months (the decision entered after the fact) are taken off.
  /**
   * Sets the bank charge on a loan's withdrawal once the bank statement shows it (or corrects it).
   * The difference goes on the balance owed and on the last instalment, in one statement.
   */
  const setBankCharge = async (loanId: string, charge: number) => {
    const value = r2(Number(charge));
    if (!Number.isFinite(value) || value < 0) {
      toast({ title: "Not saved", description: "Enter the bank charge as an amount of 0 or more.", variant: "destructive" });
      return false;
    }
    try {
      const [res] = await dbQuery<{ n: number }>(
        `WITH l AS (
           SELECT id, bank_charge FROM public.loans WHERE id = $1 AND status = 'active' FOR UPDATE
         ),
         u AS (
           UPDATE public.loans SET bank_charge = $2, remaining_amount = loans.remaining_amount + ($2 - l.bank_charge)
           FROM l WHERE loans.id = l.id AND loans.remaining_amount + ($2 - l.bank_charge) >= 0
           RETURNING loans.id, ($2 - l.bank_charge) AS delta
         ),
         s AS (
           UPDATE public.loan_schedule SET due_amount = loan_schedule.due_amount + u.delta,
             status = CASE WHEN loan_schedule.paid_amount >= loan_schedule.due_amount + u.delta - 0.005 THEN 'paid' ELSE 'pending' END
           FROM u WHERE loan_schedule.loan_id = u.id
             AND loan_schedule.installment_number = (SELECT MAX(installment_number) FROM public.loan_schedule WHERE loan_id = u.id)
           RETURNING 1
         )
         SELECT (SELECT COUNT(*) FROM u)::int AS n`,
        [loanId, value]
      );
      if (!res || Number(res.n) === 0) {
        toast({ title: "Not saved", description: "A bank charge can only be set on an active loan, and not below what is still owed.", variant: "destructive" });
        return false;
      }
      await syncLoanPenalties(loanId);
      toast({ title: "Bank charge saved", description: `${settings.currency} ${value.toLocaleString()} is owed with the loan.` });
      await fetchLoans();
      await fetchSchedule();
      return true;
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to save the bank charge", variant: "destructive" });
      return false;
    }
  };

  const markDefaulted = async (loanId: string, date: string) => {
    try {
      const block = await cutoverBlock(date, settings.dateFormat);
      if (block) { toast({ title: "Date is before the cut-over", description: block, variant: "destructive" }); return false; }
      const rows = await dbQuery<DbLoan>(
        "UPDATE public.loans SET status = 'defaulted', defaulted_on = $2 WHERE id = $1 AND status = 'active' AND loan_date <= $2 RETURNING *",
        [loanId, date]
      );
      if (!rows.length) {
        toast({ title: "Not marked defaulted", description: "Only an active loan can be marked defaulted, on or after the day it was issued.", variant: "destructive" });
        return false;
      }
      await syncLoanPenalties(loanId);
      toast({ title: "Loan Marked Defaulted", description: `No late penalties will be added after ${format(parseLocalDate(date), settings.dateFormat)}.` });
      await fetchLoans();
      return true;
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to update loan status", variant: "destructive" });
      return false;
    }
  };

  const getLoansByMember = async (memberId: string) => {
    try {
      return await dbQuery<DbLoan>('SELECT * FROM public.loans WHERE member_id=$1 ORDER BY loan_date DESC', [memberId]);
    } catch { return []; }
  };

  const getActiveLoans = () => loans.filter(l => l.status === 'active');

  // A loan is overdue only once its one-year period has ended with money still owed. Missed
  // monthly instalments within the year don't count: the member may repay as a lump sum instead.
  const isOverdue = (loan: DbLoan) =>
    loan.status === 'active' && Number(loan.remaining_amount) > 0.005 && loanDueDate(loan.loan_date) < todayKey();

  const getOverdueStats = () => {
    const overdue = loans.filter(isOverdue);
    return {
      overdueCount: overdue.length,
      overdueAmount: r2(overdue.reduce((sum, l) => sum + Number(l.remaining_amount), 0)),
    };
  };

  const getNextDueDate = (loanId: string) => {
    const upcoming = schedule
      .filter(s => s.loan_id === loanId && s.status === 'pending')
      .sort((a, b) => a.installment_number - b.installment_number);
    return upcoming[0]?.due_date ?? null;
  };

  const getLoanStats = () => {
    const activeLoans = getActiveLoans();
    const overdue = getOverdueStats();
    return {
      totalOutstanding: activeLoans.reduce((s, l) => s + Number(l.remaining_amount), 0),
      totalIssued: loans.reduce((s, l) => s + Number(l.amount), 0),
      totalRecovered: r2(loans.reduce((s, l) => s + (Number(l.total_payable) + (Number(l.bank_charge) || 0) + Number(l.penalty_total) - Number(l.remaining_amount)), 0)),
      activeLoansCount: activeLoans.length,
      membersWithLoans: new Set(activeLoans.map(l => l.member_id)).size,
      overdueCount: overdue.overdueCount,
      overdueAmount: overdue.overdueAmount,
    };
  };

  useEffect(() => { fetchLoans(); fetchInstallments(); fetchSchedule(); }, []);

  return {
    loans, installments, schedule, penalties, isLoading,
    fetchLoans, fetchInstallments, fetchSchedule,
    issueLoan, recordPayment, markDefaulted, setBankCharge,
    getLoansByMember, getActiveLoans, getLoanStats, getNextDueDate, isOverdue,
  };
}
