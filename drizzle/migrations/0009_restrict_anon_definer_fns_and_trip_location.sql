-- 1) Ensure policies that call SECURITY DEFINER helpers only apply to logged-in roles
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND roles = '{public}'
      AND (
        coalesce(qual,'') ~ '(has_role|has_department|is_employee|get_user_|can_read_conversation|can_send_in_conversation|conversation_type_of|is_conversation_participant|is_driver_or_supervisor|is_driver_parent|is_driver_registration|is_parent_line_driver|is_parent_line_supervisor|is_parent_route)\('
        OR coalesce(with_check,'') ~ '(has_role|has_department|is_employee|get_user_|can_read_conversation|can_send_in_conversation|conversation_type_of|is_conversation_participant|is_driver_or_supervisor|is_driver_parent|is_driver_registration|is_parent_line_driver|is_parent_line_supervisor|is_parent_route)\('
      )
  LOOP
    EXECUTE format('ALTER POLICY %I ON %I.%I TO authenticated', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- 2) Revoke EXECUTE on SECURITY DEFINER helpers from anonymous/public
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f.sig);
  END LOOP;
END $$;

-- 3) Hide live GPS coordinates of daily line trips from anonymous visitors
REVOKE SELECT ON public.daily_line_trips FROM anon;
GRANT SELECT (
  id, line_id, trip_date, departure_time, total_seats, available_seats,
  cash_price, instapay_price, status, created_at, updated_at
) ON public.daily_line_trips TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_line_trips TO authenticated;
GRANT ALL ON public.daily_line_trips TO service_role;