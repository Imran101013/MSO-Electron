-- Documentation of schema changes for: one-year loans with a monthly late penalty.
--
-- NOTE: as with 20260721000000_loan_schedule_backup_audit.sql, the equivalent idempotent
-- DDL is applied at app startup by `ensureSchema()` in electron/main.cjs. This file is a
-- historical record only.
--
-- Loans run for 12 months. For each full month a loan's amount (principal + profit) is still
-- unpaid after that, a flat penalty is charged (see src/utils/loanPenalty.ts). The amount is
-- recorded on the loan when it is issued; existing loans take the Rs 500 default.

ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS penalty_per_month DECIMAL(12,2) NOT NULL DEFAULT 500;

-- One row per penalty month charged; loans.remaining_amount includes these charges.
CREATE TABLE IF NOT EXISTS public.loan_penalties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID REFERENCES public.loans(id) ON DELETE CASCADE NOT NULL,
  penalty_month INTEGER NOT NULL,
  charge_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (loan_id, penalty_month)
);

DROP TRIGGER IF EXISTS audit_loan_penalties ON public.loan_penalties;
CREATE TRIGGER audit_loan_penalties AFTER INSERT OR UPDATE OR DELETE ON public.loan_penalties
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
