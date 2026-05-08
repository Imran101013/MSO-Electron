import { useState, useEffect } from "react";
import { dbQuery } from "@/lib/db";
import { useToast } from "@/hooks/use-toast";

export interface DbReserveTransaction {
  id: string;
  transaction_type: string;
  amount: number;
  donor_name: string | null;
  notes: string | null;
  transaction_date: string;
  created_at: string;
}

export interface ReserveTransactionFormData {
  transaction_type: string;
  amount: number;
  donor_name?: string;
  notes?: string;
  transaction_date: string;
}

export function useReserveTransactions() {
  const [transactions, setTransactions] = useState<DbReserveTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      const data = await dbQuery<DbReserveTransaction>('SELECT * FROM public.reserve_transactions ORDER BY transaction_date DESC');
      setTransactions(data);
    } catch {
      toast({ title: "Error", description: "Failed to load reserve transactions", variant: "destructive" });
    }
    setIsLoading(false);
  };

  const addTransaction = async (formData: ReserveTransactionFormData) => {
    try {
      const rows = await dbQuery<DbReserveTransaction>(
        'INSERT INTO public.reserve_transactions (transaction_type, amount, donor_name, notes, transaction_date) VALUES ($1,$2,$3,$4,$5) RETURNING *',
        [formData.transaction_type, formData.amount, formData.donor_name || null, formData.notes || null, formData.transaction_date]
      );
      toast({ title: "Transaction Added", description: `${formData.transaction_type} of PKR ${formData.amount.toLocaleString()} has been recorded.` });
      await fetchTransactions();
      return rows[0];
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to add transaction", variant: "destructive" });
      return null;
    }
  };

  const getReserveFundTotal = () => {
    return transactions.reduce((total, tx) => {
      if (tx.transaction_type === "donation" || tx.transaction_type === "profit_allocation") return total + Number(tx.amount);
      if (tx.transaction_type === "expense") return total - Number(tx.amount);
      return total;
    }, 0);
  };

  useEffect(() => { fetchTransactions(); }, []);

  return { transactions, isLoading, fetchTransactions, addTransaction, getReserveFundTotal };
}
