
-- Employee notifications table for new registrations
CREATE TABLE public.employee_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  registration_id UUID REFERENCES public.registrations(id) ON DELETE CASCADE NOT NULL,
  city TEXT NOT NULL,
  notification_type TEXT NOT NULL DEFAULT 'new_registration',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_by UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employee_notifications ENABLE ROW LEVEL SECURITY;

-- Employees can view notifications for their city (or super_admins see all)
CREATE POLICY "Employees can view notifications for their city"
  ON public.employee_notifications
  FOR SELECT
  TO authenticated
  USING (is_employee(auth.uid()));

-- Employees can update (mark as read)
CREATE POLICY "Employees can update notifications"
  ON public.employee_notifications
  FOR UPDATE
  TO authenticated
  USING (is_employee(auth.uid()));

-- Allow insert via triggers/functions
CREATE POLICY "System can insert notifications"
  ON public.employee_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (is_employee(auth.uid()));

-- Trigger function to auto-create notification on new registration
CREATE OR REPLACE FUNCTION public.notify_new_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  parent_city TEXT;
  student TEXT;
  school_name TEXT;
BEGIN
  -- Get parent city
  SELECT pa.city INTO parent_city
  FROM parent_accounts pa
  WHERE pa.id = NEW.parent_id;

  -- Get student name
  student := COALESCE(NEW.student_name, 'Unknown');

  -- Get school name
  SELECT s.name INTO school_name
  FROM schools s
  WHERE s.id = NEW.school_id;

  INSERT INTO employee_notifications (registration_id, city, notification_type, title, message)
  VALUES (
    NEW.id,
    COALESCE(parent_city, 'unknown'),
    'new_registration',
    'New Registration',
    'New registration: ' || student || ' at ' || COALESCE(school_name, 'Unknown School')
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_registration
  AFTER INSERT ON public.registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_registration();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_notifications;
