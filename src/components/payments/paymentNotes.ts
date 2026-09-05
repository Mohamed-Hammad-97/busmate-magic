import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type PaymentNoteField = 'payment_note' | 'fawry_note';

export async function savePaymentNote(params: {
  paymentId: string;
  field: PaymentNoteField;
  note: string | null;
  resolved?: boolean | null;
}) {
  const { error } = await supabase.rpc('set_payment_note' as any, {
    _payment_id: params.paymentId,
    _field: params.field,
    _note: params.note,
    _resolved: params.resolved ?? null,
  } as any);
  if (error) throw error;
}

export function useCanEditPaymentNotes() {
  const { isSuperAdmin, hasDepartment } = useAuth();
  return isSuperAdmin || hasDepartment('finance') || hasDepartment('customer_support');
}

/** Map of auth user id -> employee full name, for showing who wrote/resolved a note. */
export function useNoteAuthors() {
  const { data } = useQuery({
    queryKey: ['note-authors'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('employees').select('user_id, full_name');
      if (error) return [] as any[];
      return data || [];
    },
  });
  const map = new Map<string, string>();
  (data || []).forEach((e: any) => {
    if (e.user_id) map.set(e.user_id, e.full_name);
  });
  return map;
}
