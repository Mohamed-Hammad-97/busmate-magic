-- Driver/Supervisor accounts table (linked to existing drivers/supervisors tables)
CREATE TABLE public.driver_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE CASCADE,
  supervisor_id uuid REFERENCES public.supervisors(id) ON DELETE CASCADE,
  phone text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT driver_or_supervisor CHECK (
    (driver_id IS NOT NULL AND supervisor_id IS NULL) OR 
    (driver_id IS NULL AND supervisor_id IS NOT NULL)
  )
);

-- Add password_hash field to parent_accounts for password login after verification
ALTER TABLE public.parent_accounts 
ADD COLUMN IF NOT EXISTS has_password boolean NOT NULL DEFAULT false;

-- Chat conversations table
CREATE TABLE public.chat_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id uuid NOT NULL REFERENCES public.parent_accounts(id) ON DELETE CASCADE,
  subject text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'pending')),
  assigned_to uuid REFERENCES public.employees(id),
  last_message_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Chat messages table
CREATE TABLE public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('parent', 'employee', 'supervisor', 'system')),
  sender_id uuid NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable realtime for chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;

-- Enable RLS
ALTER TABLE public.driver_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Driver accounts policies
CREATE POLICY "Driver accounts can view own account"
ON public.driver_accounts FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Operations can manage driver accounts"
ON public.driver_accounts FOR ALL
USING (has_department(auth.uid(), 'operations'))
WITH CHECK (has_department(auth.uid(), 'operations'));

-- Chat conversations policies
CREATE POLICY "Parents can view own conversations"
ON public.chat_conversations FOR SELECT
USING (parent_id IN (
  SELECT id FROM parent_accounts WHERE user_id = auth.uid()
));

CREATE POLICY "Parents can create conversations"
ON public.chat_conversations FOR INSERT
WITH CHECK (parent_id IN (
  SELECT id FROM parent_accounts WHERE user_id = auth.uid()
));

CREATE POLICY "Customer support can manage all conversations"
ON public.chat_conversations FOR ALL
USING (has_department(auth.uid(), 'customer_support'))
WITH CHECK (has_department(auth.uid(), 'customer_support'));

-- Chat messages policies
CREATE POLICY "Users can view messages in their conversations"
ON public.chat_messages FOR SELECT
USING (
  conversation_id IN (
    SELECT id FROM chat_conversations WHERE parent_id IN (
      SELECT id FROM parent_accounts WHERE user_id = auth.uid()
    )
  ) OR
  has_department(auth.uid(), 'customer_support')
);

CREATE POLICY "Parents can send messages in their conversations"
ON public.chat_messages FOR INSERT
WITH CHECK (
  conversation_id IN (
    SELECT id FROM chat_conversations WHERE parent_id IN (
      SELECT id FROM parent_accounts WHERE user_id = auth.uid()
    )
  ) AND sender_type = 'parent'
);

CREATE POLICY "Customer support can send messages"
ON public.chat_messages FOR INSERT
WITH CHECK (
  has_department(auth.uid(), 'customer_support') AND sender_type = 'employee'
);

CREATE POLICY "Users can mark messages as read"
ON public.chat_messages FOR UPDATE
USING (
  conversation_id IN (
    SELECT id FROM chat_conversations WHERE parent_id IN (
      SELECT id FROM parent_accounts WHERE user_id = auth.uid()
    )
  ) OR has_department(auth.uid(), 'customer_support')
);

-- Triggers for updated_at
CREATE TRIGGER update_driver_accounts_updated_at
BEFORE UPDATE ON public.driver_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chat_conversations_updated_at
BEFORE UPDATE ON public.chat_conversations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to check if user is a driver/supervisor
CREATE OR REPLACE FUNCTION public.is_driver_or_supervisor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.driver_accounts
    WHERE user_id = _user_id
      AND is_active = true
  )
$$;