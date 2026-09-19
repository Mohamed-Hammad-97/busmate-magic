CREATE POLICY "Operations can manage salary payments" ON public.salary_payments
  FOR ALL TO authenticated
  USING (has_department(auth.uid(), 'operations'::department))
  WITH CHECK (has_department(auth.uid(), 'operations'::department));