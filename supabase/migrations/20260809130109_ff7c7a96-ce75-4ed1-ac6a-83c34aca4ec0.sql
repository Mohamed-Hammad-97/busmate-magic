REVOKE EXECUTE ON FUNCTION public.archive_payments_on_registration_archive() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.daily_line_update_seats() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_new_registration() FROM anon, authenticated, public;