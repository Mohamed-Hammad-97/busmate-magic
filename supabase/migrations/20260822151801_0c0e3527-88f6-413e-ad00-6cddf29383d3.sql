CREATE OR REPLACE FUNCTION public.conversation_type_of(_conversation_id uuid)
RETURNS public.conversation_type
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT type FROM public.unified_conversations WHERE id = _conversation_id
$$;

CREATE OR REPLACE FUNCTION public.can_read_conversation(_user_id uuid, _conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _user_id IS NOT NULL
    AND (
      public.is_conversation_participant(_user_id, _conversation_id)
      OR public.has_role(_user_id, 'super_admin')
      OR (
        EXISTS (
          SELECT 1 FROM public.employees e
          WHERE e.user_id = _user_id
            AND 'customer_support'::department = ANY(e.departments)
        )
        AND public.conversation_type_of(_conversation_id)
            IN ('customer_support'::conversation_type, 'customer_dm'::conversation_type, 'route_group'::conversation_type)
      )
      OR (
        EXISTS (
          SELECT 1 FROM public.employees e
          WHERE e.user_id = _user_id
            AND 'operations'::department = ANY(e.departments)
        )
        AND public.conversation_type_of(_conversation_id) = 'route_group'::conversation_type
      )
    )
$$;

REVOKE EXECUTE ON FUNCTION public.conversation_type_of(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_read_conversation(uuid, uuid) FROM anon;

-- unified_conversations
DROP POLICY IF EXISTS "CS and Ops employees can view all conversations" ON public.unified_conversations;
DROP POLICY IF EXISTS "Participants can view their conversations" ON public.unified_conversations;
CREATE POLICY "Readers can view conversations"
ON public.unified_conversations FOR SELECT TO authenticated
USING (public.can_read_conversation(auth.uid(), id));

-- unified_messages
DROP POLICY IF EXISTS "CS and Ops can view all messages" ON public.unified_messages;
DROP POLICY IF EXISTS "Participants can view messages in their conversations" ON public.unified_messages;
CREATE POLICY "Readers can view messages"
ON public.unified_messages FOR SELECT TO authenticated
USING (public.can_read_conversation(auth.uid(), conversation_id));

DROP POLICY IF EXISTS "Participants can mark messages read" ON public.unified_messages;
CREATE POLICY "Participants can mark messages read"
ON public.unified_messages FOR UPDATE TO authenticated
USING (public.is_conversation_participant(auth.uid(), conversation_id));

-- conversation_participants
DROP POLICY IF EXISTS "CS and Ops can view all participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Participants can view members of their conversations" ON public.conversation_participants;
CREATE POLICY "Readers can view participants"
ON public.conversation_participants FOR SELECT TO authenticated
USING (public.can_read_conversation(auth.uid(), conversation_id));

DROP POLICY IF EXISTS "Employees can manage participants" ON public.conversation_participants;
CREATE POLICY "Super admins can manage participants"
ON public.conversation_participants FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Employees can add participants to their conversations"
ON public.conversation_participants FOR INSERT TO authenticated
WITH CHECK (public.is_employee(auth.uid()) AND public.can_read_conversation(auth.uid(), conversation_id));

CREATE POLICY "Employees can remove participants from their conversations"
ON public.conversation_participants FOR DELETE TO authenticated
USING (public.is_employee(auth.uid()) AND public.can_read_conversation(auth.uid(), conversation_id));

-- allow parents to create the customer_support type too
DROP POLICY IF EXISTS "Parents can create customer_supervisor conversations" ON public.unified_conversations;
CREATE POLICY "Parents can create direct conversations"
ON public.unified_conversations FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND type IN ('customer_supervisor'::conversation_type, 'customer_support'::conversation_type)
);

-- legacy support chat: super admin read access
CREATE POLICY "Super admins can view legacy conversations"
ON public.chat_conversations FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can view legacy messages"
ON public.chat_messages FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));