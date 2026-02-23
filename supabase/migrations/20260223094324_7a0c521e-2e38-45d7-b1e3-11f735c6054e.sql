
-- 1. Add is_active column to parent_accounts for soft-delete/deactivation
ALTER TABLE public.parent_accounts ADD COLUMN is_active boolean NOT NULL DEFAULT true;

-- 2. Add city column to employees for city-based access control
ALTER TABLE public.employees ADD COLUMN city text;

-- 3. Create payment_extra_fees table for extra fees on installments
CREATE TABLE public.payment_extra_fees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  fee_type text NOT NULL DEFAULT 'custom',
  reason text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on payment_extra_fees
ALTER TABLE public.payment_extra_fees ENABLE ROW LEVEL SECURITY;

-- Finance can manage extra fees
CREATE POLICY "Finance can manage extra fees"
ON public.payment_extra_fees
FOR ALL
USING (has_department(auth.uid(), 'finance'::department))
WITH CHECK (has_department(auth.uid(), 'finance'::department));

-- Employees can view extra fees
CREATE POLICY "Employees can view extra fees"
ON public.payment_extra_fees
FOR SELECT
USING (is_employee(auth.uid()));

-- Parents can view their own extra fees
CREATE POLICY "Parents can view own extra fees"
ON public.payment_extra_fees
FOR SELECT
USING (
  payment_id IN (
    SELECT p.id FROM payments p
    JOIN subscriptions s ON s.id = p.subscription_id
    JOIN registrations r ON r.id = s.registration_id
    WHERE r.parent_id IN (SELECT get_user_parent_ids(auth.uid()))
  )
);

-- Add trigger for updated_at on payment_extra_fees
CREATE TRIGGER update_payment_extra_fees_updated_at
BEFORE UPDATE ON public.payment_extra_fees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
