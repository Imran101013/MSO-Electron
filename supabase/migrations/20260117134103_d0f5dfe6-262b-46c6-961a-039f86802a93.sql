-- Create trigger function to auto-assign member role and create member record on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Insert user role as 'member' by default
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'member');
  
  -- Insert into members table with basic info from signup
  INSERT INTO public.members (user_id, name, father_name, email, join_date)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New Member'),
    '',
    NEW.email,
    CURRENT_DATE
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users for new signups
CREATE TRIGGER on_auth_user_created_setup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_signup();