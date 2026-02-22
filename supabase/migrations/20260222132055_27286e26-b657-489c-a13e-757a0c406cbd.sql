
-- =============================================
-- FIX: Make all RLS policies PERMISSIVE on tracking tables
-- so parents, drivers, and employees can each access data independently
-- =============================================

-- ========== live_trips ==========
DROP POLICY IF EXISTS "Parents can view their route trips" ON public.live_trips;
DROP POLICY IF EXISTS "Drivers can view their assigned trips" ON public.live_trips;
DROP POLICY IF EXISTS "Drivers can start trips on their routes" ON public.live_trips;
DROP POLICY IF EXISTS "Drivers can update their assigned trips" ON public.live_trips;
DROP POLICY IF EXISTS "Operations can manage live trips" ON public.live_trips;
DROP POLICY IF EXISTS "Operations can view all live trips" ON public.live_trips;

CREATE POLICY "Parents can view their route trips"
ON public.live_trips AS PERMISSIVE FOR SELECT TO authenticated
USING (route_id IN (
  SELECT ra.route_id FROM route_assignments ra
  JOIN registrations r ON r.id = ra.registration_id
  WHERE r.parent_id IN (SELECT get_user_parent_ids(auth.uid()))
));

CREATE POLICY "Drivers can view their assigned trips"
ON public.live_trips AS PERMISSIVE FOR SELECT TO authenticated
USING (is_driver_or_supervisor(auth.uid()) AND (
  driver_id = get_user_driver_id(auth.uid()) OR supervisor_id = get_user_supervisor_id(auth.uid())
));

CREATE POLICY "Drivers can start trips on their routes"
ON public.live_trips AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (is_driver_or_supervisor(auth.uid()) AND (
  driver_id = get_user_driver_id(auth.uid()) OR supervisor_id = get_user_supervisor_id(auth.uid())
));

CREATE POLICY "Drivers can update their assigned trips"
ON public.live_trips AS PERMISSIVE FOR UPDATE TO authenticated
USING (is_driver_or_supervisor(auth.uid()) AND (
  driver_id = get_user_driver_id(auth.uid()) OR supervisor_id = get_user_supervisor_id(auth.uid())
));

CREATE POLICY "Operations can manage live trips"
ON public.live_trips AS PERMISSIVE FOR ALL TO authenticated
USING (has_department(auth.uid(), 'operations'::department))
WITH CHECK (has_department(auth.uid(), 'operations'::department));

-- ========== trip_student_status ==========
DROP POLICY IF EXISTS "Parents can view their children status" ON public.trip_student_status;
DROP POLICY IF EXISTS "Drivers can view trip student status" ON public.trip_student_status;
DROP POLICY IF EXISTS "Drivers can create trip student status" ON public.trip_student_status;
DROP POLICY IF EXISTS "Drivers can update trip student status" ON public.trip_student_status;
DROP POLICY IF EXISTS "Employees can view trip student status" ON public.trip_student_status;
DROP POLICY IF EXISTS "Operations can manage trip student status" ON public.trip_student_status;

CREATE POLICY "Parents can view their children status"
ON public.trip_student_status AS PERMISSIVE FOR SELECT TO authenticated
USING (registration_id IN (
  SELECT r.id FROM registrations r
  WHERE r.parent_id IN (SELECT get_user_parent_ids(auth.uid()))
));

CREATE POLICY "Drivers can view trip student status"
ON public.trip_student_status AS PERMISSIVE FOR SELECT TO authenticated
USING (is_driver_or_supervisor(auth.uid()) AND live_trip_id IN (
  SELECT id FROM live_trips
  WHERE driver_id = get_user_driver_id(auth.uid()) OR supervisor_id = get_user_supervisor_id(auth.uid())
));

CREATE POLICY "Drivers can create trip student status"
ON public.trip_student_status AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (is_driver_or_supervisor(auth.uid()) AND live_trip_id IN (
  SELECT id FROM live_trips
  WHERE driver_id = get_user_driver_id(auth.uid()) OR supervisor_id = get_user_supervisor_id(auth.uid())
));

