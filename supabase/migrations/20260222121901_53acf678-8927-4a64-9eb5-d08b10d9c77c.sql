
-- Create student absences table for parents to register absence dates
CREATE TABLE public.student_absences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES public.parent_accounts(id) ON DELETE CASCADE,
  absence_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(registration_id, absence_date)
);

-- Enable RLS
ALTER TABLE public.student_absences ENABLE ROW LEVEL SECURITY;

-- Parents can view their own absences
CREATE POLICY "Parents can view own absences"
ON public.student_absences
FOR SELECT
USING (parent_id IN (SELECT get_user_parent_ids(auth.uid())));

-- Parents can insert absences for their children
CREATE POLICY "Parents can insert own absences"
ON public.student_absences
FOR INSERT
WITH CHECK (parent_id IN (SELECT get_user_parent_ids(auth.uid())));

-- Parents can delete their own absences
CREATE POLICY "Parents can delete own absences"
ON public.student_absences
FOR DELETE
USING (parent_id IN (SELECT get_user_parent_ids(auth.uid())));

-- Employees can view all absences
CREATE POLICY "Employees can view absences"
ON public.student_absences
FOR SELECT
USING (is_employee(auth.uid()));

-- Operations can manage absences
CREATE POLICY "Operations can manage absences"
ON public.student_absences
FOR ALL
USING (has_department(auth.uid(), 'operations'::department))
WITH CHECK (has_department(auth.uid(), 'operations'::department));
