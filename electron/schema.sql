-- The MSO database structure (tables, functions, triggers), with no records in it.
-- electron/main.cjs runs this once, on first start, when the database has no tables yet.
-- Made with pg_dump --schema-only --no-owner --no-privileges --no-comments from mso-db,
-- with the psql commands and session settings taken out so it runs through pg.
-- Newer columns and tables are added by ensureSchema() in main.cjs on every start, so this
-- file only needs regenerating when fresh installs should get the newest shape at once.
--
-- PostgreSQL database dump
--

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'member'
);

--
-- Name: audit_trigger_fn(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_trigger_fn() RETURNS trigger
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

--
-- Name: note_data_change_fn(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.note_data_change_fn() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        UPDATE public.data_last_changed SET changed_at = clock_timestamp() WHERE id;
        RETURN NULL;
      END;
      $$;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

--
-- Name: app_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_config (
    key text NOT NULL,
    value text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: attendance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    member_id uuid NOT NULL,
    meeting_id uuid NOT NULL,
    present boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    on_leave boolean DEFAULT false NOT NULL
);

--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    table_name text NOT NULL,
    record_id uuid,
    action text NOT NULL,
    changed_by text,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    old_data jsonb,
    new_data jsonb,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['insert'::text, 'update'::text, 'delete'::text])))
);

--
-- Name: bank_profits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_profits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    meeting_id uuid,
    amount numeric(12,2) NOT NULL,
    credited_on date NOT NULL,
    profit_year integer NOT NULL,
    is_opening boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bank_profits_amount_check CHECK ((amount > (0)::numeric))
);

--
-- Name: data_last_changed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_last_changed (
    id boolean DEFAULT true NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT data_last_changed_id_check CHECK (id)
);

--
-- Name: loan_installments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loan_installments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    loan_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    payment_date date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: loan_penalties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loan_penalties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    loan_id uuid NOT NULL,
    penalty_month integer NOT NULL,
    charge_date date NOT NULL,
    amount numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: loan_schedule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loan_schedule (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    loan_id uuid NOT NULL,
    installment_number integer NOT NULL,
    due_date date NOT NULL,
    due_amount numeric(12,2) NOT NULL,
    paid_amount numeric(12,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT loan_schedule_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text])))
);

--
-- Name: loans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    member_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    remaining_amount numeric(12,2) NOT NULL,
    loan_date date DEFAULT CURRENT_DATE NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    term_months integer DEFAULT 12 NOT NULL,
    interest_rate numeric(5,2) DEFAULT 0 NOT NULL,
    total_payable numeric(12,2) NOT NULL,
    penalty_per_month numeric(12,2) DEFAULT 500 NOT NULL,
    opening_as_at date,
    defaulted_on date,
    bank_charge numeric(12,2) DEFAULT 0 NOT NULL,
    CONSTRAINT loans_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paid'::text, 'defaulted'::text])))
);

--
-- Name: meetings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meetings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    meeting_date date NOT NULL,
    agenda text NOT NULL,
    decisions text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    venue text
);

--
-- Name: members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    name text NOT NULL,
    father_name text NOT NULL,
    dob date,
    email text,
    phone text,
    address text,
    join_date date DEFAULT CURRENT_DATE NOT NULL,
    profile_picture text,
    total_budget numeric(12,2) DEFAULT 0,
    is_approved boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    login_password text,
    is_opening boolean DEFAULT false NOT NULL
);

--
-- Name: monthly_contributions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.monthly_contributions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    member_id uuid NOT NULL,
    contribution_date date NOT NULL,
    amount numeric(12,2) NOT NULL,
    meeting_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    is_opening boolean DEFAULT false NOT NULL
);

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    full_name text,
    phone text,
    email text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: profit_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profit_allocations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    distribution_id uuid NOT NULL,
    member_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    ratio numeric(5,4) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    gross_amount numeric(12,2),
    absences integer DEFAULT 0 NOT NULL,
    absence_penalty numeric(12,2) DEFAULT 0 NOT NULL,
    savings_basis numeric(12,2)
);

