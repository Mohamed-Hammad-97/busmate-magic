import { useState, useCallback, useEffect } from "react";
import { GoogleMap, Marker } from "@react-google-maps/api";
import { useGoogleMaps } from "@/components/maps/GoogleMapsProvider";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bus, MapPin, Phone, User, Clock, X, Loader2, Navigation } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface CompanyTrip {
  id: string;
  status: string;
  current_latitude: number | null;
  current_longitude: number | null;
  started_at: string | null;
  line_name: string;
  drivers: { full_name: string; phone: string } | null;
  supervisors: { full_name: string; phone: string } | null;
}

const containerStyle = { width: "100%", height: "100%" };
const defaultCenter = { lat: 30.0444, lng: 31.2357 };

export function CompanyLiveTracking({ trips }: { trips: CompanyTrip[] }) {
  const { isLoaded } = useGoogleMaps();
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<CompanyTrip | null>(null);

  const onLoad = useCallback((m: google.maps.Map) => setMap(m), []);
  const onUnmount = useCallback(() => setMap(null), []);

  // Fit bounds
  useEffect(() => {
    if (!map || !isLoaded || !window.google?.maps || selectedTrip) return;
    const bounds = new google.maps.LatLngBounds();
    let hasValid = false;
    trips.forEach((t) => {
      if (t.current_latitude && t.current_longitude) {
        bounds.extend({ lat: t.current_latitude, lng: t.current_longitude });
        hasValid = true;
      }
    });
    if (hasValid) map.fitBounds(bounds, 100);
  }, [map, trips, selectedTrip, isLoaded]);

  useEffect(() => {
    if (!map || !selectedTrip?.current_latitude || !selectedTrip?.current_longitude) return;
    map.panTo({ lat: selectedTrip.current_latitude, lng: selectedTrip.current_longitude });
    map.setZoom(14);
  }, [map, selectedTrip]);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-[500px] bg-muted/20 rounded-lg">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (trips.length === 0) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="py-16 text-center text-muted-foreground">
          <Navigation className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-medium mb-1">لا توجد رحلات نشطة حالياً</p>
          <p className="text-sm">ستظهر الحافلات هنا عند بدء الرحلات</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {trips.map((trip) => (
          <Card
            key={trip.id}
            className={`border-0 shadow-md cursor-pointer transition-all hover:shadow-lg ${selectedTrip?.id === trip.id ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setSelectedTrip(selectedTrip?.id === trip.id ? null : trip)}
          >
            <CardContent className="p-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <Bus className="h-5 w-5 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm truncate">{trip.line_name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {trip.drivers && <span>{trip.drivers.full_name}</span>}
                  {trip.started_at && (
                    <span>• {format(new Date(trip.started_at), "HH:mm", { locale: ar })}</span>
                  )}
                </div>
              </div>
              <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] shrink-0">نشط</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Map */}
      <div className="relative w-full h-[450px] rounded-xl overflow-hidden border shadow-md">
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={defaultCenter}
          zoom={10}
          onLoad={onLoad}
          onUnmount={onUnmount}
          options={{
            disableDefaultUI: false,
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: true,
          }}
        >
          {trips.map((trip) => {
            if (!trip.current_latitude || !trip.current_longitude || !window.google?.maps) return null;
            const isSelected = selectedTrip?.id === trip.id;
            return (
              <Marker
                key={trip.id}
                position={{ lat: trip.current_latitude, lng: trip.current_longitude }}
                icon={{
                  url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
                      <circle cx="24" cy="24" r="${isSelected ? 24 : 22}" fill="${isSelected ? '#3B82F6' : '#2563EB'}" stroke="white" stroke-width="3"/>
                      <path d="M35 23.5C35 22 34 21 32 21H29L27 16H21L19 21H16C14 21 13 22 13 23.5L13 32H15V33.5C15 34.3 15.7 35 16.5 35C17.3 35 18 34.3 18 33.5V32H30V33.5C30 34.3 30.7 35 31.5 35C32.3 35 33 34.3 33 33.5V32H35V23.5ZM17 28C16 28 15 27 15 26C15 25 16 24 17 24C18 24 19 25 19 26C19 27 18 28 17 28ZM31 28C30 28 29 27 29 26C29 25 30 24 31 24C32 24 33 25 33 26C33 27 32 28 31 28ZM15 23L17 18.5H31L33 23H15Z" fill="white"/>
                    </svg>
                  `),
                  scaledSize: new google.maps.Size(48, 48),
                }}
                onClick={() => setSelectedTrip(trip)}
              />
            );
          })}
        </GoogleMap>

        {/* Selected trip info overlay */}
        {selectedTrip && (
          <Card className="absolute top-4 right-4 w-72 shadow-xl border-0">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Bus className="h-4 w-4 text-primary" />
                  {selectedTrip.line_name}
                </h3>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedTrip(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {selectedTrip.started_at && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  بدأت {format(new Date(selectedTrip.started_at), "HH:mm", { locale: ar })}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 text-sm">
                {selectedTrip.drivers && (
                  <div className="bg-muted/50 rounded p-2">
                    <p className="text-[10px] text-muted-foreground">السائق</p>
                    <p className="font-medium text-xs truncate">{selectedTrip.drivers.full_name}</p>
                    <a href={`tel:${selectedTrip.drivers.phone}`} className="text-[10px] text-primary flex items-center gap-1 mt-0.5">
                      <Phone className="h-3 w-3" /> اتصال
                    </a>
                  </div>
                )}
                {selectedTrip.supervisors && (
                  <div className="bg-muted/50 rounded p-2">
                    <p className="text-[10px] text-muted-foreground">المشرف</p>
                    <p className="font-medium text-xs truncate">{selectedTrip.supervisors.full_name}</p>
                    <a href={`tel:${selectedTrip.supervisors.phone}`} className="text-[10px] text-primary flex items-center gap-1 mt-0.5">
                      <Phone className="h-3 w-3" /> اتصال
                    </a>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active trips badge */}
        <div className="absolute top-4 left-4 bg-background/95 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-lg border">
          <div className="flex items-center gap-2 text-sm">
            <Bus className="h-4 w-4 text-primary" />
            <span className="font-semibold">{trips.length}</span>
            <span className="text-muted-foreground">باص نشط</span>
          </div>
        </div>
      </div>
    </div>
  );
}