CREATE POLICY "Drivers can update trip student status"
ON public.trip_student_status AS PERMISSIVE FOR UPDATE TO authenticated
USING (is_driver_or_supervisor(auth.uid()) AND live_trip_id IN (
  SELECT id FROM live_trips
  WHERE driver_id = get_user_driver_id(auth.uid()) OR supervisor_id = get_user_supervisor_id(auth.uid())
));

CREATE POLICY "Employees can view trip student status"
ON public.trip_student_status AS PERMISSIVE FOR SELECT TO authenticated
USING (is_employee(auth.uid()));

CREATE POLICY "Operations can manage trip student status"
ON public.trip_student_status AS PERMISSIVE FOR ALL TO authenticated
USING (has_department(auth.uid(), 'operations'::department))
WITH CHECK (has_department(auth.uid(), 'operations'::department));

-- ========== trip_notifications ==========
DROP POLICY IF EXISTS "Parents can view their notifications" ON public.trip_notifications;
DROP POLICY IF EXISTS "Parents can update their notification read status" ON public.trip_notifications;
DROP POLICY IF EXISTS "Drivers can create trip notifications" ON public.trip_notifications;
DROP POLICY IF EXISTS "Operations can manage notifications" ON public.trip_notifications;

CREATE POLICY "Parents can view their notifications"
ON public.trip_notifications AS PERMISSIVE FOR SELECT TO authenticated
USING (registration_id IN (
  SELECT r.id FROM registrations r
  WHERE r.parent_id IN (SELECT get_user_parent_ids(auth.uid()))
));

CREATE POLICY "Parents can update their notification read status"
ON public.trip_notifications AS PERMISSIVE FOR UPDATE TO authenticated
USING (registration_id IN (
  SELECT r.id FROM registrations r
  WHERE r.parent_id IN (SELECT get_user_parent_ids(auth.uid()))
));

CREATE POLICY "Drivers can create trip notifications"
ON public.trip_notifications AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (is_driver_or_supervisor(auth.uid()) AND live_trip_id IN (
  SELECT id FROM live_trips
  WHERE driver_id = get_user_driver_id(auth.uid()) OR supervisor_id = get_user_supervisor_id(auth.uid())
));

CREATE POLICY "Operations can manage notifications"
ON public.trip_notifications AS PERMISSIVE FOR ALL TO authenticated
USING (has_department(auth.uid(), 'operations'::department))
WITH CHECK (has_department(auth.uid(), 'operations'::department));

-- ========== route_assignments: add parent SELECT policy ==========
DROP POLICY IF EXISTS "Parents can view their route assignments" ON public.route_assignments;

CREATE POLICY "Parents can view their route assignments"
ON public.route_assignments AS PERMISSIVE FOR SELECT TO authenticated
USING (registration_id IN (
  SELECT r.id FROM registrations r
  WHERE r.parent_id IN (SELECT get_user_parent_ids(auth.uid()))
));

-- Make existing route_assignments policies PERMISSIVE too
DROP POLICY IF EXISTS "Drivers can view route assignments for their routes" ON public.route_assignments;
DROP POLICY IF EXISTS "Employees can view route assignments" ON public.route_assignments;
DROP POLICY IF EXISTS "Operations can manage route assignments" ON public.route_assignments;

CREATE POLICY "Drivers can view route assignments for their routes"
ON public.route_assignments AS PERMISSIVE FOR SELECT TO authenticated
USING (is_driver_or_supervisor(auth.uid()) AND route_id IN (
  SELECT id FROM routes
  WHERE driver_id = get_user_driver_id(auth.uid()) OR supervisor_id = get_user_supervisor_id(auth.uid())
));

CREATE POLICY "Employees can view route assignments"
ON public.route_assignments AS PERMISSIVE FOR SELECT TO authenticated
USING (is_employee(auth.uid()));

CREATE POLICY "Operations can manage route assignments"
ON public.route_assignments AS PERMISSIVE FOR ALL TO authenticated
USING (has_department(auth.uid(), 'operations'::department))
WITH CHECK (has_department(auth.uid(), 'operations'::department));