--
-- Name: profit_distributions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profit_distributions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    distribution_date date NOT NULL,
    total_profit numeric(12,2) NOT NULL,
    reserve_allocation numeric(12,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    profit_year integer,
    bank_profit numeric(12,2),
    loan_interest numeric(12,2) DEFAULT 0 NOT NULL,
    loan_penalties numeric(12,2) DEFAULT 0 NOT NULL,
    absence_penalties numeric(12,2) DEFAULT 0 NOT NULL,
    absence_fine numeric(12,2),
    bank_profit_recorded boolean DEFAULT false NOT NULL
);

--
-- Name: reserve_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reserve_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    transaction_type text NOT NULL,
    amount numeric(12,2) NOT NULL,
    transaction_date date DEFAULT CURRENT_DATE NOT NULL,
    donor_name text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reserve_transactions_transaction_type_check CHECK ((transaction_type = ANY (ARRAY['donation'::text, 'expense'::text, 'profit_allocation'::text, 'opening'::text])))
);

--
-- Name: upcoming_meetings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.upcoming_meetings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    meeting_date date NOT NULL,
    meeting_time time without time zone,
    venue text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role DEFAULT 'member'::public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    full_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: app_config app_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_config
    ADD CONSTRAINT app_config_pkey PRIMARY KEY (key);

--
-- Name: attendance attendance_member_id_meeting_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_member_id_meeting_id_key UNIQUE (member_id, meeting_id);

--
-- Name: attendance attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_pkey PRIMARY KEY (id);

--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);

--
-- Name: bank_profits bank_profits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_profits
    ADD CONSTRAINT bank_profits_pkey PRIMARY KEY (id);

--
-- Name: data_last_changed data_last_changed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_last_changed
    ADD CONSTRAINT data_last_changed_pkey PRIMARY KEY (id);

--
-- Name: loan_installments loan_installments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loan_installments
    ADD CONSTRAINT loan_installments_pkey PRIMARY KEY (id);

--
-- Name: loan_penalties loan_penalties_loan_id_penalty_month_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loan_penalties
    ADD CONSTRAINT loan_penalties_loan_id_penalty_month_key UNIQUE (loan_id, penalty_month);

--
-- Name: loan_penalties loan_penalties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loan_penalties
    ADD CONSTRAINT loan_penalties_pkey PRIMARY KEY (id);

--
-- Name: loan_schedule loan_schedule_loan_id_installment_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loan_schedule
    ADD CONSTRAINT loan_schedule_loan_id_installment_number_key UNIQUE (loan_id, installment_number);

--
-- Name: loan_schedule loan_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loan_schedule
    ADD CONSTRAINT loan_schedule_pkey PRIMARY KEY (id);

--
-- Name: loans loans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loans
    ADD CONSTRAINT loans_pkey PRIMARY KEY (id);

--
-- Name: meetings meetings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT meetings_pkey PRIMARY KEY (id);

--
-- Name: members members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT members_pkey PRIMARY KEY (id);

--
-- Name: monthly_contributions monthly_contributions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_contributions
    ADD CONSTRAINT monthly_contributions_pkey PRIMARY KEY (id);

--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);

--
-- Name: profit_allocations profit_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profit_allocations
    ADD CONSTRAINT profit_allocations_pkey PRIMARY KEY (id);

--
-- Name: profit_distributions profit_distributions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profit_distributions
    ADD CONSTRAINT profit_distributions_pkey PRIMARY KEY (id);

--
-- Name: reserve_transactions reserve_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reserve_transactions
    ADD CONSTRAINT reserve_transactions_pkey PRIMARY KEY (id);

--
-- Name: upcoming_meetings upcoming_meetings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upcoming_meetings
    ADD CONSTRAINT upcoming_meetings_pkey PRIMARY KEY (id);

--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);

--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);

--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);

--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

--
-- Name: bank_profits_year_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bank_profits_year_idx ON public.bank_profits USING btree (profit_year);

--
-- Name: profit_distributions_year_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profit_distributions_year_key ON public.profit_distributions USING btree (profit_year) WHERE (profit_year IS NOT NULL);

--
-- Name: attendance audit_attendance; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_attendance AFTER INSERT OR DELETE OR UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

--
-- Name: bank_profits audit_bank_profits; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_bank_profits AFTER INSERT OR DELETE OR UPDATE ON public.bank_profits FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

--
-- Name: loan_installments audit_loan_installments; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_loan_installments AFTER INSERT OR DELETE OR UPDATE ON public.loan_installments FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

