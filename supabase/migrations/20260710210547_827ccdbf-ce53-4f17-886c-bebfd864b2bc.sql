
-- Backfill: archive unpaid payments whose registration is archived
UPDATE public.payments p
SET status = 'archived'
FROM public.subscriptions s
JOIN public.registrations r ON r.id = s.registration_id
WHERE p.subscription_id = s.id
  AND r.status = 'archived'
  AND p.status IN ('pending', 'overdue');

-- Trigger function: when a registration becomes archived, archive its unpaid payments
CREATE OR REPLACE FUNCTION public.archive_payments_on_registration_archive()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'archived' AND (OLD.status IS DISTINCT FROM 'archived') THEN
    UPDATE public.payments p
    SET status = 'archived'
    FROM public.subscriptions s
    WHERE p.subscription_id = s.id
      AND s.registration_id = NEW.id
      AND p.status IN ('pending', 'overdue');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_archive_payments_on_registration_archive ON public.registrations;
CREATE TRIGGER trg_archive_payments_on_registration_archive
AFTER UPDATE OF status ON public.registrations
FOR EACH ROW
EXECUTE FUNCTION public.archive_payments_on_registration_archive();
