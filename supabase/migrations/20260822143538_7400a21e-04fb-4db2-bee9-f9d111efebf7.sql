CREATE POLICY "Parents can view own subscriptions"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (
  registration_id IN (
    SELECT r.id FROM public.registrations r
    WHERE r.parent_id IN (SELECT public.get_user_parent_ids(auth.uid()))
  )
);

GRANT SELECT ON public.subscriptions TO authenticated;