--
-- Name: loan_penalties audit_loan_penalties; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_loan_penalties AFTER INSERT OR DELETE OR UPDATE ON public.loan_penalties FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

--
-- Name: loan_schedule audit_loan_schedule; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_loan_schedule AFTER INSERT OR DELETE OR UPDATE ON public.loan_schedule FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

--
-- Name: loans audit_loans; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_loans AFTER INSERT OR DELETE OR UPDATE ON public.loans FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

--
-- Name: monthly_contributions audit_monthly_contributions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_monthly_contributions AFTER INSERT OR DELETE OR UPDATE ON public.monthly_contributions FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

--
-- Name: profit_allocations audit_profit_allocations; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_profit_allocations AFTER INSERT OR DELETE OR UPDATE ON public.profit_allocations FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

--
-- Name: profit_distributions audit_profit_distributions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_profit_distributions AFTER INSERT OR DELETE OR UPDATE ON public.profit_distributions FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

--
-- Name: reserve_transactions audit_reserve_transactions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_reserve_transactions AFTER INSERT OR DELETE OR UPDATE ON public.reserve_transactions FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

--
-- Name: app_config note_change_app_config; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_change_app_config AFTER INSERT OR DELETE ON public.app_config FOR EACH ROW EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: attendance note_change_attendance; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_change_attendance AFTER INSERT OR DELETE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: audit_log note_change_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_change_audit_log AFTER INSERT OR DELETE ON public.audit_log FOR EACH ROW EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: bank_profits note_change_bank_profits; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_change_bank_profits AFTER INSERT OR DELETE ON public.bank_profits FOR EACH ROW EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: loan_installments note_change_loan_installments; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_change_loan_installments AFTER INSERT OR DELETE ON public.loan_installments FOR EACH ROW EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: loan_penalties note_change_loan_penalties; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_change_loan_penalties AFTER INSERT OR DELETE ON public.loan_penalties FOR EACH ROW EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: loan_schedule note_change_loan_schedule; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_change_loan_schedule AFTER INSERT OR DELETE ON public.loan_schedule FOR EACH ROW EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: loans note_change_loans; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_change_loans AFTER INSERT OR DELETE ON public.loans FOR EACH ROW EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: meetings note_change_meetings; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_change_meetings AFTER INSERT OR DELETE ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: members note_change_members; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_change_members AFTER INSERT OR DELETE ON public.members FOR EACH ROW EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: monthly_contributions note_change_monthly_contributions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_change_monthly_contributions AFTER INSERT OR DELETE ON public.monthly_contributions FOR EACH ROW EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: profit_allocations note_change_profit_allocations; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_change_profit_allocations AFTER INSERT OR DELETE ON public.profit_allocations FOR EACH ROW EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: profit_distributions note_change_profit_distributions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_change_profit_distributions AFTER INSERT OR DELETE ON public.profit_distributions FOR EACH ROW EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: reserve_transactions note_change_reserve_transactions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_change_reserve_transactions AFTER INSERT OR DELETE ON public.reserve_transactions FOR EACH ROW EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: upcoming_meetings note_change_upcoming_meetings; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_change_upcoming_meetings AFTER INSERT OR DELETE ON public.upcoming_meetings FOR EACH ROW EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: user_roles note_change_user_roles; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_change_user_roles AFTER INSERT OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: users note_change_users; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_change_users AFTER INSERT OR DELETE ON public.users FOR EACH ROW EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: app_config note_truncate_app_config; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_truncate_app_config AFTER TRUNCATE ON public.app_config FOR EACH STATEMENT EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: attendance note_truncate_attendance; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_truncate_attendance AFTER TRUNCATE ON public.attendance FOR EACH STATEMENT EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: audit_log note_truncate_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_truncate_audit_log AFTER TRUNCATE ON public.audit_log FOR EACH STATEMENT EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: bank_profits note_truncate_bank_profits; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_truncate_bank_profits AFTER TRUNCATE ON public.bank_profits FOR EACH STATEMENT EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: loan_installments note_truncate_loan_installments; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_truncate_loan_installments AFTER TRUNCATE ON public.loan_installments FOR EACH STATEMENT EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: loan_penalties note_truncate_loan_penalties; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_truncate_loan_penalties AFTER TRUNCATE ON public.loan_penalties FOR EACH STATEMENT EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: loan_schedule note_truncate_loan_schedule; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_truncate_loan_schedule AFTER TRUNCATE ON public.loan_schedule FOR EACH STATEMENT EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: loans note_truncate_loans; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_truncate_loans AFTER TRUNCATE ON public.loans FOR EACH STATEMENT EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: meetings note_truncate_meetings; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_truncate_meetings AFTER TRUNCATE ON public.meetings FOR EACH STATEMENT EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: members note_truncate_members; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_truncate_members AFTER TRUNCATE ON public.members FOR EACH STATEMENT EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: monthly_contributions note_truncate_monthly_contributions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_truncate_monthly_contributions AFTER TRUNCATE ON public.monthly_contributions FOR EACH STATEMENT EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: profit_allocations note_truncate_profit_allocations; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_truncate_profit_allocations AFTER TRUNCATE ON public.profit_allocations FOR EACH STATEMENT EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: profit_distributions note_truncate_profit_distributions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_truncate_profit_distributions AFTER TRUNCATE ON public.profit_distributions FOR EACH STATEMENT EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: reserve_transactions note_truncate_reserve_transactions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_truncate_reserve_transactions AFTER TRUNCATE ON public.reserve_transactions FOR EACH STATEMENT EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: upcoming_meetings note_truncate_upcoming_meetings; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_truncate_upcoming_meetings AFTER TRUNCATE ON public.upcoming_meetings FOR EACH STATEMENT EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: user_roles note_truncate_user_roles; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_truncate_user_roles AFTER TRUNCATE ON public.user_roles FOR EACH STATEMENT EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: users note_truncate_users; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_truncate_users AFTER TRUNCATE ON public.users FOR EACH STATEMENT EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: app_config note_update_app_config; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_update_app_config AFTER UPDATE ON public.app_config FOR EACH ROW WHEN (((to_jsonb(old.*) - 'updated_at'::text) IS DISTINCT FROM (to_jsonb(new.*) - 'updated_at'::text))) EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: attendance note_update_attendance; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_update_attendance AFTER UPDATE ON public.attendance FOR EACH ROW WHEN (((to_jsonb(old.*) - 'updated_at'::text) IS DISTINCT FROM (to_jsonb(new.*) - 'updated_at'::text))) EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: audit_log note_update_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_update_audit_log AFTER UPDATE ON public.audit_log FOR EACH ROW WHEN (((to_jsonb(old.*) - 'updated_at'::text) IS DISTINCT FROM (to_jsonb(new.*) - 'updated_at'::text))) EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: bank_profits note_update_bank_profits; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_update_bank_profits AFTER UPDATE ON public.bank_profits FOR EACH ROW WHEN (((to_jsonb(old.*) - 'updated_at'::text) IS DISTINCT FROM (to_jsonb(new.*) - 'updated_at'::text))) EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: loan_installments note_update_loan_installments; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_update_loan_installments AFTER UPDATE ON public.loan_installments FOR EACH ROW WHEN (((to_jsonb(old.*) - 'updated_at'::text) IS DISTINCT FROM (to_jsonb(new.*) - 'updated_at'::text))) EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: loan_penalties note_update_loan_penalties; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_update_loan_penalties AFTER UPDATE ON public.loan_penalties FOR EACH ROW WHEN (((to_jsonb(old.*) - 'updated_at'::text) IS DISTINCT FROM (to_jsonb(new.*) - 'updated_at'::text))) EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: loan_schedule note_update_loan_schedule; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_update_loan_schedule AFTER UPDATE ON public.loan_schedule FOR EACH ROW WHEN (((to_jsonb(old.*) - 'updated_at'::text) IS DISTINCT FROM (to_jsonb(new.*) - 'updated_at'::text))) EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: loans note_update_loans; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_update_loans AFTER UPDATE ON public.loans FOR EACH ROW WHEN (((to_jsonb(old.*) - 'updated_at'::text) IS DISTINCT FROM (to_jsonb(new.*) - 'updated_at'::text))) EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: meetings note_update_meetings; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_update_meetings AFTER UPDATE ON public.meetings FOR EACH ROW WHEN (((to_jsonb(old.*) - 'updated_at'::text) IS DISTINCT FROM (to_jsonb(new.*) - 'updated_at'::text))) EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: members note_update_members; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_update_members AFTER UPDATE ON public.members FOR EACH ROW WHEN (((to_jsonb(old.*) - 'updated_at'::text) IS DISTINCT FROM (to_jsonb(new.*) - 'updated_at'::text))) EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: monthly_contributions note_update_monthly_contributions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_update_monthly_contributions AFTER UPDATE ON public.monthly_contributions FOR EACH ROW WHEN (((to_jsonb(old.*) - 'updated_at'::text) IS DISTINCT FROM (to_jsonb(new.*) - 'updated_at'::text))) EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: profit_allocations note_update_profit_allocations; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_update_profit_allocations AFTER UPDATE ON public.profit_allocations FOR EACH ROW WHEN (((to_jsonb(old.*) - 'updated_at'::text) IS DISTINCT FROM (to_jsonb(new.*) - 'updated_at'::text))) EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: profit_distributions note_update_profit_distributions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_update_profit_distributions AFTER UPDATE ON public.profit_distributions FOR EACH ROW WHEN (((to_jsonb(old.*) - 'updated_at'::text) IS DISTINCT FROM (to_jsonb(new.*) - 'updated_at'::text))) EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: reserve_transactions note_update_reserve_transactions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_update_reserve_transactions AFTER UPDATE ON public.reserve_transactions FOR EACH ROW WHEN (((to_jsonb(old.*) - 'updated_at'::text) IS DISTINCT FROM (to_jsonb(new.*) - 'updated_at'::text))) EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: upcoming_meetings note_update_upcoming_meetings; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_update_upcoming_meetings AFTER UPDATE ON public.upcoming_meetings FOR EACH ROW WHEN (((to_jsonb(old.*) - 'updated_at'::text) IS DISTINCT FROM (to_jsonb(new.*) - 'updated_at'::text))) EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: user_roles note_update_user_roles; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_update_user_roles AFTER UPDATE ON public.user_roles FOR EACH ROW WHEN (((to_jsonb(old.*) - 'updated_at'::text) IS DISTINCT FROM (to_jsonb(new.*) - 'updated_at'::text))) EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: users note_update_users; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_update_users AFTER UPDATE ON public.users FOR EACH ROW WHEN (((to_jsonb(old.*) - 'updated_at'::text) IS DISTINCT FROM (to_jsonb(new.*) - 'updated_at'::text))) EXECUTE FUNCTION public.note_data_change_fn();

