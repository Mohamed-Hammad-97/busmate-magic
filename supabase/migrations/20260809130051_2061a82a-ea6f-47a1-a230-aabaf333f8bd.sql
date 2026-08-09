-- 1. Restrict parent updates on registrations to student_photo_url only
CREATE OR REPLACE FUNCTION public.enforce_parent_registration_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Staff/service paths bypass; only constrain when caller is a parent of this row
  IF auth.uid() IS NOT NULL
     AND NOT public.is_employee(auth.uid())
     AND NEW.parent_id IN (SELECT public.get_user_parent_ids(auth.uid()))
  THEN
    IF NEW.parent_id IS DISTINCT FROM OLD.parent_id
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
$$;

DROP TRIGGER IF EXISTS trg_enforce_parent_registration_update ON public.registrations;
CREATE TRIGGER trg_enforce_parent_registration_update
BEFORE UPDATE ON public.registrations
FOR EACH ROW EXECUTE FUNCTION public.enforce_parent_registration_update();

-- 2. Promo codes are no longer publicly listable
DROP POLICY IF EXISTS "Public can view active promocodes" ON public.daily_line_promocodes;
REVOKE ALL ON public.daily_line_promocodes FROM anon;

-- 3. Revoke anon EXECUTE on internal SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_otps() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.log_sensitive_data_access(text, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_user_departments(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_user_driver_id(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_user_parent_ids(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_user_supervisor_id(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_send_in_conversation(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_driver_or_supervisor(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_driver_parent(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_driver_registration(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_employee(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_parent_route(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.enforce_parent_registration_update() FROM anon, public;

GRANT EXECUTE ON FUNCTION public.get_user_departments(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_driver_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_parent_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_supervisor_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_send_in_conversation(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_driver_or_supervisor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_driver_parent(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_driver_registration(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_employee(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_parent_route(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_sensitive_data_access(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_otps() TO service_role;