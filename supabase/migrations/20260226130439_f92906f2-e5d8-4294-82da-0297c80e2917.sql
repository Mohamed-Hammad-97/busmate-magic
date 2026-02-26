-- Drop and recreate the public insert policy as SELECT-excluded
-- The existing ALL policies for customer_support and super_admin already cover SELECT
-- Add an explicit SELECT deny for anonymous/unauthenticated users
CREATE POLICY "Only authorized staff can read submissions"
ON public.contact_submissions
FOR SELECT
USING (
  has_department(auth.uid(), 'customer_support'::department)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);