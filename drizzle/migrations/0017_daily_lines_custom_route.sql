ALTER TABLE public.daily_lines ADD COLUMN IF NOT EXISTS route_waypoints jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.daily_lines ADD COLUMN IF NOT EXISTS route_mode text NOT NULL DEFAULT 'road';
ALTER TABLE public.daily_lines ADD CONSTRAINT daily_lines_route_mode_check CHECK (route_mode IN ('road','free'));