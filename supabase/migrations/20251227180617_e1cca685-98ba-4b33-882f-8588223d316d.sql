-- Create enum for trip status
CREATE TYPE public.trip_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');

-- Create enum for notification type
CREATE TYPE public.trip_notification_type AS ENUM (
  'trip_started',
  'arriving_soon',
  'arrived_at_pickup',
  'picked_up',
  'arrived_at_school',
  'trip_completed'
);

-- Create live_trips table to track active trips
CREATE TABLE public.live_trips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.drivers(id),
  supervisor_id UUID REFERENCES public.supervisors(id),
  started_by UUID REFERENCES auth.users(id),
  status trip_status NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  current_latitude DOUBLE PRECISION,
  current_longitude DOUBLE PRECISION,
  last_location_update TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create trip_student_status to track each student's pickup status
CREATE TABLE public.trip_student_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  live_trip_id UUID NOT NULL REFERENCES public.live_trips(id) ON DELETE CASCADE,
  registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  pickup_order INTEGER,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, arriving, picked_up, dropped_off
  arrived_at TIMESTAMP WITH TIME ZONE,
  picked_up_at TIMESTAMP WITH TIME ZONE,
  dropped_off_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(live_trip_id, registration_id)
);

-- Create trip_notifications table for notification history
CREATE TABLE public.trip_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  live_trip_id UUID NOT NULL REFERENCES public.live_trips(id) ON DELETE CASCADE,
  registration_id UUID REFERENCES public.registrations(id) ON DELETE CASCADE,
  notification_type trip_notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create push_subscriptions table for web push notifications
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- Enable RLS on all tables
ALTER TABLE public.live_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_student_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS policies for live_trips
CREATE POLICY "Operations can manage live trips"
ON public.live_trips FOR ALL
USING (has_department(auth.uid(), 'operations'))
WITH CHECK (has_department(auth.uid(), 'operations'));

CREATE POLICY "Employees can view live trips"
ON public.live_trips FOR SELECT
USING (is_employee(auth.uid()));

CREATE POLICY "Parents can view their route trips"
ON public.live_trips FOR SELECT
USING (route_id IN (
  SELECT ra.route_id FROM route_assignments ra
  JOIN registrations r ON r.id = ra.registration_id
  JOIN parent_accounts pa ON pa.id = r.parent_id
  WHERE pa.user_id = auth.uid()
));

-- RLS policies for trip_student_status
CREATE POLICY "Operations can manage trip student status"
ON public.trip_student_status FOR ALL
USING (has_department(auth.uid(), 'operations'))
WITH CHECK (has_department(auth.uid(), 'operations'));

CREATE POLICY "Employees can view trip student status"
ON public.trip_student_status FOR SELECT
USING (is_employee(auth.uid()));

CREATE POLICY "Parents can view their children status"
ON public.trip_student_status FOR SELECT
USING (registration_id IN (
  SELECT r.id FROM registrations r
  JOIN parent_accounts pa ON pa.id = r.parent_id
  WHERE pa.user_id = auth.uid()
));

-- RLS policies for trip_notifications
CREATE POLICY "Operations can manage notifications"
ON public.trip_notifications FOR ALL
USING (has_department(auth.uid(), 'operations'))
WITH CHECK (has_department(auth.uid(), 'operations'));

CREATE POLICY "Parents can view their notifications"
ON public.trip_notifications FOR SELECT
USING (registration_id IN (
  SELECT r.id FROM registrations r
  JOIN parent_accounts pa ON pa.id = r.parent_id
  WHERE pa.user_id = auth.uid()
));

CREATE POLICY "Parents can update their notification read status"
ON public.trip_notifications FOR UPDATE
USING (registration_id IN (
  SELECT r.id FROM registrations r
  JOIN parent_accounts pa ON pa.id = r.parent_id
  WHERE pa.user_id = auth.uid()
));

-- RLS policies for push_subscriptions
CREATE POLICY "Users can manage own subscriptions"
ON public.push_subscriptions FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Enable realtime for live tracking
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_trips;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_student_status;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_notifications;

-- Create triggers for updated_at
CREATE TRIGGER update_live_trips_updated_at
BEFORE UPDATE ON public.live_trips
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_trip_student_status_updated_at
BEFORE UPDATE ON public.trip_student_status
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_push_subscriptions_updated_at
BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();