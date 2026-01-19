import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
    const { data, error } = await supabase
      .from("reserve_transactions")
      .select("*")
      .order("transaction_date", { ascending: false });

    if (error) {
      console.error("Error fetching reserve transactions:", error);
      toast({
        title: "Error",
        description: "Failed to load reserve transactions",
        variant: "destructive",
      });
    } else {
      setTransactions(data || []);
    }
    setIsLoading(false);
  };

  const addTransaction = async (formData: ReserveTransactionFormData) => {
    const { data, error } = await supabase
      .from("reserve_transactions")
      .insert({
        transaction_type: formData.transaction_type,
        amount: formData.amount,
        donor_name: formData.donor_name || null,
        notes: formData.notes || null,
        transaction_date: formData.transaction_date,
      })
      .select()
      .single();

    if (error) {
      console.error("Error adding transaction:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to add transaction",
        variant: "destructive",
      });
      return null;
    }

    toast({
      title: "Transaction Added",
      description: `${formData.transaction_type} of PKR ${formData.amount.toLocaleString()} has been recorded.`,
    });

    await fetchTransactions();
    return data;
  };

  const getReserveFundTotal = () => {
    return transactions.reduce((total, tx) => {
      if (tx.transaction_type === "donation" || tx.transaction_type === "profit_allocation") {
        return total + tx.amount;
      } else if (tx.transaction_type === "expense") {
        return total - tx.amount;
      }
      return total;
    }, 0);
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  return {
    transactions,
    isLoading,
    fetchTransactions,
    addTransaction,
    getReserveFundTotal,
  };
}
