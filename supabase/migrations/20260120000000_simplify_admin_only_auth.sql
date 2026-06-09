-- Simplify authentication to admin-only access
-- Remove member approval requirements and allow direct member creation

-- Remove is_approved column from members table since no approval is needed
ALTER TABLE public.members DROP COLUMN IF EXISTS is_approved;

-- Remove user_id linking from members table since members won't have auth accounts
ALTER TABLE public.members DROP COLUMN IF EXISTS user_id;

-- Add auto-increment ID to members for simpler management
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS member_number SERIAL UNIQUE;

-- Update members table to ensure all required fields have defaults
ALTER TABLE public.members ALTER COLUMN father_name DROP NOT NULL;
ALTER TABLE public.members ALTER COLUMN father_name SET DEFAULT '';

-- Create a simple admin user if it doesn't exist
-- Password: admin123 (should be changed in production)
INSERT INTO public.users (id, email, password_hash, full_name) 
VALUES (
  gen_random_uuid(),
  'admin@mso.com',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- bcrypt hash for 'admin123'
  'MSO Admin'
) ON CONFLICT (email) DO NOTHING;

-- Ensure the admin user has admin role
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::app_role 
FROM public.users u 
WHERE u.email = 'admin@mso.com'
AND NOT EXISTS (
  SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role = 'admin'
);

-- Create admin profile
INSERT INTO public.profiles (user_id, email, full_name)
SELECT u.id, u.email, u.full_name
FROM public.users u 
WHERE u.email = 'admin@mso.com'
AND NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.user_id = u.id
);