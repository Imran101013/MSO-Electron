import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useOrganization } from "@/contexts/OrganizationContext";
import { buildBooks } from "@/utils/accounting";
import { onMeetingSaved } from "@/lib/events";

/**
 * Total Budget: the money in the organisation's bank account today. Meeting collections are banked
 * straight away, so it is every amount received (the balance brought forward at the cut-over,
 * contributions, loan repayments, donations, bank profit) less every amount paid out (loans issued,
 * reserve fund expenses). It is the books' cash balance — the same figure as "Cash and cash
 * equivalents" in the Financial Statements.
 */
export function useTotalBudget(): { totalBudget: number; isLoading: boolean } {
  const { members, meetings, reserveTransactions, profitDistributions, bankProfits, openingProfit, refreshData } = useOrganization();
  const [isLoading, setIsLoading] = useState(true);

  // The organisation data loads once; refresh it so payments recorded on other pages are in.
  useEffect(() => {
    let active = true;
    refreshData()
      .catch(() => {})
      .finally(() => { if (active) setIsLoading(false); });
    const off = onMeetingSaved(() => { refreshData().catch(() => {}); });
    return () => { active = false; off(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalBudget = useMemo(
    () => buildBooks({ members, meetings, reserveTransactions, profitDistributions, bankProfits, openingProfit }).balancesAt(format(new Date(), "yyyy-MM-dd")).cash,
    [members, meetings, reserveTransactions, profitDistributions, bankProfits, openingProfit],
  );
  return { totalBudget, isLoading };
}
