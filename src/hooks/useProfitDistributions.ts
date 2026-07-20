import { useState, useEffect } from "react";
import { dbQuery } from "@/lib/db";
import { useToast } from "@/hooks/use-toast";

export interface DbProfitDistribution {
  id: string;
  distribution_date: string;
  total_profit: number;
  reserve_allocation: number;
  created_at: string;
}

export interface DbProfitAllocation {
  id: string;
  distribution_id: string;
  member_id: string;
  amount: number;
  ratio: number;
  created_at: string;
}

export interface MemberAllocationInput {
  memberId: string;
  amount: number;
  ratio: number;
}

export function useProfitDistributions() {
  const [distributions, setDistributions] = useState<DbProfitDistribution[]>([]);
  const [allocations, setAllocations] = useState<DbProfitAllocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchDistributions = async () => {
    setIsLoading(true);
    try {
      const [dists, allocs] = await Promise.all([
        dbQuery<DbProfitDistribution>('SELECT * FROM public.profit_distributions ORDER BY distribution_date DESC'),
        dbQuery<DbProfitAllocation>('SELECT * FROM public.profit_allocations ORDER BY created_at DESC'),
      ]);
      setDistributions(dists);
      setAllocations(allocs);
    } catch {
      toast({ title: "Error", description: "Failed to load profit distributions", variant: "destructive" });
    }
    setIsLoading(false);
  };

  // Records a profit distribution: the distribution header, one allocation row per
  // member, the corresponding reserve-fund transaction, and each member's budget bump.
  // Not wrapped in a DB transaction (the db-query IPC channel runs one statement per
  // call) — matches the existing bulk-write convention used by useContributions/useAttendance.
  const recordDistribution = async (
    totalProfit: number,
    reserveAllocation: number,
    distributionDate: string,
    memberAllocations: MemberAllocationInput[]
  ) => {
    try {
      const distRows = await dbQuery<DbProfitDistribution>(
        'INSERT INTO public.profit_distributions (distribution_date, total_profit, reserve_allocation) VALUES ($1,$2,$3) RETURNING *',
        [distributionDate, totalProfit, reserveAllocation]
      );
      const distribution = distRows[0];

      for (const alloc of memberAllocations) {
        await dbQuery(
          'INSERT INTO public.profit_allocations (distribution_id, member_id, amount, ratio) VALUES ($1,$2,$3,$4)',
          [distribution.id, alloc.memberId, alloc.amount, alloc.ratio]
        );
        await dbQuery(
          'UPDATE public.members SET total_budget = total_budget + $1 WHERE id = $2',
          [alloc.amount, alloc.memberId]
        );
      }

      await dbQuery(
        'INSERT INTO public.reserve_transactions (transaction_type, amount, donor_name, notes, transaction_date) VALUES ($1,$2,$3,$4,$5)',
        [
          'profit_allocation',
          reserveAllocation,
          'Yearly Profit Distribution',
          `10% allocation from yearly profit of PKR ${totalProfit.toLocaleString()}`,
          distributionDate,
        ]
      );

      toast({
        title: "Profit Distributed",
        description: `PKR ${totalProfit.toLocaleString()} distributed across ${memberAllocations.length} member(s).`,
      });
      await fetchDistributions();
      return distribution;
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to distribute profit", variant: "destructive" });
      return null;
    }
  };

  useEffect(() => { fetchDistributions(); }, []);

  return { distributions, allocations, isLoading, fetchDistributions, recordDistribution };
}
