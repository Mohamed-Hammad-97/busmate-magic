import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useMapboxToken } from "@/hooks/useMapboxToken";
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

export function OperationsMapView() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const { token, isLoading: tokenLoading } = useMapboxToken();
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<ActiveTrip | null>(null);

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

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !token) return;

    mapboxgl.accessToken = token;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [31.2357, 30.0444], // Cairo default
      zoom: 10,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.current.on("load", () => {
      setMapLoaded(true);
    });

    return () => {
      map.current?.remove();
    };
  }, [token]);

  // Update bus markers
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const currentTripIds = new Set<string>();
    const bounds = new mapboxgl.LngLatBounds();
    let hasValidBounds = false;

    activeTrips.forEach((trip) => {
      if (!trip.current_latitude || !trip.current_longitude) return;
      
      currentTripIds.add(trip.id);
      bounds.extend([trip.current_longitude, trip.current_latitude]);
      hasValidBounds = true;

      const isSelected = selectedTrip?.id === trip.id;

      if (markers.current.has(trip.id)) {
        // Update existing marker position
        const marker = markers.current.get(trip.id)!;
        marker.setLngLat([trip.current_longitude, trip.current_latitude]);
        
        // Update selected state
        const el = marker.getElement();
        const innerDiv = el.querySelector("div");
        if (innerDiv) {
          innerDiv.className = `w-12 h-12 rounded-full flex items-center justify-center shadow-lg border-3 transition-all ${
            isSelected ? "bg-primary border-primary-foreground scale-125" : "bg-blue-600 border-white"
          }`;
        }
      } else {
        // Create new marker
        const el = document.createElement("div");
        el.className = "bus-marker cursor-pointer";
        el.innerHTML = `
          <div class="w-12 h-12 rounded-full flex items-center justify-center shadow-lg border-3 transition-all ${
            isSelected ? "bg-primary border-primary-foreground scale-125" : "bg-blue-600 border-white"
          }">
            <svg class="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.22.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
            </svg>
          </div>
        `;

        el.onclick = () => setSelectedTrip(trip);

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([trip.current_longitude, trip.current_latitude])
          .addTo(map.current!);

        markers.current.set(trip.id, marker);
      }
    });

    // Remove markers for trips no longer active
    markers.current.forEach((marker, id) => {
      if (!currentTripIds.has(id)) {
        marker.remove();
        markers.current.delete(id);
      }
    });

    // Fit bounds to show all buses
    if (hasValidBounds && !selectedTrip) {
      map.current.fitBounds(bounds, { padding: 100, maxZoom: 13 });
    }
  }, [activeTrips, mapLoaded, selectedTrip]);

  // Center on selected trip
  useEffect(() => {
    if (!map.current || !selectedTrip?.current_latitude || !selectedTrip?.current_longitude) return;
    
    map.current.flyTo({
      center: [selectedTrip.current_longitude, selectedTrip.current_latitude],
      zoom: 14,
      duration: 1000,
    });
  }, [selectedTrip]);

  if (tokenLoading) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-muted/20 rounded-lg">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative w-full h-[600px] rounded-lg overflow-hidden border">
      <div ref={mapContainer} className="absolute inset-0" />

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
