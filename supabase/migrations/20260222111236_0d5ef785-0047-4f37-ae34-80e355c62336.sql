
-- Create security definer function to get parent account IDs for a user (breaks recursion)
CREATE OR REPLACE FUNCTION public.get_user_parent_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM parent_accounts WHERE user_id = _user_id
$$;

-- Create security definer function to check if a driver can view a parent account
CREATE OR REPLACE FUNCTION public.is_driver_parent(_user_id uuid, _parent_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM registrations r
    JOIN route_assignments ra ON ra.registration_id = r.id
    JOIN routes rt ON rt.id = ra.route_id
    WHERE r.parent_id = _parent_id
      AND (rt.driver_id = get_user_driver_id(_user_id) OR rt.supervisor_id = get_user_supervisor_id(_user_id))
  )
$$;

-- Fix registrations: "Parents can view own registrations" - use security definer
DROP POLICY IF EXISTS "Parents can view own registrations" ON public.registrations;
CREATE POLICY "Parents can view own registrations"
ON public.registrations FOR SELECT
USING (parent_id IN (SELECT get_user_parent_ids(auth.uid())));

-- Fix parent_accounts: "Parents can view own account" - use security definer
DROP POLICY IF EXISTS "Parents can view own account" ON public.parent_accounts;
CREATE POLICY "Parents can view own account"
ON public.parent_accounts FOR SELECT
USING (id IN (SELECT get_user_parent_ids(auth.uid())));

-- Fix parent_accounts: "Parents can update own account" - use security definer
DROP POLICY IF EXISTS "Parents can update own account" ON public.parent_accounts;
CREATE POLICY "Parents can update own account"
ON public.parent_accounts FOR UPDATE
USING (id IN (SELECT get_user_parent_ids(auth.uid())));

-- Fix parent_accounts: "Drivers can view parent accounts for their routes" - use security definer
DROP POLICY IF EXISTS "Drivers can view parent accounts for their routes" ON public.parent_accounts;
CREATE POLICY "Drivers can view parent accounts for their routes"
ON public.parent_accounts FOR SELECT
USING (is_driver_or_supervisor(auth.uid()) AND is_driver_parent(auth.uid(), id));

-- Fix chat_conversations policies that reference parent_accounts
DROP POLICY IF EXISTS "Parents can view own conversations" ON public.chat_conversations;
CREATE POLICY "Parents can view own conversations"
ON public.chat_conversations FOR SELECT
USING (parent_id IN (SELECT get_user_parent_ids(auth.uid())));

DROP POLICY IF EXISTS "Parents can create conversations" ON public.chat_conversations;
CREATE POLICY "Parents can create conversations"
ON public.chat_conversations FOR INSERT
WITH CHECK (parent_id IN (SELECT get_user_parent_ids(auth.uid())));

-- Fix chat_messages policies that reference parent_accounts via conversations
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.chat_messages;
CREATE POLICY "Users can view messages in their conversations"
ON public.chat_messages FOR SELECT
USING (
  (conversation_id IN (
    SELECT id FROM chat_conversations WHERE parent_id IN (SELECT get_user_parent_ids(auth.uid()))
  ))
  OR has_department(auth.uid(), 'customer_support'::department)
);

DROP POLICY IF EXISTS "Users can mark messages as read" ON public.chat_messages;
CREATE POLICY "Users can mark messages as read"
ON public.chat_messages FOR UPDATE
USING (
  (conversation_id IN (
    SELECT id FROM chat_conversations WHERE parent_id IN (SELECT get_user_parent_ids(auth.uid()))
  ))
  OR has_department(auth.uid(), 'customer_support'::department)
);

DROP POLICY IF EXISTS "Parents can send messages in their conversations" ON public.chat_messages;
CREATE POLICY "Parents can send messages in their conversations"
ON public.chat_messages FOR INSERT
WITH CHECK (
  (conversation_id IN (
    SELECT id FROM chat_conversations WHERE parent_id IN (SELECT get_user_parent_ids(auth.uid()))
  ))
  AND sender_type = 'parent'
);

-- Fix customer_feedback policies
DROP POLICY IF EXISTS "Parents can add and view own feedback" ON public.customer_feedback;
CREATE POLICY "Parents can add and view own feedback"
ON public.customer_feedback FOR SELECT
USING (registration_id IN (
  SELECT r.id FROM registrations r WHERE r.parent_id IN (SELECT get_user_parent_ids(auth.uid()))
));

DROP POLICY IF EXISTS "Parents can insert feedback" ON public.customer_feedback;
CREATE POLICY "Parents can insert feedback"
ON public.customer_feedback FOR INSERT
WITH CHECK (
  registration_id IN (
    SELECT r.id FROM registrations r WHERE r.parent_id IN (SELECT get_user_parent_ids(auth.uid()))
  )
  AND is_from_parent = true
);

-- Fix payments policy
DROP POLICY IF EXISTS "Parents can view own payments" ON public.payments;
CREATE POLICY "Parents can view own payments"
ON public.payments FOR SELECT
USING (subscription_id IN (
  SELECT s.id FROM subscriptions s
  JOIN registrations r ON r.id = s.registration_id
  WHERE r.parent_id IN (SELECT get_user_parent_ids(auth.uid()))
));

-- Fix trip_notifications policies
DROP POLICY IF EXISTS "Parents can view their notifications" ON public.trip_notifications;
CREATE POLICY "Parents can view their notifications"
ON public.trip_notifications FOR SELECT
USING (registration_id IN (
  SELECT r.id FROM registrations r WHERE r.parent_id IN (SELECT get_user_parent_ids(auth.uid()))
));

DROP POLICY IF EXISTS "Parents can update their notification read status" ON public.trip_notifications;
CREATE POLICY "Parents can update their notification read status"
ON public.trip_notifications FOR UPDATE
USING (registration_id IN (
  SELECT r.id FROM registrations r WHERE r.parent_id IN (SELECT get_user_parent_ids(auth.uid()))
));

-- Fix trip_student_status policy
DROP POLICY IF EXISTS "Parents can view their children status" ON public.trip_student_status;
CREATE POLICY "Parents can view their children status"
ON public.trip_student_status FOR SELECT
USING (registration_id IN (
  SELECT r.id FROM registrations r WHERE r.parent_id IN (SELECT get_user_parent_ids(auth.uid()))
));

-- Fix live_trips parent policy
DROP POLICY IF EXISTS "Parents can view their route trips" ON public.live_trips;
CREATE POLICY "Parents can view their route trips"
ON public.live_trips FOR SELECT
USING (route_id IN (
  SELECT ra.route_id FROM route_assignments ra
  JOIN registrations r ON r.id = ra.registration_id
  WHERE r.parent_id IN (SELECT get_user_parent_ids(auth.uid()))
));
