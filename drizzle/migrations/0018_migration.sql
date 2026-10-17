ALTER TABLE public.daily_line_stations ADD COLUMN IF NOT EXISTS minutes_from_start integer;
ALTER TABLE public.daily_line_bookings ADD COLUMN IF NOT EXISTS stop_requested_at timestamptz;

CREATE OR REPLACE FUNCTION public.request_daily_line_stop(_booking_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  UPDATE public.daily_line_bookings b
     SET stop_requested_at = now()
   WHERE b.id = _booking_id
     AND b.parent_id IN (SELECT public.get_user_parent_ids(auth.uid()))
     AND b.boarded_at IS NOT NULL AND b.dropped_at IS NULL
     AND (b.stop_requested_at IS NULL OR b.stop_requested_at < now() - interval '1 minute');
  IF NOT FOUND THEN RAISE EXCEPTION 'Stop request not allowed'; END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.request_daily_line_stop(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_daily_line_stop(uuid) TO authenticated;