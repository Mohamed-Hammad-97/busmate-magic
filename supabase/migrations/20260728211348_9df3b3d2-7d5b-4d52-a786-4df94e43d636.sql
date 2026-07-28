ALTER POLICY "Super admins can manage partners"
ON public.homepage_partners
TO authenticated;

ALTER POLICY "Super admins can manage gallery"
ON public.homepage_gallery
TO authenticated;

ALTER POLICY "Super admins can manage homepage settings"
ON public.homepage_settings
TO authenticated;