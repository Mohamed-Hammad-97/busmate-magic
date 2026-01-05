-- Create audit log table for tracking sensitive data access
CREATE TABLE public.sensitive_data_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action TEXT NOT NULL DEFAULT 'view',
    accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    ip_address TEXT,
    user_agent TEXT
);

-- Enable RLS on the audit log table (only admins can view logs)
ALTER TABLE public.sensitive_data_access_log ENABLE ROW LEVEL SECURITY;

-- Only super admins can view audit logs
CREATE POLICY "Super admins can view audit logs" 
ON public.sensitive_data_access_log 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'super_admin'));

-- Any authenticated user can insert audit logs (for tracking their own access)
CREATE POLICY "Authenticated users can insert audit logs" 
ON public.sensitive_data_access_log 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Create function to log sensitive data access
CREATE OR REPLACE FUNCTION public.log_sensitive_data_access(
    p_table_name TEXT,
    p_record_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.sensitive_data_access_log (user_id, table_name, record_id, action)
    VALUES (auth.uid(), p_table_name, p_record_id, 'view');
END;
$$;

-- Create index for efficient querying of audit logs
CREATE INDEX idx_sensitive_data_access_log_user_id ON public.sensitive_data_access_log(user_id);
CREATE INDEX idx_sensitive_data_access_log_table_record ON public.sensitive_data_access_log(table_name, record_id);
CREATE INDEX idx_sensitive_data_access_log_accessed_at ON public.sensitive_data_access_log(accessed_at DESC);