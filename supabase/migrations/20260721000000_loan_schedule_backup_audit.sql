-- Documentation of schema changes for: loan repayment schedules/overdue tracking,
-- local backup/restore, and the financial audit log.
--
-- NOTE: this repo's local Postgres instance (see electron/main.cjs) is not driven by
-- the Supabase CLI/this migrations folder — the equivalent, idempotent DDL below is
-- actually applied at app startup by `ensureSchema()` in electron/main.cjs. This file
-- exists purely as a historical record, matching the existing convention in this folder.

ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS term_months INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS interest_rate DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS total_payable DECIMAL(12,2);
UPDATE public.loans SET total_payable = amount WHERE total_payable IS NULL;
ALTER TABLE public.loans ALTER COLUMN total_payable SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.loan_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID REFERENCES public.loans(id) ON DELETE CASCADE NOT NULL,
  installment_number INTEGER NOT NULL,
  due_date DATE NOT NULL,
  due_amount DECIMAL(12,2) NOT NULL,
  paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (loan_id, installment_number)
);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID,
  action TEXT NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
  changed_by TEXT,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  old_data JSONB,
  new_data JSONB
);

CREATE OR REPLACE FUNCTION public.audit_trigger_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  actor TEXT;
BEGIN
  actor := current_setting('app.current_user', true);
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log(table_name, record_id, action, changed_by, old_data)
    VALUES (TG_TABLE_NAME, OLD.id, 'delete', actor, row_to_json(OLD)::jsonb);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log(table_name, record_id, action, changed_by, old_data, new_data)
    VALUES (TG_TABLE_NAME, NEW.id, 'update', actor, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
    RETURN NEW;
  ELSE
    INSERT INTO public.audit_log(table_name, record_id, action, changed_by, new_data)
    VALUES (TG_TABLE_NAME, NEW.id, 'insert', actor, row_to_json(NEW)::jsonb);
    RETURN NEW;
  END IF;
END;
$$;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['loans', 'loan_installments', 'loan_schedule', 'monthly_contributions', 'reserve_transactions', 'profit_distributions', 'profit_allocations']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%s ON public.%s;', t, t);
    EXECUTE format('CREATE TRIGGER audit_%s AFTER INSERT OR UPDATE OR DELETE ON public.%s FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();', t, t);
  END LOOP;
END;
$$;
