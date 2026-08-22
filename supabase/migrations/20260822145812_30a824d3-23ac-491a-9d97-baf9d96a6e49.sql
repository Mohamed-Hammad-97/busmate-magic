CREATE OR REPLACE FUNCTION public.is_parent_line_driver(_user_id uuid, _driver_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM route_assignments ra
    JOIN routes rt ON rt.id = ra.route_id
    JOIN registrations r ON r.id = ra.registration_id
    JOIN parent_accounts pa ON pa.id = r.parent_id
    WHERE rt.driver_id = _driver_id
      AND pa.user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_parent_line_supervisor(_user_id uuid, _supervisor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM route_assignments ra
    JOIN routes rt ON rt.id = ra.route_id
    JOIN registrations r ON r.id = ra.registration_id
    JOIN parent_accounts pa ON pa.id = r.parent_id
    WHERE rt.supervisor_id = _supervisor_id
      AND pa.user_id = _user_id
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_parent_line_driver(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_parent_line_supervisor(uuid, uuid) FROM anon;

CREATE POLICY "Parents can view their line driver"
ON public.drivers FOR SELECT TO authenticated
USING (public.is_parent_line_driver(auth.uid(), id));

CREATE POLICY "Parents can view their line supervisor"
ON public.supervisors FOR SELECT TO authenticated
USING (public.is_parent_line_supervisor(auth.uid(), id));