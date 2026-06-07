-- Add a login_password field to members so generated member credentials can be saved and viewed
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS login_password TEXT;
