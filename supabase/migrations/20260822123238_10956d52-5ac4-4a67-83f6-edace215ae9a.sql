
CREATE OR REPLACE FUNCTION public.enforce_parent_registration_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT public.is_employee(auth.uid())
     AND (
       OLD.parent_id IN (SELECT public.get_user_parent_ids(auth.uid()))
       OR NEW.parent_id IN (SELECT public.get_user_parent_ids(auth.uid()))
     )
  THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.parent_id IS DISTINCT FROM OLD.parent_id
       OR NEW.school_id IS DISTINCT FROM OLD.school_id
       OR NEW.grade IS DISTINCT FROM OLD.grade
       OR NEW.education_department IS DISTINCT FROM OLD.education_department
       OR NEW.car_type IS DISTINCT FROM OLD.car_type
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.student_name IS DISTINCT FROM OLD.student_name
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
    THEN
      RAISE EXCEPTION 'Parents may only update the student photo';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_daily_line_booking_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_parent boolean := false;
  is_driver boolean := false;
BEGIN
  IF auth.uid() IS NULL OR public.is_employee(auth.uid()) THEN
    RETURN NEW;
  END IF;

  is_parent := (OLD.parent_id IS NOT NULL AND OLD.parent_id IN (SELECT public.get_user_parent_ids(auth.uid())))
            OR (NEW.parent_id IS NOT NULL AND NEW.parent_id IN (SELECT public.get_user_parent_ids(auth.uid())));

  is_driver := EXISTS (
    SELECT 1 FROM public.daily_line_trips t
    WHERE t.id IN (OLD.trip_id, NEW.trip_id)
      AND t.driver_id IS NOT NULL
      AND t.driver_id = public.get_user_driver_id(auth.uid())
  );

  IF is_parent AND NOT is_driver THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.trip_id IS DISTINCT FROM OLD.trip_id
       OR NEW.parent_id IS DISTINCT FROM OLD.parent_id
       OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
       OR NEW.promocode_id IS DISTINCT FROM OLD.promocode_id
       OR NEW.original_price IS DISTINCT FROM OLD.original_price
       OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount
       OR NEW.final_price IS DISTINCT FROM OLD.final_price
       OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
       OR NEW.boarding_code IS DISTINCT FROM OLD.boarding_code
       OR NEW.boarded_at IS DISTINCT FROM OLD.boarded_at
       OR NEW.dropped_at IS DISTINCT FROM OLD.dropped_at
       OR NEW.marked_paid_by IS DISTINCT FROM OLD.marked_paid_by
       OR NEW.marked_paid_at IS DISTINCT FROM OLD.marked_paid_at
    THEN
      RAISE EXCEPTION 'Parents may only update passenger details, stations or payment proof';
    END IF;
    RETURN NEW;
  END IF;

  IF is_driver THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.trip_id IS DISTINCT FROM OLD.trip_id
       OR NEW.parent_id IS DISTINCT FROM OLD.parent_id
       OR NEW.passenger_name IS DISTINCT FROM OLD.passenger_name
       OR NEW.passenger_phone IS DISTINCT FROM OLD.passenger_phone
       OR NEW.pickup_station_id IS DISTINCT FROM OLD.pickup_station_id
       OR NEW.dropoff_station_id IS DISTINCT FROM OLD.dropoff_station_id
       OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
       OR NEW.promocode_id IS DISTINCT FROM OLD.promocode_id
       OR NEW.original_price IS DISTINCT FROM OLD.original_price
       OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount
       OR NEW.final_price IS DISTINCT FROM OLD.final_price
       OR NEW.payment_proof_url IS DISTINCT FROM OLD.payment_proof_url
    THEN
      RAISE EXCEPTION 'Drivers may only update boarding, drop-off and cash payment settlement';
    END IF;

    IF NEW.payment_status IS DISTINCT FROM OLD.payment_status
       AND (OLD.payment_method <> 'cash'
            OR OLD.payment_status <> 'pending'
            OR NEW.payment_status NOT IN ('paid', 'cancelled'))
    THEN
      RAISE EXCEPTION 'Drivers may only settle pending cash bookings as paid or cancelled';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_parent_registration_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_daily_line_booking_update() FROM PUBLIC, anon, authenticated;
