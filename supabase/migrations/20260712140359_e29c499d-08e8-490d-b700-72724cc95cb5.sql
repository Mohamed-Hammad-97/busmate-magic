DROP POLICY IF EXISTS "Operations can manage cities" ON public.cities;

CREATE POLICY "Operations can insert cities"
ON public.cities
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (public.has_department(auth.uid(), 'operations'::department));

CREATE POLICY "Operations can update cities"
ON public.cities
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (public.has_department(auth.uid(), 'operations'::department))
WITH CHECK (public.has_department(auth.uid(), 'operations'::department));

CREATE POLICY "Operations can delete cities"
ON public.cities
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (public.has_department(auth.uid(), 'operations'::department));