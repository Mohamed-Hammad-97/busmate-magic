CREATE INDEX IF NOT EXISTS idx_payments_subscription_id ON public.payments (subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_due_date ON public.payments (due_date);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments (status);
CREATE INDEX IF NOT EXISTS idx_payment_extra_fees_payment_id ON public.payment_extra_fees (payment_id);
CREATE INDEX IF NOT EXISTS idx_registrations_parent_id ON public.registrations (parent_id);
CREATE INDEX IF NOT EXISTS idx_registrations_school_id ON public.registrations (school_id);
CREATE INDEX IF NOT EXISTS idx_route_assignments_registration_id ON public.route_assignments (registration_id);