/** Add `minutes` to a "HH:mm[:ss]" departure time; returns "HH:mm" or null. */
export function etaFor(departure: string | null | undefined, minutes: number | null | undefined): string | null {
  if (!departure || minutes == null) return null;
  const [h, m] = departure.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const total = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
