export interface OrderablePoint {
  id: string;
  lat?: number | null;
  lng?: number | null;
}

/** Haversine distance in km — mirrors the AI route planner edge function. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function hasCoords(p: OrderablePoint): boolean {
  return typeof p.lat === 'number' && typeof p.lng === 'number' && !!p.lat && !!p.lng;
}

/**
 * Suggest a pickup order: start from the point furthest from the school,
 * then chain nearest-neighbour toward the school.
 * Points without coordinates keep their relative order and go last.
 */
export function suggestPickupOrder<T extends OrderablePoint>(
  points: T[],
  schoolLat?: number | null,
  schoolLng?: number | null
): T[] {
  const withCoords = points.filter(hasCoords);
  const withoutCoords = points.filter((p) => !hasCoords(p));
  if (withCoords.length <= 1) return [...withCoords, ...withoutCoords];

  const remaining = [...withCoords];
  if (schoolLat && schoolLng) {
    remaining.sort(
      (a, b) =>
        haversineKm(schoolLat, schoolLng, b.lat!, b.lng!) -
        haversineKm(schoolLat, schoolLng, a.lat!, a.lng!)
    );
  }

  const ordered: T[] = [remaining.shift()!];
  while (remaining.length > 0) {
    const last = ordered[ordered.length - 1];
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(last.lat!, last.lng!, remaining[i].lat!, remaining[i].lng!);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    ordered.push(remaining.splice(bestIdx, 1)[0]);
  }

  return [...ordered, ...withoutCoords];
}

/** Total travel distance (km) for a sequence, optionally ending at the school. */
export function totalRouteDistanceKm(
  points: OrderablePoint[],
  schoolLat?: number | null,
  schoolLng?: number | null
): number {
  const pts = points.filter(hasCoords);
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += haversineKm(pts[i - 1].lat!, pts[i - 1].lng!, pts[i].lat!, pts[i].lng!);
  }
  if (schoolLat && schoolLng && pts.length > 0) {
    const last = pts[pts.length - 1];
    total += haversineKm(last.lat!, last.lng!, schoolLat, schoolLng);
  }
  return total;
}
