import { carIcon, useCarIconReady, useHeadings } from "@/lib/carMarker";
import { useEffect, useState, useCallback, useRef } from "react";
import { GoogleMap, Marker } from "@react-google-maps/api";
import { GoogleMapsProvider, useGoogleMaps } from "@/components/maps/GoogleMapsProvider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bus, Phone, Clock, X, Navigation } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

interface LiveTrip {
  id: string;
  current_latitude: number | null;
  current_longitude: number | null;
  started_at: string | null;
  total_seats: number;
  available_seats: number;
  daily_lines: { name: string; city: string } | null;
  drivers: { full_name: string; phone: string } | null;
}

const containerStyle = { width: "100%", height: "100%" };
const defaultCenter = { lat: 30.0444, lng: 31.2357 };

function MapInner({ trips: initialTrips }: { trips: LiveTrip[] }) {
  const { isLoaded } = useGoogleMaps();
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [trips, setTrips] = useState<LiveTrip[]>(initialTrips);
  const [selected, setSelected] = useState<LiveTrip | null>(null);
  const fittedRef = useRef(false);
  useCarIconReady();
  const headingFor = useHeadings();

  useEffect(() => setTrips(initialTrips), [initialTrips]);

  // Realtime subscription on daily_line_trips for live position updates
  useEffect(() => {
    const ids = initialTrips.map((t) => t.id);
    if (ids.length === 0) return;
    const channel = supabase
      .channel("daily-line-trips-live")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "daily_line_trips", filter: `id=in.(${ids.join(",")})` },
        (payload: any) => {
          const updated = payload.new;
          setTrips((prev) =>
            prev.map((t) =>
              t.id === updated.id
                ? { ...t, current_latitude: updated.current_latitude, current_longitude: updated.current_longitude }
                : t
            )
          );
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [initialTrips]);

  const onLoad = useCallback((m: google.maps.Map) => setMap(m), []);
  const onUnmount = useCallback(() => setMap(null), []);

  // Fit bounds once we have positions
  useEffect(() => {
    if (!map || !isLoaded || fittedRef.current || selected) return;
    const bounds = new google.maps.LatLngBounds();
    let any = false;
    trips.forEach((t) => {
      if (t.current_latitude && t.current_longitude) {
        bounds.extend({ lat: t.current_latitude, lng: t.current_longitude });
        any = true;
      }
    });
    if (any) {
      map.fitBounds(bounds, 80);
      fittedRef.current = true;
    }
  }, [map, trips, selected, isLoaded]);

  useEffect(() => {
    if (!map || !selected?.current_latitude || !selected?.current_longitude) return;
    map.panTo({ lat: selected.current_latitude, lng: selected.current_longitude });
    map.setZoom(15);
  }, [map, selected]);

  if (!isLoaded) return null;

  const withLocation = trips.filter((t) => t.current_latitude && t.current_longitude);

  return (
    <div className="relative w-full h-[500px] rounded-xl overflow-hidden border shadow-md">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={defaultCenter}
        zoom={10}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: true }}
      >
        {trips.map((trip) => {
          if (!trip.current_latitude || !trip.current_longitude || !window.google?.maps) return null;
          const isSel = selected?.id === trip.id;
          return (
            <Marker
              key={trip.id}
              position={{ lat: trip.current_latitude, lng: trip.current_longitude }}
              icon={carIcon(headingFor(trip.id, trip.current_latitude, trip.current_longitude), { ring: isSel ? '#16A34A' : undefined, size: isSel ? 68 : 58 })}
              onClick={() => setSelected(trip)}
            />
          );
        })}
      </GoogleMap>

      {selected && (
        <Card className="absolute top-4 right-4 w-72 shadow-xl border-0">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Bus className="h-4 w-4 text-primary" />
                {selected.daily_lines?.name}
              </h3>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelected(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {selected.started_at && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> Started {format(new Date(selected.started_at), "HH:mm")}
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              Seats: {selected.total_seats - selected.available_seats}/{selected.total_seats}
            </div>
            {selected.drivers && (
              <div className="bg-muted/50 rounded p-2 text-xs">
                <p className="text-[10px] text-muted-foreground">Driver</p>
                <p className="font-medium">{selected.drivers.full_name}</p>
                <a href={`tel:${selected.drivers.phone}`} className="text-primary flex items-center gap-1 mt-0.5">
                  <Phone className="h-3 w-3" /> {selected.drivers.phone}
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="absolute top-4 left-4 bg-background/95 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-lg border">
        <div className="flex items-center gap-2 text-sm">
          <Navigation className="h-4 w-4 text-primary" />
          <span className="font-semibold">{withLocation.length}</span>
          <span className="text-muted-foreground">live · {trips.length - withLocation.length} pending GPS</span>
        </div>
      </div>

      {trips.length > 0 && withLocation.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 pointer-events-none">
          <Card className="border-0 shadow-lg pointer-events-auto">
            <CardContent className="py-4 px-6 text-center text-sm text-muted-foreground">
              <Navigation className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
              Waiting for driver GPS signal…
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function DailyLinesLiveMap({ trips }: { trips: LiveTrip[] }) {
  if (trips.length === 0) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="py-16 text-center text-muted-foreground">
          <Navigation className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-medium">No active trips to track right now</p>
          <p className="text-sm">Buses appear on the map when drivers start their trips</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <GoogleMapsProvider>
      <MapInner trips={trips} />
    </GoogleMapsProvider>
  );
}

