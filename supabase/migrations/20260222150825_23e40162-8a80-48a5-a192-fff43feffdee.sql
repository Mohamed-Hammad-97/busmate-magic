
-- Create conversation type enum
CREATE TYPE public.conversation_type AS ENUM (
  'staff_dm',
  'customer_dm',
  'route_group',
  'customer_supervisor'
);

-- Unified conversations table
CREATE TABLE public.unified_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.conversation_type NOT NULL,
  route_id uuid REFERENCES public.routes(id) ON DELETE SET NULL,
  subject text,
  allow_customer_messages boolean DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz DEFAULT now()
);

-- Conversation participants
CREATE TABLE public.conversation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.unified_conversations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid,
  participant_type text NOT NULL CHECK (participant_type IN ('employee', 'driver', 'supervisor', 'parent')),
  participant_ref_id uuid,
  can_send boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- Unified messages
CREATE TABLE public.unified_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.unified_conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid NOT NULL,
  sender_type text NOT NULL CHECK (sender_type IN ('employee', 'driver', 'supervisor', 'parent')),
  sender_name text,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.unified_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unified_messages ENABLE ROW LEVEL SECURITY;

-- Security definer: check if user is participant
CREATE OR REPLACE FUNCTION public.is_conversation_participant(_user_id uuid, _conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = _conversation_id AND user_id = _user_id
  )
$$;

-- Security definer: check if user can send in conversation
CREATE OR REPLACE FUNCTION public.can_send_in_conversation(_user_id uuid, _conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = _conversation_id AND user_id = _user_id AND can_send = true
  )
$$;

-- RLS: unified_conversations
CREATE POLICY "Participants can view their conversations"
ON public.unified_conversations FOR SELECT
USING (is_conversation_participant(auth.uid(), id));

CREATE POLICY "CS and Ops employees can view all conversations"
ON public.unified_conversations FOR SELECT
USING (has_department(auth.uid(), 'customer_support'::department) OR has_department(auth.uid(), 'operations'::department));

CREATE POLICY "Employees can create conversations"
ON public.unified_conversations FOR INSERT
WITH CHECK (is_employee(auth.uid()));

CREATE POLICY "Employees can update conversations"
ON public.unified_conversations FOR UPDATE
USING (is_employee(auth.uid()));

CREATE POLICY "Parents can create customer_supervisor conversations"
ON public.unified_conversations FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND type = 'customer_supervisor'::conversation_type
);

-- RLS: conversation_participants
CREATE POLICY "Participants can view members of their conversations"
ON public.conversation_participants FOR SELECT
USING (is_conversation_participant(auth.uid(), conversation_id));

CREATE POLICY "CS and Ops can view all participants"
ON public.conversation_participants FOR SELECT
USING (has_department(auth.uid(), 'customer_support'::department) OR has_department(auth.uid(), 'operations'::department));

CREATE POLICY "Employees can manage participants"
ON public.conversation_participants FOR ALL
USING (is_employee(auth.uid()))
WITH CHECK (is_employee(auth.uid()));

CREATE POLICY "System can add parent participants"
ON public.conversation_participants FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND participant_type = 'parent');

-- RLS: unified_messages
CREATE POLICY "Participants can view messages in their conversations"
ON public.unified_messages FOR SELECT
USING (is_conversation_participant(auth.uid(), conversation_id));

CREATE POLICY "CS and Ops can view all messages"
ON public.unified_messages FOR SELECT
USING (has_department(auth.uid(), 'customer_support'::department) OR has_department(auth.uid(), 'operations'::department));

CREATE POLICY "Users who can send can insert messages"
ON public.unified_messages FOR INSERT
WITH CHECK (can_send_in_conversation(auth.uid(), conversation_id) AND sender_id = auth.uid());

CREATE POLICY "Participants can mark messages read"
ON public.unified_messages FOR UPDATE
USING (is_conversation_participant(auth.uid(), conversation_id));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.unified_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.unified_conversations;

-- Indexes
CREATE INDEX idx_unified_messages_conversation ON public.unified_messages(conversation_id, created_at);
CREATE INDEX idx_conversation_participants_user ON public.conversation_participants(user_id);
CREATE INDEX idx_conversation_participants_conv ON public.conversation_participants(conversation_id);
CREATE INDEX idx_unified_conversations_type ON public.unified_conversations(type);
CREATE INDEX idx_unified_conversations_route ON public.unified_conversations(route_id);
