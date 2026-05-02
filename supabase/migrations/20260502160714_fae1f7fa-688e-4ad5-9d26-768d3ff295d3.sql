-- Add categories array to drivers and supervisors to support multi-select
-- across School, Corporate, and Daily Lines.
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS categories text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.supervisors
  ADD COLUMN IF NOT EXISTS categories text[] NOT NULL DEFAULT '{}';

-- Backfill from legacy belongs_to column
UPDATE public.drivers
SET categories = CASE
  WHEN belongs_to = 'both' THEN ARRAY['school','corporate']::text[]
  WHEN belongs_to IN ('school','corporate','daily_lines') THEN ARRAY[belongs_to]::text[]
  ELSE ARRAY['school']::text[]
END
WHERE coalesce(array_length(categories, 1), 0) = 0;

UPDATE public.supervisors
SET categories = CASE
  WHEN belongs_to = 'both' THEN ARRAY['school','corporate']::text[]
  WHEN belongs_to IN ('school','corporate','daily_lines') THEN ARRAY[belongs_to]::text[]
  ELSE ARRAY['school']::text[]
END
WHERE coalesce(array_length(categories, 1), 0) = 0;

CREATE INDEX IF NOT EXISTS idx_drivers_categories ON public.drivers USING GIN(categories);
CREATE INDEX IF NOT EXISTS idx_supervisors_categories ON public.supervisors USING GIN(categories);