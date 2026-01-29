-- Fix OTP codes table RLS: Remove overly permissive policy and add proper restrictions
-- OTP codes should ONLY be accessible via service role (edge functions), never directly by users

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Service role can manage OTP codes" ON public.otp_codes;

-- Create a new policy that DENIES all access to regular users
-- OTP codes should only be managed by edge functions using the service role key
-- This policy ensures even authenticated users cannot read OTP codes directly
CREATE POLICY "OTP codes are only accessible via service role"
ON public.otp_codes
FOR ALL
USING (false)
WITH CHECK (false);

-- Note: Edge functions using SUPABASE_SERVICE_ROLE_KEY bypass RLS entirely,
-- so they can still manage OTP codes. This policy blocks all direct user access.