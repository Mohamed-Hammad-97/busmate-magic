
-- Fix RLS policies on live_trips - convert to PERMISSIVE
DROP POLICY IF EXISTS "Parents can view their route trips" ON public.live_trips;
CREATE POLICY "Parents can view their route trips"
ON public.live_trips
FOR SELECT
TO authenticated
USING (
  route_id IN (
    SELECT ra.route_id
    FROM route_assignments ra
    JOIN registrations r ON r.id = ra.registration_id
    WHERE r.parent_id IN (SELECT get_user_parent_ids(auth.uid()))
  )
);

DROP POLICY IF EXISTS "Drivers can view their assigned trips" ON public.live_trips;
CREATE POLICY "Drivers can view their assigned trips"
ON public.live_trips
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND is_driver_or_supervisor(auth.uid())
  AND (driver_id = get_user_driver_id(auth.uid()) OR supervisor_id = get_user_supervisor_id(auth.uid()))
);

DROP POLICY IF EXISTS "Operations can view all live trips" ON public.live_trips;
CREATE POLICY "Operations can view all live trips"
ON public.live_trips
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL AND has_department(auth.uid(), 'operations'::department));

DROP POLICY IF EXISTS "Drivers can start trips on their routes" ON public.live_trips;
CREATE POLICY "Drivers can start trips on their routes"
ON public.live_trips
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND is_driver_or_supervisor(auth.uid())
  AND (driver_id = get_user_driver_id(auth.uid()) OR supervisor_id = get_user_supervisor_id(auth.uid()))
);

DROP POLICY IF EXISTS "Drivers can update their assigned trips" ON public.live_trips;
CREATE POLICY "Drivers can update their assigned trips"
ON public.live_trips
FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND is_driver_or_supervisor(auth.uid())
  AND (driver_id = get_user_driver_id(auth.uid()) OR supervisor_id = get_user_supervisor_id(auth.uid()))
);

DROP POLICY IF EXISTS "Operations can manage live trips" ON public.live_trips;
CREATE POLICY "Operations can manage live trips"
ON public.live_trips
FOR ALL
TO authenticated
USING (has_department(auth.uid(), 'operations'::department))
WITH CHECK (has_department(auth.uid(), 'operations'::department));

-- Fix RLS policies on trip_student_status - convert to PERMISSIVE  
DROP POLICY IF EXISTS "Parents can view their children status" ON public.trip_student_status;
CREATE POLICY "Parents can view their children status"
ON public.trip_student_status
FOR SELECT
TO authenticated
USING (
  registration_id IN (
    SELECT r.id FROM registrations r
    WHERE r.parent_id IN (SELECT get_user_parent_ids(auth.uid()))
  )
);

DROP POLICY IF EXISTS "Drivers can view trip student status" ON public.trip_student_status;
CREATE POLICY "Drivers can view trip student status"
ON public.trip_student_status
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND is_driver_or_supervisor(auth.uid())
  AND live_trip_id IN (
    SELECT id FROM live_trips
    WHERE driver_id = get_user_driver_id(auth.uid()) OR supervisor_id = get_user_supervisor_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "Employees can view trip student status" ON public.trip_student_status;
CREATE POLICY "Employees can view trip student status"
ON public.trip_student_status
FOR SELECT
TO authenticated
USING (is_employee(auth.uid()));

DROP POLICY IF EXISTS "Drivers can create trip student status" ON public.trip_student_status;
CREATE POLICY "Drivers can create trip student status"
ON public.trip_student_status
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND is_driver_or_supervisor(auth.uid())
  AND live_trip_id IN (
    SELECT id FROM live_trips
    WHERE driver_id = get_user_driver_id(auth.uid()) OR supervisor_id = get_user_supervisor_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "Drivers can update trip student status" ON public.trip_student_status;
CREATE POLICY "Drivers can update trip student status"
ON public.trip_student_status
FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND is_driver_or_supervisor(auth.uid())
  AND live_trip_id IN (
    SELECT id FROM live_trips
    WHERE driver_id = get_user_driver_id(auth.uid()) OR supervisor_id = get_user_supervisor_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "Operations can manage trip student status" ON public.trip_student_status;
CREATE POLICY "Operations can manage trip student status"
ON public.trip_student_status
FOR ALL
TO authenticated
USING (has_department(auth.uid(), 'operations'::department))
WITH CHECK (has_department(auth.uid(), 'operations'::department));

-- Fix RLS policies on trip_notifications - convert to PERMISSIVE
DROP POLICY IF EXISTS "Parents can view their notifications" ON public.trip_notifications;
CREATE POLICY "Parents can view their notifications"
ON public.trip_notifications
FOR SELECT
TO authenticated
USING (
  registration_id IN (
    SELECT r.id FROM registrations r
    WHERE r.parent_id IN (SELECT get_user_parent_ids(auth.uid()))
  )
);

DROP POLICY IF EXISTS "Parents can update their notification read status" ON public.trip_notifications;
CREATE POLICY "Parents can update their notification read status"
ON public.trip_notifications
FOR UPDATE
TO authenticated
USING (
  registration_id IN (
    SELECT r.id FROM registrations r
    WHERE r.parent_id IN (SELECT get_user_parent_ids(auth.uid()))
  )
);

DROP POLICY IF EXISTS "Drivers can create trip notifications" ON public.trip_notifications;
CREATE POLICY "Drivers can create trip notifications"
ON public.trip_notifications
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND is_driver_or_supervisor(auth.uid())
  AND live_trip_id IN (
    SELECT id FROM live_trips
    WHERE driver_id = get_user_driver_id(auth.uid()) OR supervisor_id = get_user_supervisor_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "Operations can manage notifications" ON public.trip_notifications;
CREATE POLICY "Operations can manage notifications"
ON public.trip_notifications
FOR ALL
TO authenticated
USING (has_department(auth.uid(), 'operations'::department))
WITH CHECK (has_department(auth.uid(), 'operations'::department));
