
-- Allow parents to update student_photo_url on their own registrations
CREATE POLICY "Parents can update student photo"
ON public.registrations FOR UPDATE
TO authenticated
USING (parent_id IN (SELECT get_user_parent_ids(auth.uid())))
WITH CHECK (parent_id IN (SELECT get_user_parent_ids(auth.uid())));
