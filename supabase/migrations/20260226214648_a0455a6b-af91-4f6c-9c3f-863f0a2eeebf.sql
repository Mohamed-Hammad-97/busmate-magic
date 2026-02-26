
ALTER TABLE public.drivers ADD COLUMN belongs_to text NOT NULL DEFAULT 'school' CHECK (belongs_to IN ('school', 'corporate', 'both'));
ALTER TABLE public.supervisors ADD COLUMN belongs_to text NOT NULL DEFAULT 'school' CHECK (belongs_to IN ('school', 'corporate', 'both'));
