-- Create cities table for dropdown selection
CREATE TABLE public.cities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view active cities
CREATE POLICY "All authenticated can view active cities" 
ON public.cities 
FOR SELECT 
USING (is_active = true);

-- Operations can manage cities
CREATE POLICY "Operations can manage cities" 
ON public.cities 
FOR ALL 
USING (has_department(auth.uid(), 'operations'::department))
WITH CHECK (has_department(auth.uid(), 'operations'::department));

-- Create trigger for updated_at
CREATE TRIGGER update_cities_updated_at
BEFORE UPDATE ON public.cities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();