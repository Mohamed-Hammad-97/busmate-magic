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

/** Current Cairo date "YYYY-MM-DD" and minutes since midnight. */
export function cairoNow(now: Date = new Date()): { date: string; minutes: number } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(now).map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

/** True when the bus has not yet reached a station (Cairo time); unknown ETA counts as departure time. */
export function isStationUpcoming(tripDate: string, departure: string, minutesFromStart: number | null | undefined, now: Date = new Date()): boolean {
  const [h, m] = departure.split(":").map(Number);
  const c = cairoNow(now);
  const dayDiff = Math.round((Date.parse(tripDate) - Date.parse(c.date)) / 86400000);
  return dayDiff * 1440 + h * 60 + m + (minutesFromStart ?? 0) > c.minutes;
}
