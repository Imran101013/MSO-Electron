import { useState, useEffect } from "react";
import { dbQuery } from "@/lib/db";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/contexts/SettingsContext";
import { cutoverBlock } from "@/lib/books";
import type { YearEndPlan } from "@/utils/yearEndProfit";

export interface DbProfitDistribution {
  id: string;
  distribution_date: string;
  /** The year's total profit: bank profit + loan interest + late penalties collected. */
  total_profit: number;
  /** The reserve fund's share of the total. */
  reserve_allocation: number;
  /** Set on year-end distributions; null on earlier bank-profit-only ones. */
  profit_year?: number | null;
  bank_profit?: number | null;
  loan_interest?: number;
  loan_penalties?: number;
  absence_penalties?: number;
  absence_fine?: number | null;
  /** The bank profit came from the year's recorded bank profit entries (hooks/useBankProfits.ts). */
  bank_profit_recorded?: boolean;
  created_at: string;
}

export interface DbProfitAllocation {
  id: string;
  distribution_id: string;
  member_id: string;
  /** The dividend credited to the member's savings (after any absence penalty). */
  amount: number;
  ratio: number;
  gross_amount?: number | null;
  absences?: number;
  absence_penalty?: number;
  savings_basis?: number | null;
  created_at: string;
}

export function useProfitDistributions() {
  const [distributions, setDistributions] = useState<DbProfitDistribution[]>([]);
  const [allocations, setAllocations] = useState<DbProfitAllocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { settings } = useSettings();

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

  /**
   * Records an annual distribution (utils/yearEndProfit.ts) in one statement, so it lands in full
   * or not at all: the distribution, one line per member, each member's savings credited with their
   * dividend, and the reserve fund's share.
   */
  const recordYearEnd = async (plan: YearEndPlan, distributionDate: string) => {
    try {
      const block = await cutoverBlock(distributionDate, settings.dateFormat);
      if (block) { toast({ title: "Date is before the cut-over", description: block, variant: "destructive" }); return null; }
      if (plan.problems.length > 0) { toast({ title: "Can't distribute yet", description: plan.problems[0], variant: "destructive" }); return null; }

      const existing = await dbQuery<{ id: string }>(
        "SELECT id FROM public.profit_distributions WHERE profit_year = $1 OR (profit_year IS NULL AND EXTRACT(year FROM distribution_date::date) = $1)",
        [plan.year]
      );
      if (existing.length > 0) {
        toast({ title: "Already Distributed", description: `The profit for ${plan.year} has already been distributed.`, variant: "destructive" });
        return null;
      }
      // The bank profit is the year's recorded bank profit entries (hooks/useBankProfits.ts); make
      // sure none was added or removed since the figures on screen were worked out.
      const [recorded] = await dbQuery<{ total: number }>(
        "SELECT COALESCE(SUM(amount), 0) AS total FROM public.bank_profits WHERE profit_year = $1",
        [plan.year]
      );
      if (Math.abs(Number(recorded?.total || 0) - plan.bankProfit) > 0.005) {
        toast({ title: "Bank profit has changed", description: `The bank profit recorded for ${plan.year} is now ${settings.currency} ${Number(recorded?.total || 0).toLocaleString()}. Check the figures again before distributing.`, variant: "destructive" });
        return null;
      }

      const rows = plan.rows;
      const [result] = await dbQuery<{ id: string }>(
        `WITH d AS (
           INSERT INTO public.profit_distributions
             (distribution_date, total_profit, reserve_allocation, profit_year, bank_profit, loan_interest, loan_penalties, absence_penalties, absence_fine, bank_profit_recorded)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true) RETURNING id
         ),
         a AS (
           INSERT INTO public.profit_allocations (distribution_id, member_id, amount, ratio, gross_amount, absences, absence_penalty, savings_basis)
           SELECT d.id, t.member_id, t.amount, t.ratio, t.gross, t.absences, t.penalty, t.savings
           FROM d, unnest($10::uuid[], $11::numeric[], $12::numeric[], $13::numeric[], $14::int[], $15::numeric[], $16::numeric[])
             AS t(member_id, amount, ratio, gross, absences, penalty, savings)
           RETURNING member_id, amount
         ),
         m AS (
           UPDATE public.members SET total_budget = COALESCE(members.total_budget, 0) + a.amount
           FROM a WHERE members.id = a.member_id RETURNING members.id
         ),
         r AS (
           INSERT INTO public.reserve_transactions (transaction_type, amount, donor_name, notes, transaction_date)
           SELECT 'profit_allocation', x.amount, 'Year-end profit distribution', x.note, $1
           FROM unnest($17::numeric[], $18::text[]) AS x(amount, note) WHERE x.amount > 0
           RETURNING id
         )
         SELECT (SELECT id FROM d) AS id, (SELECT COUNT(*) FROM a) AS allocations, (SELECT COUNT(*) FROM m) AS members, (SELECT COUNT(*) FROM r) AS reserve`,
        [
          distributionDate, plan.totalProfit, plan.reserve, plan.year, plan.bankProfit, plan.loanInterest, plan.loanPenalties, plan.absencePenalties, plan.absenceFine,
          rows.map((x) => x.memberId), rows.map((x) => x.dividend), rows.map((x) => x.ratio), rows.map((x) => x.gross),
          rows.map((x) => x.absences), rows.map((x) => x.penalty), rows.map((x) => x.savings),
          [plan.reserve],
          [`Reserve share (${plan.reservePercent}%) of the ${plan.year} profit`],
        ]
      );

      toast({
        title: "Profit Distributed",
        description: `${settings.currency} ${plan.totalProfit.toLocaleString()} for ${plan.year}: ${settings.currency} ${plan.dividends.toLocaleString()} to ${rows.length} member(s), ${settings.currency} ${plan.reserve.toLocaleString()} to the reserve fund.`,
      });
      await fetchDistributions();
      return result ?? null;
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to distribute profit", variant: "destructive" });
      return null;
    }
  };

  useEffect(() => { fetchDistributions(); }, []);

  return { distributions, allocations, isLoading, fetchDistributions, recordYearEnd };
}
