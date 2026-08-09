ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS route_number integer;

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM public.routes
)
UPDATE public.routes r
SET route_number = n.rn
FROM numbered n
WHERE r.id = n.id AND r.route_number IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS routes_route_number_key ON public.routes (route_number);