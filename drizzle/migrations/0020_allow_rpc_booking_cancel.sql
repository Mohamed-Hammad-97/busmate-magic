CREATE OR REPLACE FUNCTION public.enforce_daily_line_booking_update()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  is_staff boolean;
  is_parent boolean;
  is_driver boolean;
BEGIN
  IF current_setting('app.dl_cancel', true) = '1' THEN
    RETURN NEW;
  END IF;

  is_staff := public.has_role(auth.uid(), 'super_admin')
    OR public.has_department(auth.uid(), 'operation_daily_lines')
    OR public.has_department(auth.uid(), 'customer_support')
    OR public.has_department(auth.uid(), 'finance');

  IF is_staff OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  is_parent := OLD.parent_id IN (SELECT public.get_user_parent_ids(auth.uid()));
  is_driver := EXISTS (
    SELECT 1 FROM public.daily_line_trips t
    WHERE t.id = OLD.trip_id
      AND t.driver_id = public.get_user_driver_id(auth.uid())
  );

  IF is_parent AND NOT is_driver THEN
    IF NEW.parent_id IS DISTINCT FROM OLD.parent_id
      OR NEW.trip_id IS DISTINCT FROM OLD.trip_id
      OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
      OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
      OR NEW.original_price IS DISTINCT FROM OLD.original_price
      OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount
      OR NEW.final_price IS DISTINCT FROM OLD.final_price
      OR NEW.promocode_id IS DISTINCT FROM OLD.promocode_id
      OR NEW.boarding_code IS DISTINCT FROM OLD.boarding_code
      OR NEW.boarded_at IS DISTINCT FROM OLD.boarded_at
      OR NEW.dropped_at IS DISTINCT FROM OLD.dropped_at
      OR NEW.marked_paid_by IS DISTINCT FROM OLD.marked_paid_by
      OR NEW.marked_paid_at IS DISTINCT FROM OLD.marked_paid_at
      OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at
      OR NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by
    THEN
      RAISE EXCEPTION 'Parents may only update contact and pickup details on their bookings';
    END IF;
    RETURN NEW;
  END IF;

  IF is_driver THEN
    IF NEW.parent_id IS DISTINCT FROM OLD.parent_id
      OR NEW.trip_id IS DISTINCT FROM OLD.trip_id
      OR NEW.original_price IS DISTINCT FROM OLD.original_price
      OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount
      OR NEW.final_price IS DISTINCT FROM OLD.final_price
      OR NEW.promocode_id IS DISTINCT FROM OLD.promocode_id
      OR NEW.boarding_code IS DISTINCT FROM OLD.boarding_code
      OR NEW.passenger_name IS DISTINCT FROM OLD.passenger_name
      OR NEW.passenger_phone IS DISTINCT FROM OLD.passenger_phone
    THEN
      RAISE EXCEPTION 'Drivers may only update boarding, drop-off and cash payment status';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_daily_line_booking(_booking_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b record; t record; is_staff boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO b FROM daily_line_bookings WHERE id = _booking_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'booking_not_found'; END IF;
  IF b.payment_status = 'cancelled' THEN RETURN; END IF;
  SELECT * INTO t FROM daily_line_trips WHERE id = b.trip_id;
  is_staff := public.is_employee(auth.uid());
  IF NOT is_staff THEN
    IF b.parent_id IS NULL OR b.parent_id NOT IN (SELECT public.get_user_parent_ids(auth.uid())) THEN
      RAISE EXCEPTION 'not_allowed';
    END IF;
    IF b.payment_status <> 'pending' THEN RAISE EXCEPTION 'paid_contact_support'; END IF;
    IF t.status <> 'scheduled' OR t.cancel_cutoff_hours = 0 THEN RAISE EXCEPTION 'window_closed'; END IF;
    IF now() >= ((t.trip_date + t.departure_time) AT TIME ZONE 'Africa/Cairo') - make_interval(hours => t.cancel_cutoff_hours) THEN
      RAISE EXCEPTION 'window_closed';
    END IF;
  END IF;
  PERFORM set_config('app.dl_cancel', '1', true);
  UPDATE daily_line_bookings SET payment_status = 'cancelled', cancelled_at = now(),
    cancelled_by = CASE WHEN is_staff THEN 'staff' ELSE 'customer' END
  WHERE id = _booking_id;
  PERFORM set_config('app.dl_cancel', '', true);
END $$;

CREATE OR REPLACE FUNCTION public.cancel_daily_line_trip(_trip_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_employee(auth.uid()) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  PERFORM set_config('app.dl_cancel', '1', true);
  UPDATE daily_line_trips SET status = 'cancelled' WHERE id = _trip_id;
  UPDATE daily_line_bookings SET payment_status = 'cancelled', cancelled_at = now(), cancelled_by = 'staff'
  WHERE trip_id = _trip_id AND payment_status <> 'cancelled';
  PERFORM set_config('app.dl_cancel', '', true);
END $$;