-- Also fix routes table policies to be PERMISSIVE for parent access
DROP POLICY IF EXISTS "Parents can view their routes" ON public.routes;
DROP POLICY IF EXISTS "Drivers can view their assigned routes" ON public.routes;
DROP POLICY IF EXISTS "Employees can view routes" ON public.routes;
DROP POLICY IF EXISTS "Operations can manage routes" ON public.routes;

CREATE POLICY "Parents can view their routes"
ON public.routes AS PERMISSIVE FOR SELECT TO authenticated
USING (is_parent_route(auth.uid(), id));

CREATE POLICY "Drivers can view their assigned routes"
ON public.routes AS PERMISSIVE FOR SELECT TO authenticated
USING (is_driver_or_supervisor(auth.uid()) AND (
  driver_id = get_user_driver_id(auth.uid()) OR supervisor_id = get_user_supervisor_id(auth.uid())
));

CREATE POLICY "Employees can view routes"
ON public.routes AS PERMISSIVE FOR SELECT TO authenticated
USING (is_employee(auth.uid()));

CREATE POLICY "Operations can manage routes"
ON public.routes AS PERMISSIVE FOR ALL TO authenticated
USING (has_department(auth.uid(), 'operations'::department))
WITH CHECK (has_department(auth.uid(), 'operations'::department));

-- Fix registrations policies to be PERMISSIVE
DROP POLICY IF EXISTS "Parents can view own registrations" ON public.registrations;
DROP POLICY IF EXISTS "Drivers can view registrations for their routes" ON public.registrations;
DROP POLICY IF EXISTS "Employees can view all registrations" ON public.registrations;
DROP POLICY IF EXISTS "Customer support can manage registrations" ON public.registrations;

CREATE POLICY "Parents can view own registrations"
ON public.registrations AS PERMISSIVE FOR SELECT TO authenticated
USING (parent_id IN (SELECT get_user_parent_ids(auth.uid())));

CREATE POLICY "Drivers can view registrations for their routes"
ON public.registrations AS PERMISSIVE FOR SELECT TO authenticated
USING (is_driver_or_supervisor(auth.uid()) AND is_driver_registration(auth.uid(), id));

CREATE POLICY "Employees can view all registrations"
ON public.registrations AS PERMISSIVE FOR SELECT TO authenticated
USING (is_employee(auth.uid()));

CREATE POLICY "Customer support can manage registrations"
ON public.registrations AS PERMISSIVE FOR ALL TO authenticated
USING (has_department(auth.uid(), 'customer_support'::department))
WITH CHECK (has_department(auth.uid(), 'customer_support'::department));

-- Fix parent_accounts policies to be PERMISSIVE
DROP POLICY IF EXISTS "Parents can view own account" ON public.parent_accounts;
DROP POLICY IF EXISTS "Parents can update own account" ON public.parent_accounts;
DROP POLICY IF EXISTS "Customer support and operations can view parent accounts" ON public.parent_accounts;
DROP POLICY IF EXISTS "Customer support can manage parent accounts" ON public.parent_accounts;
DROP POLICY IF EXISTS "Drivers can view parent accounts for their routes" ON public.parent_accounts;

CREATE POLICY "Parents can view own account"
ON public.parent_accounts AS PERMISSIVE FOR SELECT TO authenticated
USING (id IN (SELECT get_user_parent_ids(auth.uid())));

CREATE POLICY "Parents can update own account"
ON public.parent_accounts AS PERMISSIVE FOR UPDATE TO authenticated
USING (id IN (SELECT get_user_parent_ids(auth.uid())));

CREATE POLICY "Customer support and operations can view parent accounts"
ON public.parent_accounts AS PERMISSIVE FOR SELECT TO authenticated
USING (has_department(auth.uid(), 'customer_support'::department) OR has_department(auth.uid(), 'operations'::department));

CREATE POLICY "Customer support can manage parent accounts"
ON public.parent_accounts AS PERMISSIVE FOR ALL TO authenticated
USING (has_department(auth.uid(), 'customer_support'::department))
WITH CHECK (has_department(auth.uid(), 'customer_support'::department));

CREATE POLICY "Drivers can view parent accounts for their routes"
ON public.parent_accounts AS PERMISSIVE FOR SELECT TO authenticated
USING (is_driver_or_supervisor(auth.uid()) AND is_driver_parent(auth.uid(), id));
