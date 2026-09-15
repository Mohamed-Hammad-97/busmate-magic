CREATE POLICY "Employees can view live trips"
ON public.live_trips
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (public.is_employee(auth.uid()));

CREATE POLICY "Employees can view drivers"
ON public.drivers
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (public.is_employee(auth.uid()));