import React, { useEffect, useMemo, useState } from "react";
import { GoogleMap, Marker, Polyline, InfoWindow } from "@react-google-maps/api";
import { GoogleMapsProvider, useGoogleMaps } from "@/components/maps/GoogleMapsProvider";
import { Loader2 } from "lucide-react";

export interface PreviewStation {
  id: string;
  name: string;
  station_type: string;
  station_order: number;
  latitude: number | null;
  longitude: number | null;
}

interface Props {
  stations: PreviewStation[];
  height?: string;
  highlightStationId?: string;
  driverLocation?: { lat: number; lng: number } | null;
  onStationClick?: (id: string) => void;
}

const containerStyle = (h: string) => ({ width: "100%", height: h });

export default function LineRoutePreviewMap(props: Props) {
  return (
    <GoogleMapsProvider>
      <Inner {...props} />
    </GoogleMapsProvider>
  );
}

function Inner({ stations, height = "300px", highlightStationId, driverLocation, onStationClick }: Props) {
  const { isLoaded } = useGoogleMaps();
  const [routePath, setRoutePath] = useState<google.maps.LatLngLiteral[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  const valid = useMemo(
    () =>
      [...stations]
        .filter((s) => s.latitude != null && s.longitude != null)
        .sort((a, b) => a.station_order - b.station_order),
    [stations],
  );

  const center = useMemo(() => {
    if (driverLocation) return driverLocation;
    if (valid[0]) return { lat: valid[0].latitude!, lng: valid[0].longitude! };
    return { lat: 30.0444, lng: 31.2357 };
  }, [valid, driverLocation]);

  useEffect(() => {
    if (!isLoaded || valid.length < 2) {
      setRoutePath([]);
      return;
    }
    const svc = new google.maps.DirectionsService();
    const origin = { lat: valid[0].latitude!, lng: valid[0].longitude! };
    const destination = { lat: valid[valid.length - 1].latitude!, lng: valid[valid.length - 1].longitude! };
    const waypoints = valid.slice(1, -1).map((s) => ({
      location: { lat: s.latitude!, lng: s.longitude! },
      stopover: true,
    }));
    svc.route(
      { origin, destination, waypoints, travelMode: google.maps.TravelMode.DRIVING },
      (res, status) => {
        if (status === "OK" && res?.routes[0]) {
          setRoutePath(res.routes[0].overview_path.map((p) => ({ lat: p.lat(), lng: p.lng() })));
        } else {
          setRoutePath(valid.map((s) => ({ lat: s.latitude!, lng: s.longitude! })));
        }
      },
    );
  }, [isLoaded, valid]);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center bg-muted rounded-lg" style={{ height }}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (valid.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-muted rounded-lg text-sm text-muted-foreground"
        style={{ height }}
      >
        No station coordinates available
      </div>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden border">
      <GoogleMap
        mapContainerStyle={containerStyle(height)}
        center={center}
        zoom={13}
        options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
        onLoad={(map) => {
          if (valid.length > 1) {
            const bounds = new google.maps.LatLngBounds();
            valid.forEach((s) => bounds.extend({ lat: s.latitude!, lng: s.longitude! }));
            if (driverLocation) bounds.extend(driverLocation);
            map.fitBounds(bounds, 60);
          }
        }}
      >
        {valid.map((s, i) => {
          const isHighlight = highlightStationId === s.id;
          const isStart = i === 0;
          const isEnd = i === valid.length - 1;
          return (
            <Marker
              key={s.id}
              position={{ lat: s.latitude!, lng: s.longitude! }}
              label={{ text: String(i + 1), color: "white", fontWeight: "bold" }}
              onClick={() => {
                setOpenId(s.id);
                onStationClick?.(s.id);
              }}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: isHighlight ? 16 : 12,
                fillColor: isHighlight
                  ? "#f97316"
                  : isStart
                    ? "#16a34a"
                    : isEnd
                      ? "#dc2626"
                      : "#3b82f6",
                fillOpacity: 1,
                strokeColor: "white",
                strokeWeight: 2,
              }}
            >
              {openId === s.id && (
                <InfoWindow onCloseClick={() => setOpenId(null)}>
                  <div className="text-sm">
                    <div className="font-semibold">{s.name}</div>
                    <div className="text-xs text-muted-foreground">
                      #{i + 1} · {s.station_type}
                    </div>
                  </div>
                </InfoWindow>
              )}
            </Marker>
          );
        })}
        {routePath.length > 0 && (
          <Polyline
            path={routePath}
            options={{ strokeColor: "#3b82f6", strokeWeight: 4, strokeOpacity: 0.8 }}
          />
        )}
        {driverLocation && (
          <Marker
            position={driverLocation}
            icon={{
              path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
              scale: 6,
              fillColor: "#7c3aed",
              fillOpacity: 1,
              strokeColor: "white",
              strokeWeight: 2,
            }}
          />
        )}
      </GoogleMap>
    </div>
  );
}
