CREATE POLICY "Customer support can insert payments via subscription"
ON public.payments
FOR INSERT
WITH CHECK (has_department(auth.uid(), 'customer_support'::department));