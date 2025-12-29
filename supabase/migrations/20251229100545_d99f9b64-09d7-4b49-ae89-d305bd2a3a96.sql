-- Drop the insecure public INSERT policy on parent_accounts
DROP POLICY IF EXISTS "Allow parent account creation" ON public.parent_accounts;

-- Drop the insecure public INSERT policy on registrations
DROP POLICY IF EXISTS "Allow registration creation" ON public.registrations;