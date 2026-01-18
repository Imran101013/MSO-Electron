-- Add is_approved column to members table
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false;

-- Update the handle_new_user_signup trigger function to set is_approved to false
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Insert user role as 'member' by default
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'member');
  
  -- Insert into members table with basic info from signup (not approved by default)
  INSERT INTO public.members (user_id, name, father_name, email, join_date, is_approved)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New Member'),
    '',
    NEW.email,
    CURRENT_DATE,
    false
  );
  
  RETURN NEW;
END;
$function$;