// Compute a driving route between an ordered list of stations using
// Google's Routes API v2 (computeRoutes). Falls back to the legacy
// DirectionsService if the new API is not enabled, and finally falls
// back to straight lines connecting the stations.
//
// Returns the decoded polyline points (lat/lng) ready for a <Polyline>.

import { supabase } from "@/integrations/supabase/client";

export type LatLng = { lat: number; lng: number };

export type RouteResult = {
  path: LatLng[];
  source: "routes_api" | "directions_legacy" | "straight_fallback";
  error?: string;
};

let cachedKey: string | null = null;

async function getApiKey(): Promise<string | null> {
  if (cachedKey) return cachedKey;
  const envKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY;
  if (envKey) {
    cachedKey = envKey;
    return envKey;
  }
  try {
    const { data } = await supabase.functions.invoke("get-google-maps-key");
    if (data?.apiKey) {
      cachedKey = data.apiKey;
      return data.apiKey;
    }
  } catch {
    /* ignore */
  }
  return null;
}

// Google encoded polyline algorithm decoder
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;
  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

async function tryRoutesApi(stops: LatLng[], apiKey: string): Promise<RouteResult | null> {
  if (stops.length < 2) return null;
  const origin = stops[0];
  const destination = stops[stops.length - 1];
  const intermediates = stops.slice(1, -1);

  const body = {
    origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
    destination: {
      location: { latLng: { latitude: destination.lat, longitude: destination.lng } },
    },
    intermediates: intermediates.map((p) => ({
      location: { latLng: { latitude: p.lat, longitude: p.lng } },
    })),
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_UNAWARE",
    polylineEncoding: "ENCODED_POLYLINE",
  };

  const res = await fetch(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.polyline.encodedPolyline",
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Routes API ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  const encoded = json?.routes?.[0]?.polyline?.encodedPolyline;
  if (!encoded) throw new Error("Routes API returned no polyline");
  return { path: decodePolyline(encoded), source: "routes_api" };
}

function tryLegacyDirections(stops: LatLng[]): Promise<RouteResult | null> {
  return new Promise((resolve) => {
    if (typeof google === "undefined" || !google.maps?.DirectionsService) {
      resolve(null);
      return;
    }
    const svc = new google.maps.DirectionsService();
    svc.route(
      {
        origin: stops[0],
        destination: stops[stops.length - 1],
        waypoints: stops.slice(1, -1).map((p) => ({ location: p, stopover: true })),
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (res, status) => {
        if (status === "OK" && res?.routes[0]) {
          resolve({
            path: res.routes[0].overview_path.map((p) => ({ lat: p.lat(), lng: p.lng() })),
            source: "directions_legacy",
          });
        } else {
          resolve(null);
        }
      },
    );
  });
}

export async function computeDrivingRoute(stops: LatLng[]): Promise<RouteResult> {
  if (stops.length < 2) return { path: [], source: "straight_fallback" };
  const apiKey = await getApiKey();
  let lastError: string | undefined;

  if (apiKey) {
    try {
      const r = await tryRoutesApi(stops, apiKey);
      if (r && r.path.length > 0) return r;
    } catch (e: any) {
      lastError = e?.message || String(e);
      console.warn("[computeDrivingRoute] Routes API failed:", lastError);
    }
  }

  try {
    const r = await tryLegacyDirections(stops);
    if (r && r.path.length > 0) return r;
  } catch (e: any) {
    lastError = e?.message || String(e);
    console.warn("[computeDrivingRoute] Legacy Directions failed:", lastError);
  }

  return { path: stops, source: "straight_fallback", error: lastError };
}
