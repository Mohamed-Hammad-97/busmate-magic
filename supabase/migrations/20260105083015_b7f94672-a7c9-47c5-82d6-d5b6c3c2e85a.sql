-- Restrict drivers table access to operations department only
-- Drop the broad employee policy and replace with operations-specific access

DROP POLICY IF EXISTS "Employees can view drivers" ON public.drivers;

-- Only operations department can view driver data
CREATE POLICY "Operations can view drivers" 
ON public.drivers 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND has_department(auth.uid(), 'operations'));

-- Drivers can view their own record (via driver_accounts relationship)
CREATE POLICY "Drivers can view own record" 
ON public.drivers 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL AND 
  id IN (SELECT driver_id FROM driver_accounts WHERE user_id = auth.uid() AND driver_id IS NOT NULL)
);