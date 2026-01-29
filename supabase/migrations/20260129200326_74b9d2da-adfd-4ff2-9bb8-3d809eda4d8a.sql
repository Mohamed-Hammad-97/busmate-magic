-- Homepage Settings table for text content and app links
CREATE TABLE public.homepage_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.homepage_settings ENABLE ROW LEVEL SECURITY;

-- Public can read settings
CREATE POLICY "Public can view homepage settings"
ON public.homepage_settings
FOR SELECT
USING (true);

-- Only super admins can manage settings
CREATE POLICY "Super admins can manage homepage settings"
ON public.homepage_settings
FOR ALL
USING (has_role(auth.uid(), 'super_admin'))
WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Partners table
CREATE TABLE public.homepage_partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    logo_url TEXT,
    website_url TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.homepage_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active partners"
ON public.homepage_partners
FOR SELECT
USING (is_active = true);

CREATE POLICY "Super admins can manage partners"
ON public.homepage_partners
FOR ALL
USING (has_role(auth.uid(), 'super_admin'))
WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Gallery images table
CREATE TABLE public.homepage_gallery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    image_url TEXT NOT NULL,
    alt_text TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.homepage_gallery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active gallery images"
ON public.homepage_gallery
FOR SELECT
USING (is_active = true);

CREATE POLICY "Super admins can manage gallery"
ON public.homepage_gallery
FOR ALL
USING (has_role(auth.uid(), 'super_admin'))
WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Contact form submissions table
CREATE TABLE public.contact_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    notes TEXT,
    handled_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

-- Anyone can submit contact form (no auth required)
CREATE POLICY "Anyone can submit contact form"
ON public.contact_submissions
FOR INSERT
WITH CHECK (true);

-- Customer support can view and manage submissions
CREATE POLICY "Customer support can manage contact submissions"
ON public.contact_submissions
FOR ALL
USING (has_department(auth.uid(), 'customer_support'))
WITH CHECK (has_department(auth.uid(), 'customer_support'));

-- Super admins can manage contact submissions
CREATE POLICY "Super admins can manage contact submissions"
ON public.contact_submissions
FOR ALL
USING (has_role(auth.uid(), 'super_admin'))
WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Insert default homepage settings
INSERT INTO public.homepage_settings (key, value) VALUES
('hero_title', 'Smart, Reliable, and Effortless Transportation'),
('hero_subtitle', 'Book your ride. Track every trip. Manage your fleet — all in one place. For Schools, Businesses, and Individuals.'),
('about_title', 'About Seater'),
('about_text', 'At Seater, we''re redefining transportation with passion, innovation, and a vision for a sustainable future. From schools and parents to corporate clients, we deliver safe, reliable, and comfortable rides, giving families peace of mind and businesses travel they can trust.'),
('app_store_url', NULL),
('google_play_url', NULL),
('cairo_address', '5th Settlement, New Cairo, Egypt'),
('cairo_phone', '+20 123 456 7890'),
('cairo_email', 'cairo@seater.com'),
('alex_address', 'Smouha, Alexandria, Egypt'),
('alex_phone', '+20 123 456 7891'),
('alex_email', 'alex@seater.com'),
('stats_users', '10K+'),
('stats_schools', '500+'),
('stats_cities', '50+');

-- Add updated_at triggers
CREATE TRIGGER update_homepage_settings_updated_at BEFORE UPDATE ON public.homepage_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_homepage_partners_updated_at BEFORE UPDATE ON public.homepage_partners FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_homepage_gallery_updated_at BEFORE UPDATE ON public.homepage_gallery FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contact_submissions_updated_at BEFORE UPDATE ON public.contact_submissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();