UPDATE public.payments p
SET status = 'pending'
FROM public.subscriptions s
JOIN public.registrations r ON r.id = s.registration_id
WHERE p.subscription_id = s.id
  AND p.status = 'archived'
  AND r.status <> 'archived';