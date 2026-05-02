
-- Remove the overly permissive anonymous insert policy on the daily-line-receipts bucket
DROP POLICY IF EXISTS "Anyone can upload daily line receipt" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload daily line receipts" ON storage.objects;

-- Receipts are now uploaded by the `daily-line-book` edge function using the
-- service role key, which bypasses RLS. No client-facing INSERT policy is
-- required; this prevents anonymous abuse of the bucket.
