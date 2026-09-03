-- RLS policies call these SECURITY DEFINER helpers; without EXECUTE the anon role
-- gets "permission denied for function ..." instead of simply seeing zero rows.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon;
GRANT EXECUTE ON FUNCTION public.has_department(uuid, public.department) TO anon;
GRANT EXECUTE ON FUNCTION public.get_user_driver_id(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_user_supervisor_id(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_user_parent_ids(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_user_departments(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_employee(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_driver_or_supervisor(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_driver_parent(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_driver_registration(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_parent_route(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_parent_line_driver(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_parent_line_supervisor(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.can_read_conversation(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.can_send_in_conversation(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.conversation_type_of(uuid) TO anon;