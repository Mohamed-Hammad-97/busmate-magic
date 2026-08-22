-- Harden parent updates on daily_line_bookings
DROP POLICY IF EXISTS "Parents update own bookings" ON public.daily_line_bookings;

CREATE POLICY "Parents update own bookings"
ON public.daily_line_bookings
FOR UPDATE
TO authenticated
USING (parent_id IN (SELECT public.get_user_parent_ids(auth.uid())))
WITH CHECK (parent_id IN (SELECT public.get_user_parent_ids(auth.uid())));

-- Column-level enforcement via trigger (policies cannot compare OLD/NEW)
CREATE OR REPLACE FUNCTION public.enforce_daily_line_booking_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_staff boolean;
  is_parent boolean;
  is_driver boolean;
BEGIN
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
    -- Parents may not change ownership, pricing, payment or boarding identity fields
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
$$;

DROP TRIGGER IF EXISTS trg_enforce_daily_line_booking_update ON public.daily_line_bookings;
CREATE TRIGGER trg_enforce_daily_line_booking_update
BEFORE UPDATE ON public.daily_line_bookings
FOR EACH ROW EXECUTE FUNCTION public.enforce_daily_line_booking_update();