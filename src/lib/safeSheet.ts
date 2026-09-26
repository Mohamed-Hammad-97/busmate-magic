// Neutralize spreadsheet formula injection (CSV/XLSX injection).
// Any string cell starting with = + - @ tab or CR is prefixed with a quote.
const FORMULA_START = /^[=+\-@\t\r]/;

export function safeCell<T>(v: T): T | string {
  if (typeof v === "string" && FORMULA_START.test(v)) return `'${v}`;
  return v;
}

export function safeRows<T extends unknown[][]>(rows: T): unknown[][] {
  return rows.map((r) => (Array.isArray(r) ? r.map(safeCell) : r));
}
