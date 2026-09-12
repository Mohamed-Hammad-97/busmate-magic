
-- Normalised Egyptian mobile helper
CREATE OR REPLACE FUNCTION public.normalize_eg_phone(_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(
    regexp_replace(
      regexp_replace(
        regexp_replace(COALESCE(_phone, ''), '\D', '', 'g'),
      '^20', ''),
    '^0', ''),
  '')
$$;

-- Family grouping: parent_accounts sharing any phone belong to one family
ALTER TABLE public.parent_accounts
  ADD COLUMN IF NOT EXISTS family_id uuid DEFAULT gen_random_uuid();

-- Backfill families from connected components over shared phone numbers
WITH RECURSIVE norm AS (
  SELECT id,
         public.normalize_eg_phone(father_phone) AS f,
         public.normalize_eg_phone(mother_phone) AS m
  FROM public.parent_accounts
), phones AS (
  SELECT id, f AS p FROM norm WHERE f IS NOT NULL
  UNION
  SELECT id, m FROM norm WHERE m IS NOT NULL
), e AS (
  SELECT DISTINCT a.id AS x, b.id AS y
  FROM phones a JOIN phones b ON a.p = b.p AND a.id <> b.id
), cc AS (
  SELECT id AS node, id AS root FROM norm
  UNION
  SELECT e.y, cc.root FROM cc JOIN e ON e.x = cc.node
), comp AS (
  SELECT node, MIN(root::text)::uuid AS root FROM cc GROUP BY node
)
UPDATE public.parent_accounts pa
SET family_id = comp.root
FROM comp
WHERE pa.id = comp.node;

UPDATE public.parent_accounts SET family_id = id WHERE family_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_parent_accounts_family_id ON public.parent_accounts (family_id);
CREATE INDEX IF NOT EXISTS idx_parent_accounts_father_phone_norm ON public.parent_accounts (public.normalize_eg_phone(father_phone));
CREATE INDEX IF NOT EXISTS idx_parent_accounts_mother_phone_norm ON public.parent_accounts (public.normalize_eg_phone(mother_phone));

-- New rows join an existing family when a phone matches
CREATE OR REPLACE FUNCTION public.parent_account_assign_family()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing uuid;
BEGIN
  IF NEW.family_id IS NOT NULL AND TG_OP = 'UPDATE' THEN
    RETURN NEW;
  END IF;

  SELECT pa.family_id INTO existing
  FROM public.parent_accounts pa
  WHERE pa.id <> NEW.id
    AND pa.family_id IS NOT NULL
    AND (
      public.normalize_eg_phone(pa.father_phone) IN (
        public.normalize_eg_phone(NEW.father_phone), public.normalize_eg_phone(NEW.mother_phone))
      OR public.normalize_eg_phone(pa.mother_phone) IN (
        public.normalize_eg_phone(NEW.father_phone), public.normalize_eg_phone(NEW.mother_phone))
    )
  ORDER BY pa.created_at ASC
  LIMIT 1;

  NEW.family_id := COALESCE(existing, NEW.family_id, gen_random_uuid());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_parent_account_assign_family ON public.parent_accounts;
CREATE TRIGGER trg_parent_account_assign_family
BEFORE INSERT ON public.parent_accounts
FOR EACH ROW EXECUTE FUNCTION public.parent_account_assign_family();

-- A signed-in parent now owns every account row in their family
CREATE OR REPLACE FUNCTION public.get_user_parent_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pa.id
  FROM public.parent_accounts pa
  WHERE pa.family_id IS NOT NULL
    AND pa.family_id IN (
      SELECT p2.family_id FROM public.parent_accounts p2 WHERE p2.user_id = _user_id
    )
  UNION
  SELECT pa.id FROM public.parent_accounts pa WHERE pa.user_id = _user_id
$$;
