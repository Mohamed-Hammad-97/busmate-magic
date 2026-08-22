CREATE OR REPLACE FUNCTION public.enforce_daily_line_booking_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_parent boolean := false;
  is_driver boolean := false;
BEGIN
  IF auth.uid() IS NULL OR public.is_employee(auth.uid()) THEN
    RETURN NEW;
  END IF;

  is_parent := NEW.parent_id IS NOT NULL
    AND NEW.parent_id IN (SELECT public.get_user_parent_ids(auth.uid()));

  is_driver := EXISTS (
    SELECT 1 FROM public.daily_line_trips t
    WHERE t.id = NEW.trip_id
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
       OR NEW.boarding_code IS DISTINCT FROM OLD.boarding_code
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
$$;

DROP TRIGGER IF EXISTS trg_enforce_daily_line_booking_update ON public.daily_line_bookings;
CREATE TRIGGER trg_enforce_daily_line_booking_update
BEFORE UPDATE ON public.daily_line_bookings
FOR EACH ROW EXECUTE FUNCTION public.enforce_daily_line_booking_update();

CREATE OR REPLACE FUNCTION public.enforce_daily_line_trip_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_employee(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.driver_id IS NOT NULL AND NEW.driver_id = public.get_user_driver_id(auth.uid()) THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.line_id IS DISTINCT FROM OLD.line_id
       OR NEW.trip_date IS DISTINCT FROM OLD.trip_date
       OR NEW.departure_time IS DISTINCT FROM OLD.departure_time
       OR NEW.total_seats IS DISTINCT FROM OLD.total_seats
       OR NEW.available_seats IS DISTINCT FROM OLD.available_seats
       OR NEW.cash_price IS DISTINCT FROM OLD.cash_price
       OR NEW.instapay_price IS DISTINCT FROM OLD.instapay_price
       OR NEW.driver_id IS DISTINCT FROM OLD.driver_id
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
    THEN
      RAISE EXCEPTION 'Drivers may only update trip status, location and timings';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_daily_line_trip_update ON public.daily_line_trips;
CREATE TRIGGER trg_enforce_daily_line_trip_update
BEFORE UPDATE ON public.daily_line_trips
FOR EACH ROW EXECUTE FUNCTION public.enforce_daily_line_trip_update();