--
-- Name: loans update_loans_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_loans_updated_at BEFORE UPDATE ON public.loans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

--
-- Name: meetings update_meetings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

--
-- Name: members update_members_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON public.members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

--
-- Name: attendance attendance_meeting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.meetings(id) ON DELETE CASCADE;

--
-- Name: attendance attendance_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE;

--
-- Name: bank_profits bank_profits_meeting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_profits
    ADD CONSTRAINT bank_profits_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.meetings(id) ON DELETE SET NULL;

--
-- Name: loan_installments loan_installments_loan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loan_installments
    ADD CONSTRAINT loan_installments_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES public.loans(id) ON DELETE CASCADE;

--
-- Name: loan_penalties loan_penalties_loan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loan_penalties
    ADD CONSTRAINT loan_penalties_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES public.loans(id) ON DELETE CASCADE;

--
-- Name: loan_schedule loan_schedule_loan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loan_schedule
    ADD CONSTRAINT loan_schedule_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES public.loans(id) ON DELETE CASCADE;

--
-- Name: loans loans_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loans
    ADD CONSTRAINT loans_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE;

--
-- Name: members members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: monthly_contributions monthly_contributions_meeting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_contributions
    ADD CONSTRAINT monthly_contributions_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.meetings(id) ON DELETE SET NULL;

--
-- Name: monthly_contributions monthly_contributions_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_contributions
    ADD CONSTRAINT monthly_contributions_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE;

--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: profit_allocations profit_allocations_distribution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profit_allocations
    ADD CONSTRAINT profit_allocations_distribution_id_fkey FOREIGN KEY (distribution_id) REFERENCES public.profit_distributions(id) ON DELETE CASCADE;

--
-- Name: profit_allocations profit_allocations_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profit_allocations
    ADD CONSTRAINT profit_allocations_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE;

--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- PostgreSQL database dump complete
--
