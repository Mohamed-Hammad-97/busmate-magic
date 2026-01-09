-- Add public read policy for schools (only id and name, but since RLS works row-level, we allow access to active schools)
-- The edge function will handle the actual data exposure for security
CREATE POLICY "Public can view active schools basic info"
ON public.schools
FOR SELECT
TO anon
USING (is_active = true);