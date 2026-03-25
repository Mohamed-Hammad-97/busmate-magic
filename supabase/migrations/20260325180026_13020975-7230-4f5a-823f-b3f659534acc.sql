-- Add receipt_url column to payments table
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS receipt_url text;

-- Create storage bucket for payment receipts
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-receipts', 'payment-receipts', false) ON CONFLICT (id) DO NOTHING;

-- RLS policies for payment-receipts bucket
CREATE POLICY "Employees can upload receipts" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'payment-receipts' AND (SELECT is_employee(auth.uid())));

CREATE POLICY "Employees can view receipts" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'payment-receipts' AND (SELECT is_employee(auth.uid())));

CREATE POLICY "Parents can view their receipts" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'payment-receipts' AND 
  (name IN (
    SELECT p.receipt_url FROM payments p
    JOIN subscriptions s ON s.id = p.subscription_id
    JOIN registrations r ON r.id = s.registration_id
    WHERE r.parent_id IN (SELECT get_user_parent_ids(auth.uid()))
    AND p.receipt_url IS NOT NULL
  ))
);

CREATE POLICY "Finance can manage receipts" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'payment-receipts' AND (SELECT has_department(auth.uid(), 'finance'::department))) WITH CHECK (bucket_id = 'payment-receipts' AND (SELECT has_department(auth.uid(), 'finance'::department)));
