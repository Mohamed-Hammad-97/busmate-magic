
-- 1) Homepage assets: remove broad SELECT policy that allowed listing.
-- The bucket stays public so direct file URLs still work via the CDN,
-- but the API can no longer enumerate every file in the bucket.
DROP POLICY IF EXISTS "Public can view homepage assets" ON storage.objects;

-- 2) SECURITY DEFINER helpers: revoke EXECUTE from anon and PUBLIC.
-- These functions are only used from RLS policies evaluated for signed-in
-- users, so anonymous callers should never be able to invoke them directly
-- through the Data API.
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'get_user_driver_id(uuid)',
    'get_user_supervisor_id(uuid)',
    'get_user_parent_ids(uuid)',
    'get_user_departments(uuid)',
    'has_role(uuid, app_role)',
    'has_department(uuid, department)',
    'is_employee(uuid)',
    'is_driver_or_supervisor(uuid)',
    'is_conversation_participant(uuid, uuid)',
    'can_send_in_conversation(uuid, uuid)',
    'is_parent_route(uuid, uuid)',
    'is_driver_registration(uuid, uuid)',
    'is_driver_parent(uuid, uuid)',
    'log_sensitive_data_access(text, uuid)',
    'cleanup_expired_otps()'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', fn);
  END LOOP;
END$$;
