-- Staff present in public.employees but without a user_roles row were blocked
-- from creating conversations by is_employee(). Allow them explicitly.
DROP POLICY IF EXISTS "Employee records can create conversations" ON public.unified_conversations;
CREATE POLICY "Employee records can create conversations"
ON public.unified_conversations
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.employees e WHERE e.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Employee records can add participants" ON public.conversation_participants;
CREATE POLICY "Employee records can add participants"
ON public.conversation_participants
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.employees e WHERE e.user_id = auth.uid())
);