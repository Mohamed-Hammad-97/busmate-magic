-- Enable and force RLS on parent_accounts table
ALTER TABLE public.parent_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_accounts FORCE ROW LEVEL SECURITY;

-- Drop existing policies and recreate with explicit auth checks
DROP POLICY IF EXISTS "Customer support can manage parent accounts" ON public.parent_accounts;
DROP POLICY IF EXISTS "Employees can view all parent accounts" ON public.parent_accounts;
DROP POLICY IF EXISTS "Parents can update own account" ON public.parent_accounts;
DROP POLICY IF EXISTS "Parents can view own account" ON public.parent_accounts;

-- Customer support can manage parent accounts (full access)
CREATE POLICY "Customer support can manage parent accounts" 
ON public.parent_accounts 
FOR ALL 
USING (auth.uid() IS NOT NULL AND has_department(auth.uid(), 'customer_support'))
WITH CHECK (auth.uid() IS NOT NULL AND has_department(auth.uid(), 'customer_support'));

-- Restrict employee access to only customer_support and operations departments
CREATE POLICY "Customer support and operations can view parent accounts" 
ON public.parent_accounts 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND (
  has_department(auth.uid(), 'customer_support') OR 
  has_department(auth.uid(), 'operations')
));

-- Parents can view their own account
CREATE POLICY "Parents can view own account" 
ON public.parent_accounts 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Parents can update their own account
CREATE POLICY "Parents can update own account" 
ON public.parent_accounts 
FOR UPDATE 
USING (auth.uid() IS NOT NULL AND user_id = auth.uid());