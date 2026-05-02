CREATE POLICY "Daily line passengers can view assigned drivers"
ON public.drivers
FOR SELECT
TO public
USING (
  id IN (
    SELECT t.driver_id
    FROM public.daily_line_trips t
    JOIN public.daily_line_bookings b ON b.trip_id = t.id
    WHERE t.driver_id IS NOT NULL
      AND b.payment_status <> 'cancelled'
      AND (
        b.parent_id IN (SELECT public.get_user_parent_ids(auth.uid()))
      )
  )
);