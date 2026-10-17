ALTER TABLE public.daily_line_trips ADD COLUMN IF NOT EXISTS cancel_cutoff_hours smallint NOT NULL DEFAULT 2;
ALTER TABLE public.daily_line_trips ADD CONSTRAINT daily_line_trips_cancel_cutoff_chk CHECK (cancel_cutoff_hours IN (0,1,2));
COMMENT ON COLUMN public.daily_line_trips.cancel_cutoff_hours IS '0 = customer cannot cancel; 1 or 2 = hours before departure';
ALTER TABLE public.daily_line_bookings ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE public.daily_line_bookings ADD COLUMN IF NOT EXISTS cancelled_by text;

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
  UPDATE daily_line_bookings SET payment_status = 'cancelled', cancelled_at = now(),
    cancelled_by = CASE WHEN is_staff THEN 'staff' ELSE 'customer' END
  WHERE id = _booking_id;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_daily_line_trip(_trip_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_employee(auth.uid()) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  UPDATE daily_line_trips SET status = 'cancelled' WHERE id = _trip_id;
  UPDATE daily_line_bookings SET payment_status = 'cancelled', cancelled_at = now(), cancelled_by = 'staff'
  WHERE trip_id = _trip_id AND payment_status <> 'cancelled';
END $$;

REVOKE EXECUTE ON FUNCTION public.cancel_daily_line_booking(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancel_daily_line_trip(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_daily_line_booking(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_daily_line_trip(uuid) TO authenticated;