-- useProfitDistributions.ts records the reserve-fund side effect of a profit
-- distribution as a reserve_transactions row with transaction_type =
-- 'profit_allocation' (also handled as a positive amount alongside 'donation'
-- in useReserveTransactions.ts's getReserveFundTotal). The original check
-- constraint only allowed 'donation' | 'expense', so every "Distribute Profit"
-- action failed on this insert after the distribution and member-budget
-- updates had already been committed, silently undercounting the reserve fund.
ALTER TABLE public.reserve_transactions DROP CONSTRAINT reserve_transactions_transaction_type_check;
ALTER TABLE public.reserve_transactions ADD CONSTRAINT reserve_transactions_transaction_type_check
  CHECK (transaction_type = ANY (ARRAY['donation'::text, 'expense'::text, 'profit_allocation'::text]));
