
-- Add unique constraint on user_roles.user_id (should already exist, but let's ensure)
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);

-- Add unique constraint on employees.user_id
ALTER TABLE public.employees ADD CONSTRAINT employees_user_id_unique UNIQUE (user_id);
