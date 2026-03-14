
DROP POLICY IF EXISTS "System can add parent participants" ON public.conversation_participants;

CREATE POLICY "System can add parent participants"
ON public.conversation_participants
FOR INSERT
TO public
WITH CHECK (
  (auth.uid() IS NOT NULL)
  AND (participant_type = 'parent')
  AND (user_id = auth.uid())
  AND EXISTS (SELECT 1 FROM parent_accounts WHERE user_id = auth.uid())
);
