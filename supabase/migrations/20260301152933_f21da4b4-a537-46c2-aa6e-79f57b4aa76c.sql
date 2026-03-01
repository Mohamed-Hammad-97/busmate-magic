-- Make the student-photos bucket private
UPDATE storage.buckets SET public = false WHERE id = 'student-photos';

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Parents can upload student photos" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for student photos" ON storage.objects;
DROP POLICY IF EXISTS "Parents can update student photos" ON storage.objects;
DROP POLICY IF EXISTS "Parents can delete student photos" ON storage.objects;

-- Only parents can upload photos for their own students (folder = parent_account.id)
CREATE POLICY "Parents upload own student photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'student-photos'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM parent_accounts WHERE user_id = auth.uid()
  )
);

-- Only parents and employees can view student photos
CREATE POLICY "Authorized users view student photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'student-photos'
  AND (
    is_employee(auth.uid())
    OR (storage.foldername(name))[1] IN (
      SELECT id::text FROM parent_accounts WHERE user_id = auth.uid()
    )
  )
);

-- Parents can update/delete only their own student photos
CREATE POLICY "Parents update own student photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'student-photos'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM parent_accounts WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Parents delete own student photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'student-photos'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM parent_accounts WHERE user_id = auth.uid()
  )
);