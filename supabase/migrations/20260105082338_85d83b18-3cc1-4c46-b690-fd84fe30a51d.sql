-- Restrict live_trips access to operations department only (not all employees)
-- Drop the broad employee policy and replace with operations-specific access

DROP POLICY IF EXISTS "Employees can view live trips" ON public.live_trips;

-- Operations department can view all live trips for monitoring
CREATE POLICY "Operations can view all live trips" 
ON public.live_trips 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND has_department(auth.uid(), 'operations'));

-- Drivers and supervisors can view trips they are assigned to
CREATE POLICY "Drivers can view their assigned trips" 
ON public.live_trips 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL AND 
  is_driver_or_supervisor(auth.uid()) AND
  (
    driver_id IN (SELECT driver_id FROM driver_accounts WHERE user_id = auth.uid()) OR
    supervisor_id IN (SELECT supervisor_id FROM driver_accounts WHERE user_id = auth.uid())
  )
);

-- Drivers and supervisors can update their assigned trips (for location updates)
CREATE POLICY "Drivers can update their assigned trips" 
ON public.live_trips 
FOR UPDATE 
USING (
  auth.uid() IS NOT NULL AND 
  is_driver_or_supervisor(auth.uid()) AND
  (
    driver_id IN (SELECT driver_id FROM driver_accounts WHERE user_id = auth.uid()) OR
    supervisor_id IN (SELECT supervisor_id FROM driver_accounts WHERE user_id = auth.uid())
  )
);