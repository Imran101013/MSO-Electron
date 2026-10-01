import { useState, useEffect } from "react";
import { dbQuery } from "@/lib/db";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/contexts/SettingsContext";
import { cutoverBlock } from "@/lib/books";

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
  /** For an expense above the limit in Settings: the bank's charge on the cheque, paid by the reserve fund. */
  bank_charge?: number;
}

export function useReserveTransactions() {
  const [transactions, setTransactions] = useState<DbReserveTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { settings } = useSettings();

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
      const block = await cutoverBlock(formData.transaction_date, settings.dateFormat);
      if (block) { toast({ title: "Date is before the cut-over", description: block, variant: "destructive" }); return null; }
      // The bank's charge on an expense's cheque is a second expense the same day, so the reserve
      // fund (and Total Budget, the bank balance) go down by both, as the bank statement does.
      const charge = formData.transaction_type === 'expense' ? Math.round(Math.max(0, Number(formData.bank_charge) || 0) * 100) / 100 : 0;
      if (formData.transaction_type === 'expense') {
        const balance = getReserveFundTotal();
        if (formData.amount + charge > balance) {
          toast({ title: "Insufficient Balance", description: `Expense of ${settings.currency} ${(formData.amount + charge).toLocaleString()}${charge > 0 ? " (with the bank charge)" : ""} exceeds reserve balance of ${settings.currency} ${balance.toLocaleString()}.`, variant: "destructive" });
          return null;
        }
      }
      const what = [formData.donor_name, formData.notes].filter(Boolean).join(" - ") || "the expense";
      const rows = await dbQuery<DbReserveTransaction>(
        `INSERT INTO public.reserve_transactions (transaction_type, amount, donor_name, notes, transaction_date)
         SELECT * FROM (VALUES ($1, $2::numeric, $3, $4, $5::date), ('expense', $6::numeric, 'Bank', $7, $5::date)) AS v(t, a, d, n, dt)
         WHERE v.a > 0
         RETURNING *`,
        [formData.transaction_type, formData.amount, formData.donor_name || null, formData.notes || null, formData.transaction_date, charge, `Bank charge on the cheque withdrawal for ${what}`]
      );
      toast({ title: "Transaction Added", description: `${formData.transaction_type} of ${settings.currency} ${formData.amount.toLocaleString()} has been recorded.` });
      await fetchTransactions();
      return rows[0];
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to add transaction", variant: "destructive" });
      return null;
    }
  };

  const getReserveFundTotal = () => {
    return transactions.reduce((total, tx) => {
      if (tx.transaction_type === "donation" || tx.transaction_type === "profit_allocation" || tx.transaction_type === "opening") return total + Number(tx.amount);
      if (tx.transaction_type === "expense") return total - Number(tx.amount);
      return total;
    }, 0);
  };

  useEffect(() => { fetchTransactions(); }, []);

  return { transactions, isLoading, fetchTransactions, addTransaction, getReserveFundTotal };
}
