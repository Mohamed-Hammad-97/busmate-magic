-- Drivers need to view schools for route details
CREATE POLICY "Drivers can view schools for their routes" 
ON public.schools 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND is_driver_or_supervisor(auth.uid())
  AND id IN (
    SELECT school_id FROM public.routes 
    WHERE driver_id IN (SELECT driver_id FROM public.driver_accounts WHERE user_id = auth.uid())
    OR supervisor_id IN (SELECT supervisor_id FROM public.driver_accounts WHERE user_id = auth.uid())
  )
);

-- Drivers need to view route_assignments to see students on their routes
CREATE POLICY "Drivers can view route assignments for their routes" 
ON public.route_assignments 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND is_driver_or_supervisor(auth.uid())
  AND route_id IN (
    SELECT id FROM public.routes 
    WHERE driver_id IN (SELECT driver_id FROM public.driver_accounts WHERE user_id = auth.uid())
    OR supervisor_id IN (SELECT supervisor_id FROM public.driver_accounts WHERE user_id = auth.uid())
  )
);

-- Drivers need to view registrations for students on their routes
CREATE POLICY "Drivers can view registrations for their routes" 
ON public.registrations 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND is_driver_or_supervisor(auth.uid())
  AND id IN (
    SELECT registration_id FROM public.route_assignments 
    WHERE route_id IN (
      SELECT id FROM public.routes 
      WHERE driver_id IN (SELECT driver_id FROM public.driver_accounts WHERE user_id = auth.uid())
      OR supervisor_id IN (SELECT supervisor_id FROM public.driver_accounts WHERE user_id = auth.uid())
    )
  )
);

-- Drivers need to view parent accounts for contact info
CREATE POLICY "Drivers can view parent accounts for their routes" 
ON public.parent_accounts 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND is_driver_or_supervisor(auth.uid())
  AND id IN (
    SELECT parent_id FROM public.registrations 
    WHERE id IN (
      SELECT registration_id FROM public.route_assignments 
      WHERE route_id IN (
        SELECT id FROM public.routes 
        WHERE driver_id IN (SELECT driver_id FROM public.driver_accounts WHERE user_id = auth.uid())
        OR supervisor_id IN (SELECT supervisor_id FROM public.driver_accounts WHERE user_id = auth.uid())
      )
    )
  )
);

-- Drivers need to INSERT trip_student_status when starting trips
CREATE POLICY "Drivers can create trip student status" 
ON public.trip_student_status 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND is_driver_or_supervisor(auth.uid())
  AND live_trip_id IN (
    SELECT id FROM public.live_trips 
    WHERE driver_id IN (SELECT driver_id FROM public.driver_accounts WHERE user_id = auth.uid())
    OR supervisor_id IN (SELECT supervisor_id FROM public.driver_accounts WHERE user_id = auth.uid())
  )
);

-- Drivers need to view trip_student_status during trips
CREATE POLICY "Drivers can view trip student status" 
ON public.trip_student_status 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND is_driver_or_supervisor(auth.uid())
  AND live_trip_id IN (
    SELECT id FROM public.live_trips 
    WHERE driver_id IN (SELECT driver_id FROM public.driver_accounts WHERE user_id = auth.uid())
    OR supervisor_id IN (SELECT supervisor_id FROM public.driver_accounts WHERE user_id = auth.uid())
  )
);

-- Drivers need to UPDATE trip_student_status to mark students as picked up
CREATE POLICY "Drivers can update trip student status" 
ON public.trip_student_status 
FOR UPDATE 
USING (
  auth.uid() IS NOT NULL 
  AND is_driver_or_supervisor(auth.uid())
  AND live_trip_id IN (
    SELECT id FROM public.live_trips 
    WHERE driver_id IN (SELECT driver_id FROM public.driver_accounts WHERE user_id = auth.uid())
    OR supervisor_id IN (SELECT supervisor_id FROM public.driver_accounts WHERE user_id = auth.uid())
  )
);

-- Drivers need to INSERT trip_notifications to notify parents
CREATE POLICY "Drivers can create trip notifications" 
ON public.trip_notifications 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND is_driver_or_supervisor(auth.uid())
  AND live_trip_id IN (
    SELECT id FROM public.live_trips 
    WHERE driver_id IN (SELECT driver_id FROM public.driver_accounts WHERE user_id = auth.uid())
    OR supervisor_id IN (SELECT supervisor_id FROM public.driver_accounts WHERE user_id = auth.uid())
  )
);