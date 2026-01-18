import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
    const { data, error } = await supabase
      .from("loans")
      .select("*, members(name)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching loans:", error);
      toast({
        title: "Error",
        description: "Failed to load loans",
        variant: "destructive",
      });
    } else {
      const loansWithMembers = (data || []).map((loan: any) => ({
        ...loan,
        member_name: loan.members?.name,
      }));
      setLoans(loansWithMembers);
    }
    setIsLoading(false);
  };

  const fetchInstallments = async (loanId?: string) => {
    let query = supabase.from("loan_installments").select("*");
    
    if (loanId) {
      query = query.eq("loan_id", loanId);
    }

    const { data, error } = await query.order("payment_date", { ascending: false });

    if (error) {
      console.error("Error fetching installments:", error);
    } else {
      setInstallments(data || []);
    }
  };

  const issueLoan = async (formData: LoanFormData) => {
    const { data, error } = await supabase
      .from("loans")
      .insert({
        member_id: formData.member_id,
        amount: formData.amount,
        remaining_amount: formData.amount,
        loan_date: formData.loan_date,
        status: "active",
      })
      .select()
      .single();

    if (error) {
      console.error("Error issuing loan:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to issue loan",
        variant: "destructive",
      });
      return null;
    }

    toast({
      title: "Loan Issued",
      description: `Loan of PKR ${formData.amount.toLocaleString()} has been issued.`,
    });

    await fetchLoans();
    return data;
  };

  const recordPayment = async (formData: InstallmentFormData) => {
    // Get current loan
    const { data: loan, error: loanError } = await supabase
      .from("loans")
      .select("remaining_amount, amount")
      .eq("id", formData.loan_id)
      .single();

    if (loanError || !loan) {
      toast({
        title: "Error",
        description: "Loan not found",
        variant: "destructive",
      });
      return false;
    }

    if (formData.amount > loan.remaining_amount) {
      toast({
        title: "Error",
        description: "Payment amount exceeds remaining balance",
        variant: "destructive",
      });
      return false;
    }

    // Insert installment
    const { error: installmentError } = await supabase
      .from("loan_installments")
      .insert({
        loan_id: formData.loan_id,
        amount: formData.amount,
        payment_date: formData.payment_date,
      });

    if (installmentError) {
      console.error("Error recording payment:", installmentError);
      toast({
        title: "Error",
        description: installmentError.message || "Failed to record payment",
        variant: "destructive",
      });
      return false;
    }

    // Update loan remaining amount
    const newRemaining = loan.remaining_amount - formData.amount;
    const newStatus = newRemaining <= 0 ? "paid" : "active";

    const { error: updateError } = await supabase
      .from("loans")
      .update({
        remaining_amount: newRemaining,
        status: newStatus,
      })
      .eq("id", formData.loan_id);

    if (updateError) {
      console.error("Error updating loan:", updateError);
      toast({
        title: "Error",
        description: updateError.message || "Failed to update loan",
        variant: "destructive",
      });
      return false;
    }

    toast({
      title: "Payment Recorded",
      description: `Payment of PKR ${formData.amount.toLocaleString()} has been recorded.`,
    });

    await fetchLoans();
    await fetchInstallments(formData.loan_id);
    return true;
  };

  const getLoansByMember = async (memberId: string) => {
    const { data, error } = await supabase
      .from("loans")
      .select("*")
      .eq("member_id", memberId)
      .order("loan_date", { ascending: false });

    if (error) {
      console.error("Error fetching member loans:", error);
      return [];
    }

    return data || [];
  };

  const getActiveLoans = () => {
    return loans.filter(loan => loan.status === "active");
  };

  const getLoanStats = () => {
    const activeLoans = getActiveLoans();
    const totalOutstanding = activeLoans.reduce((sum, loan) => sum + loan.remaining_amount, 0);
    const totalIssued = loans.reduce((sum, loan) => sum + loan.amount, 0);
    const totalRecovered = totalIssued - loans.reduce((sum, loan) => sum + loan.remaining_amount, 0);
    const membersWithLoans = new Set(activeLoans.map(l => l.member_id)).size;

    return {
      totalOutstanding,
      totalIssued,
      totalRecovered,
      activeLoansCount: activeLoans.length,
      membersWithLoans,
    };
  };

  useEffect(() => {
    fetchLoans();
    fetchInstallments();
  }, []);

  return {
    loans,
    installments,
    isLoading,
    fetchLoans,
    fetchInstallments,
    issueLoan,
    recordPayment,
    getLoansByMember,
    getActiveLoans,
    getLoanStats,
  };
}
