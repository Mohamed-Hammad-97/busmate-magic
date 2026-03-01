
-- Company portal chat messages (supervisor ↔ drivers, supervisor ↔ Seater)
CREATE TABLE public.company_portal_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  channel_type text NOT NULL, -- 'driver_chat', 'seater_support'
  channel_ref_id text, -- driver_id or null for seater
  sender_type text NOT NULL, -- 'company_account', 'driver', 'seater_employee'
  sender_id text NOT NULL,
  sender_name text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.company_portal_messages ENABLE ROW LEVEL SECURITY;

-- Accessed only via edge functions (service role)
CREATE POLICY "No direct access to company portal messages"
  ON public.company_portal_messages FOR ALL
  USING (false)
  WITH CHECK (false);

-- Company notifications for trip status changes
CREATE TABLE public.company_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  notification_type text NOT NULL, -- 'trip_started', 'trip_completed', 'trip_cancelled'
  title text NOT NULL,
  message text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.company_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct access to company notifications"
  ON public.company_notifications FOR ALL
  USING (false)
  WITH CHECK (false);
