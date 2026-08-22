REVOKE ALL ON FUNCTION public.conversation_type_of(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_read_conversation(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conversation_type_of(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_read_conversation(uuid, uuid) TO authenticated, service_role;