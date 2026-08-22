CREATE TABLE public.contract_acceptances (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  registration_id uuid NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  parent_id uuid NOT NULL REFERENCES public.parent_accounts(id) ON DELETE CASCADE,
  contract_version text NOT NULL DEFAULT 'cairo-25-26',
  signature_name text NOT NULL,
  accepted_at timestamp with time zone NOT NULL DEFAULT now(),
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (registration_id, contract_version)
);

GRANT SELECT, INSERT ON public.contract_acceptances TO authenticated;
GRANT ALL ON public.contract_acceptances TO service_role;

ALTER TABLE public.contract_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can view their own contracts"
ON public.contract_acceptances FOR SELECT TO authenticated
USING (parent_id IN (SELECT public.get_user_parent_ids(auth.uid())));

CREATE POLICY "Parents can sign their own contracts"
ON public.contract_acceptances FOR INSERT TO authenticated
WITH CHECK (
  parent_id IN (SELECT public.get_user_parent_ids(auth.uid()))
  AND EXISTS (
    SELECT 1 FROM public.registrations r
    WHERE r.id = registration_id AND r.parent_id = contract_acceptances.parent_id
  )
);

CREATE POLICY "Employees can view all contracts"
ON public.contract_acceptances FOR SELECT TO authenticated
USING (public.is_employee(auth.uid()));

CREATE TRIGGER update_contract_acceptances_updated_at
BEFORE UPDATE ON public.contract_acceptances
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();