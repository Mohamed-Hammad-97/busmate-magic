const CITY_VARIANTS: Record<string, string[]> = {
  cairo: ['cairo', 'القاهرة', 'قاهرة'],
  giza: ['giza', 'الجيزة', 'جيزة'],
  alexandria: ['alexandria', 'الإسكندرية', 'اسكندرية', 'إسكندرية'],
};

/**
 * Case-insensitive match between a stored city value (English or Arabic)
 * and the selected city key from the city picker.
 */
export function matchesCity(
  cityValue: string | null | undefined,
  selected: string,
): boolean {
  if (!selected || selected === 'all') return true;
  const variants = CITY_VARIANTS[selected] || [selected];
  const value = (cityValue || '').toLowerCase();
  if (!value) return false;
  return variants.some((v) => value.includes(v.toLowerCase()));
}
