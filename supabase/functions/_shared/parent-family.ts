// Resolves the *family* of parent_accounts rows that share a phone number
// (father's or mother's, in any stored format) so that every number of a
// family signs into one and the same login.

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export interface FamilyParentRow {
  id: string;
  user_id: string | null;
  parent_name: string | null;
  is_active: boolean | null;
  has_password: boolean | null;
  family_id: string | null;
  created_at: string;
  father_phone: string | null;
  mother_phone: string | null;
  registrations?: { status: string }[] | null;
}

export interface ResolvedFamily {
  rows: FamilyParentRow[];
  /** Row that owns (or should own) the auth user for the whole family. */
  primary: FamilyParentRow | null;
}

export const normalizePhone = (phone: string): string =>
  String(phone ?? "").replace(/\D/g, "").replace(/^20/, "").replace(/^0/, "");

export const phoneVariants = (clean: string): string[] => [
  clean,
  `0${clean}`,
  `20${clean}`,
  `+20${clean}`,
];

const SELECT_COLS =
  "id, user_id, parent_name, is_active, family_id, created_at, father_phone, mother_phone, registrations(status)";

const byOldest = (a: FamilyParentRow, b: FamilyParentRow) =>
  new Date(a.created_at).getTime() - new Date(b.created_at).getTime();

export const hasCurrentRegistration = (row: FamilyParentRow): boolean =>
  row.registrations?.some(
    (r) => r.status === "pending_fees" || r.status === "complete",
  ) ?? false;

/**
 * Finds every parent_accounts row belonging to the family of `phone`.
 * Matching is done on the normalized father/mother phone, then widened to the
 * whole family through `family_id`.
 */
export async function resolveParentFamily(
  supabase: SupabaseClient,
  phone: string,
): Promise<ResolvedFamily> {
  const clean = normalizePhone(phone);
  if (!clean) return { rows: [], primary: null };

  const variants = phoneVariants(clean);
  const orFilter = [
    ...variants.map((p) => `father_phone.eq.${p}`),
    ...variants.map((p) => `mother_phone.eq.${p}`),
  ].join(",");

  const { data: matches } = await supabase
    .from("parent_accounts")
    .select(SELECT_COLS)
    .or(orFilter);

  const matched: FamilyParentRow[] = matches ?? [];
  if (matched.length === 0) return { rows: [], primary: null };

  const familyIds = [
    ...new Set(matched.map((r) => r.family_id).filter(Boolean)),
  ] as string[];

  let rows = matched;
  if (familyIds.length > 0) {
    const { data: familyRows } = await supabase
      .from("parent_accounts")
      .select(SELECT_COLS)
      .in("family_id", familyIds);

    const merged = new Map<string, FamilyParentRow>();
    for (const row of [...matched, ...(familyRows ?? [])]) merged.set(row.id, row);
    rows = [...merged.values()];
  }

  rows.sort(byOldest);

  // Prefer an existing login; among those prefer an active / currently
  // registered one, falling back to the oldest row overall.
  const withUser = rows.filter((r) => r.user_id);
  const primary =
    withUser.find((r) => r.is_active !== false) ??
    withUser.find(hasCurrentRegistration) ??
    withUser[0] ??
    rows.find((r) => r.is_active !== false) ??
    rows[0] ??
    null;

  return { rows, primary };
}

/** Makes sure every row of the family shares one family_id. */
export async function unifyFamilyId(
  supabase: SupabaseClient,
  family: ResolvedFamily,
): Promise<void> {
  const target =
    family.primary?.family_id ??
    family.rows.find((r) => r.family_id)?.family_id ??
    null;
  if (!target) return;

  const stale = family.rows.filter((r) => r.family_id !== target).map((r) => r.id);
  if (stale.length === 0) return;

  await supabase
    .from("parent_accounts")
    .update({ family_id: target })
    .in("id", stale);
}
