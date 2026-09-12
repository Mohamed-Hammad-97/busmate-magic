CREATE TABLE public.parent_phone_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_normalized text NOT NULL UNIQUE,
  family_id uuid,
  parent_account_id uuid REFERENCES public.parent_accounts(id) ON DELETE SET NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.parent_phone_credentials TO service_role;

ALTER TABLE public.parent_phone_credentials ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_parent_phone_credentials_family ON public.parent_phone_credentials (family_id);

CREATE TRIGGER update_parent_phone_credentials_updated_at
BEFORE UPDATE ON public.parent_phone_credentials
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();