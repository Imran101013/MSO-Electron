-- Add policy for admins to view all members (SELECT is separate from ALL in restrictive policies)
CREATE POLICY "Admins can view all members"
ON public.members FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));