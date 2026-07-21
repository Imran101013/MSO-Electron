import { useState, useEffect } from "react";
import { addMonths, format } from "date-fns";
import { dbQuery } from "@/lib/db";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/contexts/SettingsContext";

export interface DbLoan {
  id: string;
  member_id: string;
  amount: number;
  remaining_amount: number;
  loan_date: string;
  status: string;
  term_months: number;
  interest_rate: number;
  total_payable: number;
  created_at: string;
  updated_at: string;
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
}

export interface LoanFormData {
  member_id: string;
  amount: number;
  loan_date: string;
  term_months: number;
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

export function useLoans() {
  const [loans, setLoans] = useState<LoanWithMember[]>([]);
  const [installments, setInstallments] = useState<DbLoanInstallment[]>([]);
  const [schedule, setSchedule] = useState<DbLoanScheduleEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { settings } = useSettings();

  const fetchLoans = async () => {
    setIsLoading(true);
    try {
      const data = await dbQuery<LoanWithMember>(
        'SELECT l.*, m.name as member_name FROM public.loans l LEFT JOIN public.members m ON m.id = l.member_id ORDER BY l.created_at DESC'
      );
      setLoans(data);
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
      const termMonths = Math.max(1, Math.round(formData.term_months || 1));
      const rate = settings.applyLoanInterest ? settings.loanInterestRate : 0;
      const totalPayable = Math.round(formData.amount * (1 + rate / 100) * 100) / 100;

      const rows = await dbQuery<DbLoan>(
        'INSERT INTO public.loans (member_id, amount, remaining_amount, loan_date, status, term_months, interest_rate, total_payable) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
        [formData.member_id, formData.amount, totalPayable, formData.loan_date, 'active', termMonths, rate, totalPayable]
      );
      const loan = rows[0];

      if (loan) {
        const baseDate = parseLocalDate(formData.loan_date);
        const baseInstallment = Math.floor((totalPayable / termMonths) * 100) / 100;
        let allocated = 0;
        for (let i = 1; i <= termMonths; i++) {
          const dueAmount = i === termMonths ? Math.round((totalPayable - allocated) * 100) / 100 : baseInstallment;
          allocated += dueAmount;
          const dueDate = format(addMonths(baseDate, i), "yyyy-MM-dd");
          await dbQuery(
            'INSERT INTO public.loan_schedule (loan_id, installment_number, due_date, due_amount) VALUES ($1,$2,$3,$4)',
            [loan.id, i, dueDate, dueAmount]
          );
        }
      }

      toast({ title: "Loan Issued", description: `Loan of PKR ${formData.amount.toLocaleString()} has been issued.` });
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
      const loanRows = await dbQuery<DbLoan>('SELECT remaining_amount FROM public.loans WHERE id=$1', [formData.loan_id]);
      const loan = loanRows[0];
      if (!loan) { toast({ title: "Error", description: "Loan not found", variant: "destructive" }); return false; }
      if (formData.amount > loan.remaining_amount) { toast({ title: "Error", description: "Payment exceeds remaining balance", variant: "destructive" }); return false; }

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
        const newStatus = newPaid >= Number(row.due_amount) ? "paid" : "pending";
        await dbQuery('UPDATE public.loan_schedule SET paid_amount=$1, status=$2 WHERE id=$3', [newPaid, newStatus, row.id]);
        remainingPayment -= applied;
      }

      const newRemaining = loan.remaining_amount - formData.amount;
      const newStatus = newRemaining <= 0 ? 'paid' : 'active';
      await dbQuery('UPDATE public.loans SET remaining_amount=$1, status=$2 WHERE id=$3', [newRemaining, newStatus, formData.loan_id]);

      toast({ title: "Payment Recorded", description: `Payment of PKR ${formData.amount.toLocaleString()} has been recorded.` });
      await fetchLoans();
      await fetchInstallments(formData.loan_id);
      await fetchSchedule();
      return true;
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to record payment", variant: "destructive" });
      return false;
    }
  };

  const markDefaulted = async (loanId: string) => {
    try {
      await dbQuery('UPDATE public.loans SET status=$1 WHERE id=$2', ['defaulted', loanId]);
      toast({ title: "Loan Marked Defaulted", description: "This loan is now flagged as defaulted." });
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

  const getOverdueStats = () => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const overdueRows = schedule.filter(s => s.status === 'pending' && s.due_date < todayStr);
    const overdueLoanIds = new Set(overdueRows.map(s => s.loan_id));
    return {
      overdueCount: overdueLoanIds.size,
      overdueAmount: overdueRows.reduce((sum, s) => sum + (Number(s.due_amount) - Number(s.paid_amount)), 0),
      overdueLoanIds,
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
      totalRecovered: loans.reduce((s, l) => s + (Number(l.amount) - Number(l.remaining_amount)), 0),
      activeLoansCount: activeLoans.length,
      membersWithLoans: new Set(activeLoans.map(l => l.member_id)).size,
      overdueCount: overdue.overdueCount,
      overdueAmount: overdue.overdueAmount,
    };
  };

  useEffect(() => { fetchLoans(); fetchInstallments(); fetchSchedule(); }, []);

  return {
    loans, installments, schedule, isLoading,
    fetchLoans, fetchInstallments, fetchSchedule,
    issueLoan, recordPayment, markDefaulted,
    getLoansByMember, getActiveLoans, getLoanStats, getNextDueDate,
  };
}
