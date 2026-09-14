CREATE OR REPLACE FUNCTION public.can_start_route_trip(_user_id uuid, _route_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.routes r
    JOIN public.driver_accounts da
      ON da.user_id = _user_id AND da.is_active = true
    WHERE r.id = _route_id
      AND (
        (da.driver_id IS NOT NULL AND da.driver_id = r.driver_id)
        OR (da.supervisor_id IS NOT NULL AND da.supervisor_id = r.supervisor_id)
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.staff_coverage sc
    JOIN public.driver_accounts da
      ON da.user_id = _user_id AND da.is_active = true
    WHERE sc.route_id = _route_id
      AND sc.coverage_date = (now() AT TIME ZONE 'Africa/Cairo')::date
      AND (
        (da.driver_id IS NOT NULL AND da.driver_id = sc.covering_driver_id)
        OR (da.supervisor_id IS NOT NULL AND da.supervisor_id = sc.covering_supervisor_id)
      )
  )
$$;

DROP POLICY IF EXISTS "Drivers can start trips on their routes" ON public.live_trips;

CREATE POLICY "Drivers can start trips on their routes"
ON public.live_trips
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (public.can_start_route_trip(auth.uid(), route_id));

DROP POLICY IF EXISTS "Drivers can update their assigned trips" ON public.live_trips;

CREATE POLICY "Drivers can update their assigned trips"
ON public.live_trips
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (public.can_start_route_trip(auth.uid(), route_id))
WITH CHECK (public.can_start_route_trip(auth.uid(), route_id));

DROP POLICY IF EXISTS "Drivers can view their assigned trips" ON public.live_trips;

CREATE POLICY "Drivers can view their assigned trips"
ON public.live_trips
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (public.can_start_route_trip(auth.uid(), route_id));