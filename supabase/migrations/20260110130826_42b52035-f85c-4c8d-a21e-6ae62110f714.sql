-- First, create helper functions to avoid infinite recursion
-- Function to get the driver_id for a user
CREATE OR REPLACE FUNCTION public.get_user_driver_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT driver_id FROM public.driver_accounts WHERE user_id = _user_id AND is_active = true LIMIT 1
$$;

-- Function to get the supervisor_id for a user
CREATE OR REPLACE FUNCTION public.get_user_supervisor_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT supervisor_id FROM public.driver_accounts WHERE user_id = _user_id AND is_active = true LIMIT 1
$$;

-- Drop and recreate the problematic policies using the new functions

-- Drop existing problematic policies on routes
DROP POLICY IF EXISTS "Drivers can view their assigned routes" ON public.routes;

-- Recreate with function
CREATE POLICY "Drivers can view their assigned routes" 
ON public.routes 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND is_driver_or_supervisor(auth.uid())
  AND (
    driver_id = get_user_driver_id(auth.uid())
    OR supervisor_id = get_user_supervisor_id(auth.uid())
  )
);

-- Fix live_trips policies
DROP POLICY IF EXISTS "Drivers can start trips on their routes" ON public.live_trips;
DROP POLICY IF EXISTS "Drivers can view their assigned trips" ON public.live_trips;
DROP POLICY IF EXISTS "Drivers can update their assigned trips" ON public.live_trips;

CREATE POLICY "Drivers can start trips on their routes" 
ON public.live_trips 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND is_driver_or_supervisor(auth.uid())
  AND (
    driver_id = get_user_driver_id(auth.uid())
    OR supervisor_id = get_user_supervisor_id(auth.uid())
  )
);

CREATE POLICY "Drivers can view their assigned trips" 
ON public.live_trips 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND is_driver_or_supervisor(auth.uid())
  AND (
    driver_id = get_user_driver_id(auth.uid())
    OR supervisor_id = get_user_supervisor_id(auth.uid())
  )
);

CREATE POLICY "Drivers can update their assigned trips" 
ON public.live_trips 
FOR UPDATE 
USING (
  auth.uid() IS NOT NULL 
  AND is_driver_or_supervisor(auth.uid())
  AND (
    driver_id = get_user_driver_id(auth.uid())
    OR supervisor_id = get_user_supervisor_id(auth.uid())
  )
);

-- Fix schools policies
DROP POLICY IF EXISTS "Drivers can view schools for their routes" ON public.schools;

-- Fix route_assignments policies
DROP POLICY IF EXISTS "Drivers can view route assignments for their routes" ON public.route_assignments;

CREATE POLICY "Drivers can view route assignments for their routes" 
ON public.route_assignments 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND is_driver_or_supervisor(auth.uid())
  AND route_id IN (
    SELECT id FROM public.routes 
    WHERE driver_id = get_user_driver_id(auth.uid())
    OR supervisor_id = get_user_supervisor_id(auth.uid())
  )
);

-- Fix registrations policies
DROP POLICY IF EXISTS "Drivers can view registrations for their routes" ON public.registrations;

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
      WHERE driver_id = get_user_driver_id(auth.uid())
      OR supervisor_id = get_user_supervisor_id(auth.uid())
    )
  )
);

-- Fix parent_accounts policies
DROP POLICY IF EXISTS "Drivers can view parent accounts for their routes" ON public.parent_accounts;

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
        WHERE driver_id = get_user_driver_id(auth.uid())
        OR supervisor_id = get_user_supervisor_id(auth.uid())
      )
    )
  )
);

-- Fix trip_student_status policies
DROP POLICY IF EXISTS "Drivers can create trip student status" ON public.trip_student_status;
DROP POLICY IF EXISTS "Drivers can view trip student status" ON public.trip_student_status;
DROP POLICY IF EXISTS "Drivers can update trip student status" ON public.trip_student_status;

CREATE POLICY "Drivers can create trip student status" 
ON public.trip_student_status 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND is_driver_or_supervisor(auth.uid())
  AND live_trip_id IN (
    SELECT id FROM public.live_trips 
    WHERE driver_id = get_user_driver_id(auth.uid())
    OR supervisor_id = get_user_supervisor_id(auth.uid())
  )
);

CREATE POLICY "Drivers can view trip student status" 
ON public.trip_student_status 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND is_driver_or_supervisor(auth.uid())
  AND live_trip_id IN (
    SELECT id FROM public.live_trips 
    WHERE driver_id = get_user_driver_id(auth.uid())
    OR supervisor_id = get_user_supervisor_id(auth.uid())
  )
);

CREATE POLICY "Drivers can update trip student status" 
ON public.trip_student_status 
FOR UPDATE 
USING (
  auth.uid() IS NOT NULL 
  AND is_driver_or_supervisor(auth.uid())
  AND live_trip_id IN (
    SELECT id FROM public.live_trips 
    WHERE driver_id = get_user_driver_id(auth.uid())
    OR supervisor_id = get_user_supervisor_id(auth.uid())
  )
);

-- Fix trip_notifications policies
DROP POLICY IF EXISTS "Drivers can create trip notifications" ON public.trip_notifications;

CREATE POLICY "Drivers can create trip notifications" 
ON public.trip_notifications 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND is_driver_or_supervisor(auth.uid())
  AND live_trip_id IN (
    SELECT id FROM public.live_trips 
    WHERE driver_id = get_user_driver_id(auth.uid())
    OR supervisor_id = get_user_supervisor_id(auth.uid())
  )
);

-- Fix supervisors policies
DROP POLICY IF EXISTS "Supervisors can view own record" ON public.supervisors;
DROP POLICY IF EXISTS "Drivers can view supervisors on their routes" ON public.supervisors;

CREATE POLICY "Supervisors can view own record" 
ON public.supervisors 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND id = get_user_supervisor_id(auth.uid())
);

CREATE POLICY "Drivers can view supervisors on their routes" 
ON public.supervisors 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND is_driver_or_supervisor(auth.uid())
  AND id IN (
    SELECT supervisor_id FROM public.routes 
    WHERE driver_id = get_user_driver_id(auth.uid())
    OR supervisor_id = get_user_supervisor_id(auth.uid())
  )
);

-- Fix drivers policies  
DROP POLICY IF EXISTS "Supervisors can view drivers on their routes" ON public.drivers;

CREATE POLICY "Supervisors can view drivers on their routes" 
ON public.drivers 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND is_driver_or_supervisor(auth.uid())
  AND id IN (
    SELECT driver_id FROM public.routes 
    WHERE driver_id = get_user_driver_id(auth.uid())
    OR supervisor_id = get_user_supervisor_id(auth.uid())
  )
);