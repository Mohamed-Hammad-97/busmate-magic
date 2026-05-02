-- 1) Add attempts column to otp_codes for brute-force protection
ALTER TABLE public.otp_codes
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;

-- 2) Restrict access to company_accounts.password_hash at the column level.
--    Edge functions use the service_role which is unaffected by these revokes.
REVOKE SELECT (password_hash) ON public.company_accounts FROM anon;
REVOKE SELECT (password_hash) ON public.company_accounts FROM authenticated;
REVOKE UPDATE (password_hash) ON public.company_accounts FROM anon;
REVOKE UPDATE (password_hash) ON public.company_accounts FROM authenticated;
REVOKE INSERT (password_hash) ON public.company_accounts FROM anon;
REVOKE INSERT (password_hash) ON public.company_accounts FROM authenticated;