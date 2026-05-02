
INSERT INTO storage.buckets (id, name, public) VALUES ('daily-line-receipts', 'daily-line-receipts', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can upload daily line receipt"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'daily-line-receipts');

CREATE POLICY "Staff can read daily line receipts"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'daily-line-receipts' AND (
      has_role(auth.uid(), 'super_admin') OR
      has_department(auth.uid(), 'operation_daily_lines'::department) OR
      has_department(auth.uid(), 'customer_support'::department) OR
      has_department(auth.uid(), 'finance'::department)
    )
  );

CREATE POLICY "Staff can manage daily line receipts"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'daily-line-receipts' AND (
      has_role(auth.uid(), 'super_admin') OR
      has_department(auth.uid(), 'operation_daily_lines'::department)
    )
  )
  WITH CHECK (
    bucket_id = 'daily-line-receipts' AND (
      has_role(auth.uid(), 'super_admin') OR
      has_department(auth.uid(), 'operation_daily_lines'::department)
    )
  );
