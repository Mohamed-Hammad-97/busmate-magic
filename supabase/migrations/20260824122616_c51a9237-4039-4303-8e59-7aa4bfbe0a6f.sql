CREATE OR REPLACE FUNCTION public.parent_booking_update_is_safe(
  _id uuid,
  _trip_id uuid,
  _parent_id uuid,
  _payment_method daily_line_payment_method,
  _payment_status daily_line_payment_status,
  _promocode_id uuid,
  _original_price numeric,
  _discount_amount numeric,
  _final_price numeric,
  _boarding_code text,
  _boarded_at timestamptz,
  _dropped_at timestamptz,
  _marked_paid_by uuid,
  _marked_paid_at timestamptz
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.daily_line_bookings b
    WHERE b.id = _id
      AND b.trip_id IS NOT DISTINCT FROM _trip_id
      AND b.parent_id IS NOT DISTINCT FROM _parent_id
      AND b.payment_method IS NOT DISTINCT FROM _payment_method
      AND b.payment_status IS NOT DISTINCT FROM _payment_status
      AND b.promocode_id IS NOT DISTINCT FROM _promocode_id
      AND b.original_price IS NOT DISTINCT FROM _original_price
      AND b.discount_amount IS NOT DISTINCT FROM _discount_amount
      AND b.final_price IS NOT DISTINCT FROM _final_price
      AND b.boarding_code IS NOT DISTINCT FROM _boarding_code
      AND b.boarded_at IS NOT DISTINCT FROM _boarded_at
      AND b.dropped_at IS NOT DISTINCT FROM _dropped_at
      AND b.marked_paid_by IS NOT DISTINCT FROM _marked_paid_by
      AND b.marked_paid_at IS NOT DISTINCT FROM _marked_paid_at
  )
$$;

REVOKE EXECUTE ON FUNCTION public.parent_booking_update_is_safe(uuid, uuid, uuid, daily_line_payment_method, daily_line_payment_status, uuid, numeric, numeric, numeric, text, timestamptz, timestamptz, uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.parent_booking_update_is_safe(uuid, uuid, uuid, daily_line_payment_method, daily_line_payment_status, uuid, numeric, numeric, numeric, text, timestamptz, timestamptz, uuid, timestamptz) TO authenticated, service_role;

DROP POLICY IF EXISTS "Parents update own bookings" ON public.daily_line_bookings;
CREATE POLICY "Parents update own bookings"
ON public.daily_line_bookings
FOR UPDATE
TO authenticated
USING (parent_id IN (SELECT public.get_user_parent_ids(auth.uid())))
WITH CHECK (
  parent_id IN (SELECT public.get_user_parent_ids(auth.uid()))
  AND public.parent_booking_update_is_safe(
    id, trip_id, parent_id, payment_method, payment_status, promocode_id,
    original_price, discount_amount, final_price, boarding_code,
    boarded_at, dropped_at, marked_paid_by, marked_paid_at
  )
);

CREATE OR REPLACE FUNCTION public.parent_registration_update_is_safe(
  _id uuid,
  _parent_id uuid,
  _school_id uuid,
  _grade text,
  _education_department education_department,
  _car_type car_type,
  _status registration_status,
  _student_name text,
  _created_by uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.registrations r
    WHERE r.id = _id
      AND r.parent_id IS NOT DISTINCT FROM _parent_id
      AND r.school_id IS NOT DISTINCT FROM _school_id
      AND r.grade IS NOT DISTINCT FROM _grade
      AND r.education_department IS NOT DISTINCT FROM _education_department
      AND r.car_type IS NOT DISTINCT FROM _car_type
      AND r.status IS NOT DISTINCT FROM _status
      AND r.student_name IS NOT DISTINCT FROM _student_name
      AND r.created_by IS NOT DISTINCT FROM _created_by
  )
$$;

REVOKE EXECUTE ON FUNCTION public.parent_registration_update_is_safe(uuid, uuid, uuid, text, education_department, car_type, registration_status, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.parent_registration_update_is_safe(uuid, uuid, uuid, text, education_department, car_type, registration_status, text, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Parents can update student photo" ON public.registrations;
CREATE POLICY "Parents can update student photo"
ON public.registrations
FOR UPDATE
TO authenticated
USING (parent_id IN (SELECT public.get_user_parent_ids(auth.uid())))
WITH CHECK (
  parent_id IN (SELECT public.get_user_parent_ids(auth.uid()))
  AND public.parent_registration_update_is_safe(
    id, parent_id, school_id, grade, education_department, car_type, status, student_name, created_by
  )
);