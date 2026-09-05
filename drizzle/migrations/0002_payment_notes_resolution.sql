ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payment_note_resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_note_resolved_by uuid,
  ADD COLUMN IF NOT EXISTS payment_note_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_note_updated_by uuid,
  ADD COLUMN IF NOT EXISTS fawry_note_resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS fawry_note_resolved_by uuid,
  ADD COLUMN IF NOT EXISTS fawry_note_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS fawry_note_updated_by uuid;

CREATE OR REPLACE FUNCTION public.set_payment_note(
  _payment_id uuid,
  _field text,
  _note text,
  _resolved boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF NOT (
    public.has_role(_uid, 'super_admin')
    OR public.has_department(_uid, 'finance')
    OR public.has_department(_uid, 'customer_support')
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF _field NOT IN ('payment_note', 'fawry_note') THEN
    RAISE EXCEPTION 'Invalid field';
  END IF;

  IF _field = 'payment_note' THEN
    UPDATE public.payments
    SET payment_note = _note,
        payment_note_updated_at = now(),
        payment_note_updated_by = _uid,
        payment_note_resolved_at = CASE
          WHEN _resolved IS NULL THEN payment_note_resolved_at
          WHEN _resolved THEN now()
          ELSE NULL END,
        payment_note_resolved_by = CASE
          WHEN _resolved IS NULL THEN payment_note_resolved_by
          WHEN _resolved THEN _uid
          ELSE NULL END
    WHERE id = _payment_id;
  ELSE
    UPDATE public.payments
    SET fawry_note = _note,
        fawry_note_updated_at = now(),
        fawry_note_updated_by = _uid,
        fawry_note_resolved_at = CASE
          WHEN _resolved IS NULL THEN fawry_note_resolved_at
          WHEN _resolved THEN now()
          ELSE NULL END,
        fawry_note_resolved_by = CASE
          WHEN _resolved IS NULL THEN fawry_note_resolved_by
          WHEN _resolved THEN _uid
          ELSE NULL END
    WHERE id = _payment_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_payment_note(uuid, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_payment_note(uuid, text, text, boolean) TO authenticated, service_role;

DROP POLICY IF EXISTS "Super admins can manage payments" ON public.payments;
CREATE POLICY "Super admins can manage payments"
ON public.payments
AS PERMISSIVE
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));