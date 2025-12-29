import React, { useState, useCallback, useEffect } from "react";
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';
import { useGoogleMaps } from "@/components/maps/GoogleMapsProvider";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Bus, Users, Phone, MapPin, Clock, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface ActiveTrip {
  id: string;
  status: string;
  current_latitude: number | null;
  current_longitude: number | null;
  started_at: string | null;
  routes: {
    id: string;
    name: string;
    schools: {
      name: string;
      latitude: number;
      longitude: number;
    };
  };
  drivers: {
    full_name: string;
    phone: string;
  } | null;
  supervisors: {
    full_name: string;
    phone: string;
  } | null;
}

interface TripStudent {
  id: string;
  status: string;
  registrations: {
    student_name: string;
    parent_accounts: {
      parent_name: string;
      father_phone: string;
    };
  };
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "في الانتظار", color: "bg-amber-500" },
  arriving: { label: "في الطريق", color: "bg-blue-500" },
  picked_up: { label: "تم الاستلام", color: "bg-green-500" },
  dropped_off: { label: "تم التوصيل", color: "bg-gray-500" },
};

const containerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = {
  lat: 30.0444,
  lng: 31.2357,
};

export function OperationsMapView() {
  const { isLoaded } = useGoogleMaps();

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<ActiveTrip | null>(null);
  const [activeMarker, setActiveMarker] = useState<string | null>(null);

  // Fetch all active trips with realtime refresh
  const { data: activeTrips = [], isLoading: tripsLoading } = useQuery({
    queryKey: ["all-active-trips"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_trips")
        .select(`
          id,
          status,
          current_latitude,
          current_longitude,
          started_at,
          routes!inner (
            id,
            name,
            schools (name, latitude, longitude)
          ),
          drivers (full_name, phone),
          supervisors (full_name, phone)
        `)
        .eq("status", "in_progress");

      if (error) throw error;
      return data as unknown as ActiveTrip[];
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch students for selected trip
  const { data: tripStudents = [] } = useQuery({
    queryKey: ["trip-students", selectedTrip?.id],
    queryFn: async () => {
      if (!selectedTrip) return [];
      
      const { data, error } = await supabase
        .from("trip_student_status")
        .select(`
          id,
          status,
          registrations (
            student_name,
            parent_accounts (parent_name, father_phone)
          )
        `)
        .eq("live_trip_id", selectedTrip.id)
        .order("pickup_order");

      if (error) throw error;
      return data as unknown as TripStudent[];
    },
    enabled: !!selectedTrip,
  });

  const onLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Fit bounds to show all buses
  useEffect(() => {
    if (!map || selectedTrip || !isLoaded || !window.google?.maps) return;

    const bounds = new google.maps.LatLngBounds();
    let hasValidBounds = false;

    activeTrips.forEach((trip) => {
      if (trip.current_latitude && trip.current_longitude) {
        bounds.extend({ lat: trip.current_latitude, lng: trip.current_longitude });
        hasValidBounds = true;
      }
    });

    if (hasValidBounds) {
      map.fitBounds(bounds, 100);
    }
  }, [map, activeTrips, selectedTrip, isLoaded]);

  // Center on selected trip
  useEffect(() => {
    if (!map || !selectedTrip?.current_latitude || !selectedTrip?.current_longitude) return;
    
    map.panTo({ lat: selectedTrip.current_latitude, lng: selectedTrip.current_longitude });
    map.setZoom(14);
  }, [map, selectedTrip]);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-muted/20 rounded-lg">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative w-full h-[600px] rounded-lg overflow-hidden border">
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
          fullscreenControl: false,
        }}
      >
        {/* Bus Markers */}
        {activeTrips.map((trip) => {
          if (!trip.current_latitude || !trip.current_longitude) return null;
          if (!window.google?.maps) return null;
          
          const isSelected = selectedTrip?.id === trip.id;

          return (
            <Marker
              key={trip.id}
              position={{
                lat: trip.current_latitude,
                lng: trip.current_longitude,
              }}
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

      {/* Active trips count badge */}
      <div className="absolute top-4 left-4 bg-background/95 backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg border">
        <div className="flex items-center gap-2">
          <Bus className="h-5 w-5 text-primary" />
          <span className="font-semibold">{activeTrips.length}</span>
          <span className="text-muted-foreground">باص نشط</span>
        </div>
      </div>

      {/* No active trips message */}
      {!tripsLoading && activeTrips.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm">
          <div className="text-center p-6 bg-background rounded-lg shadow-lg border">
            <Bus className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-semibold text-lg">لا توجد رحلات نشطة</h3>
            <p className="text-muted-foreground text-sm">ابدأ رحلة من قائمة المسارات</p>
          </div>
        </div>
      )}

      {/* Selected trip details panel */}
      {selectedTrip && (
        <Card className="absolute top-4 right-4 w-80 max-h-[calc(100%-2rem)] overflow-hidden shadow-xl">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Bus className="h-5 w-5 text-primary" />
                {selectedTrip.routes.name}
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setSelectedTrip(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Route info */}
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {selectedTrip.routes.schools.name}
              </div>
              {selectedTrip.started_at && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  بدأت {format(new Date(selectedTrip.started_at), "HH:mm", { locale: ar })}
                </div>
              )}
            </div>

            {/* Driver & Supervisor */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              {selectedTrip.drivers && (
                <div className="bg-muted/50 rounded p-2">
                  <p className="text-xs text-muted-foreground">السائق</p>
                  <p className="font-medium truncate">{selectedTrip.drivers.full_name}</p>
                  <a href={`tel:${selectedTrip.drivers.phone}`} className="text-xs text-primary flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    اتصال
                  </a>
                </div>
              )}
              {selectedTrip.supervisors && (
                <div className="bg-muted/50 rounded p-2">
                  <p className="text-xs text-muted-foreground">المشرف</p>
                  <p className="font-medium truncate">{selectedTrip.supervisors.full_name}</p>
                  <a href={`tel:${selectedTrip.supervisors.phone}`} className="text-xs text-primary flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    اتصال
                  </a>
                </div>
              )}
            </div>

            {/* Students list */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  الطلاب
                </span>
                <Badge variant="secondary">{tripStudents.length}</Badge>
              </div>
              <ScrollArea className="h-40">
                <div className="space-y-2">
                  {tripStudents.map((student) => {
                    const statusInfo = STATUS_LABELS[student.status] || STATUS_LABELS.pending;
                    return (
                      <div
                        key={student.id}
                        className="flex items-center justify-between p-2 bg-muted/30 rounded text-sm"
                      >
                        <div>
                          <p className="font-medium">{student.registrations.student_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {student.registrations.parent_accounts?.parent_name}
                          </p>
                        </div>
                        <Badge className={`${statusInfo.color} text-white text-xs`}>
                          {statusInfo.label}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-background/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border">
        <div className="flex items-center gap-2 text-sm">
          <div className="w-4 h-4 bg-blue-600 rounded-full" />
          <span>باص نشط</span>
        </div>
      </div>
    </div>
  );
}
