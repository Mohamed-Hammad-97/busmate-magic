ALTER TABLE public.daily_line_trips REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_line_trips;