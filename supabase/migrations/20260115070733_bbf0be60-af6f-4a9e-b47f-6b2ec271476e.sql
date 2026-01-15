-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'member');

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT,
    phone TEXT,
    email TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'member',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE (user_id, role)
);

-- Create members table
CREATE TABLE public.members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    father_name TEXT NOT NULL,
    dob DATE,
    email TEXT,
    phone TEXT,
    address TEXT,
    join_date DATE NOT NULL DEFAULT CURRENT_DATE,
    profile_picture TEXT,
    total_budget DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create meetings table
CREATE TABLE public.meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_date DATE NOT NULL,
    agenda TEXT NOT NULL,
    decisions TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create upcoming_meetings table
CREATE TABLE public.upcoming_meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_date DATE NOT NULL,
    meeting_time TIME,
    venue TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create loans table
CREATE TABLE public.loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    remaining_amount DECIMAL(12,2) NOT NULL,
    loan_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paid', 'defaulted')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create loan_installments table
CREATE TABLE public.loan_installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID REFERENCES public.loans(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create monthly_contributions table
CREATE TABLE public.monthly_contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
    contribution_date DATE NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    meeting_id UUID REFERENCES public.meetings(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create attendance table
CREATE TABLE public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
    meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE NOT NULL,
    present BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE (member_id, meeting_id)
);

-- Create reserve_transactions table
CREATE TABLE public.reserve_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('donation', 'expense')),
    amount DECIMAL(12,2) NOT NULL,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    donor_name TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create profit_distributions table
CREATE TABLE public.profit_distributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    distribution_date DATE NOT NULL,
    total_profit DECIMAL(12,2) NOT NULL,
    reserve_allocation DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create profit_allocations table (per-member profit)
CREATE TABLE public.profit_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    distribution_id UUID REFERENCES public.profit_distributions(id) ON DELETE CASCADE NOT NULL,
    member_id UUID REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    ratio DECIMAL(5,4) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upcoming_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserve_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profit_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profit_allocations ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get member_id for current user
CREATE OR REPLACE FUNCTION public.get_member_id_for_user(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.members WHERE user_id = _user_id LIMIT 1
$$;

-- Profiles policies
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- User roles policies (only admins can manage roles)
CREATE POLICY "Users can view own role"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
ON public.user_roles FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Members policies
CREATE POLICY "Admins can do everything with members"
ON public.members FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members can view own record"
ON public.members FOR SELECT
USING (user_id = auth.uid());

-- Meetings policies (everyone can view, admins can modify)
CREATE POLICY "Authenticated users can view meetings"
ON public.meetings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage meetings"
ON public.meetings FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Upcoming meetings policies
CREATE POLICY "Authenticated users can view upcoming meetings"
ON public.upcoming_meetings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage upcoming meetings"
ON public.upcoming_meetings FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Loans policies
CREATE POLICY "Admins can manage all loans"
ON public.loans FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members can view own loans"
ON public.loans FOR SELECT
USING (member_id = public.get_member_id_for_user(auth.uid()));

-- Loan installments policies
CREATE POLICY "Admins can manage all installments"
ON public.loan_installments FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members can view own loan installments"
ON public.loan_installments FOR SELECT
USING (
  loan_id IN (
    SELECT id FROM public.loans WHERE member_id = public.get_member_id_for_user(auth.uid())
  )
);

-- Monthly contributions policies
CREATE POLICY "Admins can manage all contributions"
ON public.monthly_contributions FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members can view own contributions"
ON public.monthly_contributions FOR SELECT
USING (member_id = public.get_member_id_for_user(auth.uid()));

-- Attendance policies
CREATE POLICY "Admins can manage attendance"
ON public.attendance FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members can view own attendance"
ON public.attendance FOR SELECT
USING (member_id = public.get_member_id_for_user(auth.uid()));

-- Reserve transactions policies (admin only for modification)
CREATE POLICY "Authenticated users can view reserve transactions"
ON public.reserve_transactions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage reserve transactions"
ON public.reserve_transactions FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Profit distributions policies
CREATE POLICY "Authenticated users can view profit distributions"
ON public.profit_distributions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage profit distributions"
ON public.profit_distributions FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Profit allocations policies
CREATE POLICY "Admins can manage all allocations"
ON public.profit_allocations FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members can view own allocations"
ON public.profit_allocations FOR SELECT
USING (member_id = public.get_member_id_for_user(auth.uid()));

-- Create trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Add updated_at triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_members_updated_at
  BEFORE UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meetings_updated_at
  BEFORE UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_loans_updated_at
  BEFORE UPDATE ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();