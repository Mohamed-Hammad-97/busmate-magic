ALTER TABLE public.daily_line_trips ADD COLUMN IF NOT EXISTS reopened_at timestamptz, ADD COLUMN IF NOT EXISTS reopened_by uuid;
CREATE OR REPLACE FUNCTION public.reopen_daily_line_trip(_trip_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN RAISE EXCEPTION 'Only super admins can reopen trips'; END IF;
  UPDATE public.daily_line_trips SET status='in_progress', completed_at=NULL, reopened_at=now(), reopened_by=auth.uid()
  WHERE id=_trip_id AND status='completed';
  IF NOT FOUND THEN RAISE EXCEPTION 'Only completed trips can be reopened'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.reopen_daily_line_trip(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reopen_daily_line_trip(uuid) TO authenticated;