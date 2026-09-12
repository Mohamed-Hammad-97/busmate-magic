CREATE OR REPLACE FUNCTION public.mark_conversation_read(_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _updated int;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF NOT public.can_read_conversation(_uid, _conversation_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.conversation_participants
  SET last_read_at = now()
  WHERE conversation_id = _conversation_id
    AND user_id = _uid;

  GET DIAGNOSTICS _updated = ROW_COUNT;

  IF _updated = 0 AND public.is_employee(_uid) THEN
    INSERT INTO public.conversation_participants
      (conversation_id, user_id, participant_type, participant_ref_id, can_send, last_read_at)
    SELECT _conversation_id, _uid, 'employee',
           (SELECT e.id FROM public.employees e WHERE e.user_id = _uid LIMIT 1),
           true, now();
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;