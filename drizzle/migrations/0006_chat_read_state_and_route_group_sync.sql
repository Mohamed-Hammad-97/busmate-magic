ALTER TABLE public.conversation_participants
  ADD COLUMN IF NOT EXISTS last_read_at timestamptz;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.conversation_participants
  SET last_read_at = now()
  WHERE conversation_id = _conversation_id
    AND user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_route_group_participants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _route_id uuid;
  _registration_id uuid;
  _conv_id uuid;
  _parent_id uuid;
  _parent_user uuid;
  _still_assigned boolean;
BEGIN
  IF TG_TABLE_NAME = 'route_assignments' THEN
    _route_id := COALESCE(NEW.route_id, OLD.route_id);
    _registration_id := COALESCE(NEW.registration_id, OLD.registration_id);
  ELSE
    SELECT ra.route_id INTO _route_id
    FROM public.route_assignments ra
    WHERE ra.registration_id = NEW.id
    LIMIT 1;
    _registration_id := NEW.id;
  END IF;

  IF _route_id IS NULL OR _registration_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT id INTO _conv_id
  FROM public.unified_conversations
  WHERE type = 'route_group' AND route_id = _route_id
  LIMIT 1;

  IF _conv_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT r.parent_id INTO _parent_id
  FROM public.registrations r
  WHERE r.id = _registration_id;

  IF _parent_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT pa.user_id INTO _parent_user
  FROM public.parent_accounts pa
  WHERE pa.id = _parent_id;

  IF _parent_user IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.route_assignments ra
    JOIN public.registrations r ON r.id = ra.registration_id
    WHERE ra.route_id = _route_id
      AND r.parent_id = _parent_id
      AND r.status NOT IN ('cancelled', 'archived')
  ) INTO _still_assigned;

  IF _still_assigned THEN
    INSERT INTO public.conversation_participants
      (conversation_id, user_id, participant_type, participant_ref_id, can_send)
    SELECT _conv_id, _parent_user, 'parent', _parent_id, false
    WHERE NOT EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = _conv_id AND cp.user_id = _parent_user
    );
  ELSE
    DELETE FROM public.conversation_participants cp
    WHERE cp.conversation_id = _conv_id
      AND cp.user_id = _parent_user
      AND cp.participant_type = 'parent';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_route_group_participants_assign ON public.route_assignments;
CREATE TRIGGER trg_sync_route_group_participants_assign
AFTER INSERT OR DELETE ON public.route_assignments
FOR EACH ROW EXECUTE FUNCTION public.sync_route_group_participants();

DROP TRIGGER IF EXISTS trg_sync_route_group_participants_status ON public.registrations;
CREATE TRIGGER trg_sync_route_group_participants_status
AFTER UPDATE OF status ON public.registrations
FOR EACH ROW EXECUTE FUNCTION public.sync_route_group_participants();