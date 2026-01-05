-- Drop the public access policy that allows unauthenticated access
DROP POLICY IF EXISTS "Public can view active schools" ON public.schools;

-- Update the authenticated policy to use auth.uid() check for proper authentication
DROP POLICY IF EXISTS "All authenticated can view active schools" ON public.schools;

-- Create a proper policy that requires authentication
CREATE POLICY "Authenticated users can view active schools" 
ON public.schools 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND is_active = true);