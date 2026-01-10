-- Supervisors can view their own record
CREATE POLICY "Supervisors can view own record" 
ON public.supervisors 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND id IN (
    SELECT supervisor_id 
    FROM public.driver_accounts 
    WHERE user_id = auth.uid() 
    AND supervisor_id IS NOT NULL
  )
);

-- Also drivers assigned to same routes can view the supervisor
CREATE POLICY "Drivers can view supervisors on their routes" 
ON public.supervisors 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND is_driver_or_supervisor(auth.uid())
  AND id IN (
    SELECT supervisor_id FROM public.routes 
    WHERE driver_id IN (SELECT driver_id FROM public.driver_accounts WHERE user_id = auth.uid())
    OR supervisor_id IN (SELECT supervisor_id FROM public.driver_accounts WHERE user_id = auth.uid())
  )
);

-- Supervisors can view the driver assigned to their routes
CREATE POLICY "Supervisors can view drivers on their routes" 
ON public.drivers 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND is_driver_or_supervisor(auth.uid())
  AND id IN (
    SELECT driver_id FROM public.routes 
    WHERE driver_id IN (SELECT driver_id FROM public.driver_accounts WHERE user_id = auth.uid())
    OR supervisor_id IN (SELECT supervisor_id FROM public.driver_accounts WHERE user_id = auth.uid())
  )
);