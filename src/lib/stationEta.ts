/** Add `minutes` to a "HH:mm[:ss]" departure time; returns "HH:mm" or null. */
export function etaFor(departure: string | null | undefined, minutes: number | null | undefined): string | null {
  if (!departure || minutes == null) return null;
  const [h, m] = departure.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const total = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

type EtaStation = { id: string; station_order: number; latitude: number | null; longitude: number | null; minutes_from_start?: number | null };

/** Minutes from start per station id; uses stored values, else estimates from distance (~25 km/h, 1.3 road factor). */
export function stationMinutesMap(stations: EtaStation[]): Record<string, number> {
  const ordered = [...stations].sort((a, b) => a.station_order - b.station_order);
  const out: Record<string, number> = {};
  if (ordered.length && ordered.every((s) => s.minutes_from_start != null)) {
    ordered.forEach((s) => (out[s.id] = s.minutes_from_start!));
    return out;
  }
  const toR = (d: number) => (d * Math.PI) / 180;
  let acc = 0;
  let prev: EtaStation | null = null;
  for (const s of ordered) {
    if (s.latitude == null || s.longitude == null) continue;
    if (prev) {
      const dLat = toR(s.latitude - prev.latitude!), dLng = toR(s.longitude - prev.longitude!);
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(prev.latitude!)) * Math.cos(toR(s.latitude)) * Math.sin(dLng / 2) ** 2;
      acc += ((2 * 6371 * Math.asin(Math.sqrt(h)) * 1.3) / 25) * 60;
    }
    out[s.id] = Math.round(acc);
    prev = s;
  }
  return out;
}
