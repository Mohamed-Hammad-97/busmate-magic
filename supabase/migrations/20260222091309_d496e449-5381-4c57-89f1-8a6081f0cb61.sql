
-- Fix registrations table: drop RESTRICTIVE policies and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Customer support can manage registrations" ON public.registrations;
DROP POLICY IF EXISTS "Drivers can view registrations for their routes" ON public.registrations;
DROP POLICY IF EXISTS "Employees can view all registrations" ON public.registrations;
DROP POLICY IF EXISTS "Parents can view own registrations" ON public.registrations;

CREATE POLICY "Employees can view all registrations"
ON public.registrations FOR SELECT
TO authenticated
USING (is_employee(auth.uid()));

CREATE POLICY "Customer support can manage registrations"
ON public.registrations FOR ALL
TO authenticated
USING (has_department(auth.uid(), 'customer_support'::department))
WITH CHECK (has_department(auth.uid(), 'customer_support'::department));

CREATE POLICY "Drivers can view registrations for their routes"
ON public.registrations FOR SELECT
TO authenticated
USING (is_driver_or_supervisor(auth.uid()) AND id IN (
  SELECT route_assignments.registration_id FROM route_assignments
  WHERE route_assignments.route_id IN (
    SELECT routes.id FROM routes
    WHERE routes.driver_id = get_user_driver_id(auth.uid()) OR routes.supervisor_id = get_user_supervisor_id(auth.uid())
  )
));

CREATE POLICY "Parents can view own registrations"
ON public.registrations FOR SELECT
TO authenticated
USING (parent_id IN (SELECT parent_accounts.id FROM parent_accounts WHERE parent_accounts.user_id = auth.uid()));

-- Fix parent_accounts table: drop RESTRICTIVE policies and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Customer support and operations can view parent accounts" ON public.parent_accounts;
DROP POLICY IF EXISTS "Customer support can manage parent accounts" ON public.parent_accounts;
DROP POLICY IF EXISTS "Drivers can view parent accounts for their routes" ON public.parent_accounts;
DROP POLICY IF EXISTS "Parents can update own account" ON public.parent_accounts;
DROP POLICY IF EXISTS "Parents can view own account" ON public.parent_accounts;

CREATE POLICY "Customer support and operations can view parent accounts"
ON public.parent_accounts FOR SELECT
TO authenticated
USING (has_department(auth.uid(), 'customer_support'::department) OR has_department(auth.uid(), 'operations'::department));

CREATE POLICY "Customer support can manage parent accounts"
ON public.parent_accounts FOR ALL
TO authenticated
USING (has_department(auth.uid(), 'customer_support'::department))
WITH CHECK (has_department(auth.uid(), 'customer_support'::department));

CREATE POLICY "Drivers can view parent accounts for their routes"
ON public.parent_accounts FOR SELECT
TO authenticated
USING (is_driver_or_supervisor(auth.uid()) AND id IN (
  SELECT registrations.parent_id FROM registrations
  WHERE registrations.id IN (
    SELECT route_assignments.registration_id FROM route_assignments
    WHERE route_assignments.route_id IN (
      SELECT routes.id FROM routes
      WHERE routes.driver_id = get_user_driver_id(auth.uid()) OR routes.supervisor_id = get_user_supervisor_id(auth.uid())
    )
  )
));

CREATE POLICY "Parents can view own account"
ON public.parent_accounts FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Parents can update own account"
ON public.parent_accounts FOR UPDATE
TO authenticated
USING (user_id = auth.uid());
