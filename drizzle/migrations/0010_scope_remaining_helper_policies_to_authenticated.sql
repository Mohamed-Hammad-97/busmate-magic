DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND roles = '{public}'
      AND (
        coalesce(qual,'') ~ '(has_role|has_department|is_employee|get_user_[a-z_]*|can_read_conversation|can_send_in_conversation|conversation_type_of|is_conversation_participant|is_driver_or_supervisor|is_driver_parent|is_driver_registration|is_parent_line_driver|is_parent_line_supervisor|is_parent_route)\s*\('
        OR coalesce(with_check,'') ~ '(has_role|has_department|is_employee|get_user_[a-z_]*|can_read_conversation|can_send_in_conversation|conversation_type_of|is_conversation_participant|is_driver_or_supervisor|is_driver_parent|is_driver_registration|is_parent_line_driver|is_parent_line_supervisor|is_parent_route)\s*\('
      )
  LOOP
    EXECUTE format('ALTER POLICY %I ON %I.%I TO authenticated', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;