
-- Add student_photo_url column to registrations table
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS student_photo_url TEXT DEFAULT NULL;

-- Create storage bucket for student photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-photos', 'student-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload student photos
CREATE POLICY "Parents can upload student photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'student-photos');

-- Allow public read access for student photos
CREATE POLICY "Public read access for student photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'student-photos');

-- Allow authenticated users to update/delete their photos
CREATE POLICY "Parents can update student photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'student-photos');

CREATE POLICY "Parents can delete student photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'student-photos');
