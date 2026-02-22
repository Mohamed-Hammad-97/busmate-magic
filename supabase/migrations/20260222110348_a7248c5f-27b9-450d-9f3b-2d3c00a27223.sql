
-- Create security definer function to check if a parent can access a route (breaks recursion)
CREATE OR REPLACE FUNCTION public.is_parent_route(_user_id uuid, _route_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM route_assignments ra
    JOIN registrations r ON r.id = ra.registration_id
    JOIN parent_accounts pa ON pa.id = r.parent_id
    WHERE ra.route_id = _route_id
      AND pa.user_id = _user_id
  )
$$;

-- Create security definer function to check if a driver can access a registration via routes
CREATE OR REPLACE FUNCTION public.is_driver_registration(_user_id uuid, _registration_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM route_assignments ra
    JOIN routes r ON r.id = ra.route_id
    WHERE ra.registration_id = _registration_id
      AND (r.driver_id = get_user_driver_id(_user_id) OR r.supervisor_id = get_user_supervisor_id(_user_id))
  )
$$;

-- Fix routes: Replace parent policy to use security definer function
DROP POLICY IF EXISTS "Parents can view their routes" ON public.routes;
CREATE POLICY "Parents can view their routes"
ON public.routes FOR SELECT
USING (is_parent_route(auth.uid(), id));

-- Fix registrations: Replace driver policy to use security definer function
DROP POLICY IF EXISTS "Drivers can view registrations for their routes" ON public.registrations;
CREATE POLICY "Drivers can view registrations for their routes"
ON public.registrations FOR SELECT
USING (is_driver_or_supervisor(auth.uid()) AND is_driver_registration(auth.uid(), id));
