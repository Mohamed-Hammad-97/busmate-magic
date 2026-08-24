import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCity } from '@/contexts/CityContext';

const CITY_NAMES: Record<string, string[]> = {
  cairo: ['cairo', 'القاهرة'],
  giza: ['giza', 'الجيزة'],
  alexandria: ['alexandria', 'الإسكندرية'],
};

/** Names (EN/AR) matching the selected city; empty array = no filtering. */
export const cityNamesFor = (selectedCity: string): string[] =>
  selectedCity === 'all' ? [] : CITY_NAMES[selectedCity] || [];

/** Predicate matching a stored city value against the selected city. */
export const makeCityMatcher = (selectedCity: string) => {
  const names = cityNamesFor(selectedCity);
  return (value?: string | null) => {
    if (names.length === 0) return true;
    if (!value) return false;
    const v = value.toLowerCase();
    return names.some((n) => v.includes(n.toLowerCase()));
  };
};

export interface StaffPerson {
  id: string;
  full_name: string;
  phone?: string | null;
  type: 'driver' | 'supervisor';
}

const isSchoolStaff = (row: any) =>
  (Array.isArray(row.categories) && (row.categories.includes('school') || row.categories.includes('schools'))) ||
  row.belongs_to === 'school' ||
  row.belongs_to === 'both';

export function useSchoolStaff() {
  const { selectedCity } = useCity();
  const matchesCity = makeCityMatcher(selectedCity);
  return useQuery({
    queryKey: ['school-staff-people', selectedCity],
    queryFn: async (): Promise<StaffPerson[]> => {
      const [{ data: drivers, error: dErr }, { data: supervisors, error: sErr }] = await Promise.all([
        supabase.from('drivers').select('id, full_name, phone, city, belongs_to, categories').eq('is_active', true).order('full_name'),
        supabase.from('supervisors').select('id, full_name, phone, city, belongs_to, categories').eq('is_active', true).order('full_name'),
      ]);
      if (dErr) throw dErr;
      if (sErr) throw sErr;
      return [
        ...(drivers || []).filter((d: any) => isSchoolStaff(d) && matchesCity(d.city)).map((d: any) => ({ id: d.id, full_name: d.full_name, phone: d.phone, type: 'driver' as const })),
        ...(supervisors || []).filter((s2: any) => isSchoolStaff(s2) && matchesCity(s2.city)).map((s: any) => ({ id: s.id, full_name: s.full_name, phone: s.phone, type: 'supervisor' as const })),
      ];
    },
  });
}

/** Working days of a month: Sunday (0) to Thursday (4). */
export function workingDaysInMonth(monthStart: Date): string[] {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const days: string[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    const dow = d.getDay();
    if (dow >= 0 && dow <= 4) {
      days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
    d.setDate(d.getDate() + 1);
  }
  return days;
}

export const monthBounds = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  const fmt = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  return { start: fmt(start), end: fmt(end), startDate: start };
};
