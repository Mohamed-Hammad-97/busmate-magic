-- Allow drivers and supervisors to view their assigned routes
CREATE POLICY "Drivers can view their assigned routes" 
ON public.routes 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND is_driver_or_supervisor(auth.uid())
  AND (
    driver_id IN (
      SELECT driver_id FROM public.driver_accounts WHERE user_id = auth.uid()
    )
    OR
    supervisor_id IN (
      SELECT supervisor_id FROM public.driver_accounts WHERE user_id = auth.uid()
    )
  )
);

-- Also need to allow drivers to INSERT live_trips when starting a trip
CREATE POLICY "Drivers can start trips on their routes" 
ON public.live_trips 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND is_driver_or_supervisor(auth.uid())
  AND (
    driver_id IN (
      SELECT driver_id FROM public.driver_accounts WHERE user_id = auth.uid()
    )
    OR
    supervisor_id IN (
      SELECT supervisor_id FROM public.driver_accounts WHERE user_id = auth.uid()
    )
  )
);