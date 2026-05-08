import { useState, useEffect } from "react";
import { dbQuery } from "@/lib/db";
import { useToast } from "@/hooks/use-toast";

export interface DbLoan {
  id: string;
  member_id: string;
  amount: number;
  remaining_amount: number;
  loan_date: string;
  status: string;
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

export interface LoanWithMember extends DbLoan {
  member_name?: string;
}

export interface LoanFormData {
  member_id: string;
  amount: number;
  loan_date: string;
}

export interface InstallmentFormData {
  loan_id: string;
  amount: number;
  payment_date: string;
}

export function useLoans() {
  const [loans, setLoans] = useState<LoanWithMember[]>([]);
  const [installments, setInstallments] = useState<DbLoanInstallment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

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

  const issueLoan = async (formData: LoanFormData) => {
    try {
      const rows = await dbQuery<DbLoan>(
        'INSERT INTO public.loans (member_id, amount, remaining_amount, loan_date, status) VALUES ($1,$2,$2,$3,$4) RETURNING *',
        [formData.member_id, formData.amount, formData.loan_date, 'active']
      );
      toast({ title: "Loan Issued", description: `Loan of PKR ${formData.amount.toLocaleString()} has been issued.` });
      await fetchLoans();
      return rows[0];
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

      const newRemaining = loan.remaining_amount - formData.amount;
      const newStatus = newRemaining <= 0 ? 'paid' : 'active';
      await dbQuery('UPDATE public.loans SET remaining_amount=$1, status=$2 WHERE id=$3', [newRemaining, newStatus, formData.loan_id]);

      toast({ title: "Payment Recorded", description: `Payment of PKR ${formData.amount.toLocaleString()} has been recorded.` });
      await fetchLoans();
      await fetchInstallments(formData.loan_id);
      return true;
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to record payment", variant: "destructive" });
      return false;
    }
  };

  const getLoansByMember = async (memberId: string) => {
    try {
      return await dbQuery<DbLoan>('SELECT * FROM public.loans WHERE member_id=$1 ORDER BY loan_date DESC', [memberId]);
    } catch { return []; }
  };

  const getActiveLoans = () => loans.filter(l => l.status === 'active');

  const getLoanStats = () => {
    const activeLoans = getActiveLoans();
    return {
      totalOutstanding: activeLoans.reduce((s, l) => s + Number(l.remaining_amount), 0),
      totalIssued: loans.reduce((s, l) => s + Number(l.amount), 0),
      totalRecovered: loans.reduce((s, l) => s + (Number(l.amount) - Number(l.remaining_amount)), 0),
      activeLoansCount: activeLoans.length,
      membersWithLoans: new Set(activeLoans.map(l => l.member_id)).size,
    };
  };

  useEffect(() => { fetchLoans(); fetchInstallments(); }, []);

  return { loans, installments, isLoading, fetchLoans, fetchInstallments, issueLoan, recordPayment, getLoansByMember, getActiveLoans, getLoanStats };
}
