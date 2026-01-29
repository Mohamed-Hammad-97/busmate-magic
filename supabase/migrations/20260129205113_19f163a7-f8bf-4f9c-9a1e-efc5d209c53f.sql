-- Create storage bucket for homepage assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('homepage-assets', 'homepage-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to homepage assets
CREATE POLICY "Public can view homepage assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'homepage-assets');

-- Allow super admins to upload homepage assets
CREATE POLICY "Super admins can upload homepage assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'homepage-assets' 
  AND public.has_role(auth.uid(), 'super_admin')
);

-- Allow super admins to update homepage assets
CREATE POLICY "Super admins can update homepage assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'homepage-assets' 
  AND public.has_role(auth.uid(), 'super_admin')
);

-- Allow super admins to delete homepage assets
CREATE POLICY "Super admins can delete homepage assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'homepage-assets' 
  AND public.has_role(auth.uid(), 'super_admin')
);