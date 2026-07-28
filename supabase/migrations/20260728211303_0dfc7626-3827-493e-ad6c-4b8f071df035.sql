GRANT SELECT ON public.homepage_partners TO anon, authenticated;
GRANT ALL ON public.homepage_partners TO service_role;

GRANT SELECT ON public.homepage_gallery TO anon, authenticated;
GRANT ALL ON public.homepage_gallery TO service_role;

GRANT SELECT ON public.homepage_settings TO anon, authenticated;
GRANT ALL ON public.homepage_settings TO service_role;