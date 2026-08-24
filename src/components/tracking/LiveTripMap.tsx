import React, { useState, useCallback, useEffect } from "react";
import { GoogleMap, Marker, InfoWindow, Polyline } from '@react-google-maps/api';
import { useGoogleMaps } from "@/components/maps/GoogleMapsProvider";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { computeDrivingRoute } from "@/lib/googleRoutes";
import type { TripStudentStatus, LiveTrip } from "@/hooks/useLiveTrip";

interface LiveTripMapProps {
  trip: LiveTrip | null;
  students: TripStudentStatus[];
  onStudentClick?: (student: TripStudentStatus) => void;
  showDriverLocation?: boolean;
  isDriver?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  arriving: "#3b82f6",
  picked_up: "#22c55e",
  dropped_off: "#6b7280",
};

const containerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = {
  lat: 30.0444,
  lng: 31.2357,
};

export function LiveTripMap({
  trip,
  students,
  onStudentClick,
  showDriverLocation = true,
  isDriver = false,
}: LiveTripMapProps) {
  const { isLoaded } = useGoogleMaps();
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [activeMarker, setActiveMarker] = useState<string | null>(null);
  const [roadPath, setRoadPath] = useState<google.maps.LatLngLiteral[] | null>(null);

  // Fetch today's absences for students on this trip
  const registrationIds = students.map(s => s.registration_id);
  const { data: todayAbsences = [] } = useQuery({
    queryKey: ["trip-absences-today", registrationIds],
    queryFn: async () => {
      if (registrationIds.length === 0) return [];
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("student_absences")
        .select("registration_id")
        .in("registration_id", registrationIds)
        .eq("absence_date", today);
      if (error) return [];
      return data.map(a => a.registration_id);
    },
    enabled: registrationIds.length > 0,
  });

  const onLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Build the ordered list of stops (skipping absent students)
  const stopPoints = React.useMemo(() => {
    const points: google.maps.LatLngLiteral[] = [];

    // Sort students by pickup_order
    const sortedStudents = [...students]
      .filter(s => s.registrations?.parent_accounts?.pickup_latitude && s.registrations?.parent_accounts?.pickup_longitude)
      .filter(s => !todayAbsences.includes(s.registration_id))
      .sort((a, b) => (a.pickup_order || 999) - (b.pickup_order || 999));

    sortedStudents.forEach(student => {
      const parent = student.registrations!.parent_accounts!;
      points.push({ lat: parent.pickup_latitude, lng: parent.pickup_longitude });
    });

    // Add school at the end
    if (trip?.routes?.schools) {
      points.push({ lat: trip.routes.schools.latitude, lng: trip.routes.schools.longitude });
    }

    return points;
  }, [students, trip, todayAbsences]);

  // Stable key so the route is only recomputed when the stops really change
  const stopsKey = React.useMemo(
    () => stopPoints.map(p => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|'),
    [stopPoints]
  );

  // Compute a real driving route (following roads) through the stops
  useEffect(() => {
    let cancelled = false;
    if (!isLoaded || stopPoints.length < 2) {
      setRoadPath(null);
      return;
    }
    (async () => {
      const result = await computeDrivingRoute(stopPoints);
      if (cancelled) return;
      setRoadPath(result.path.length > 1 ? result.path : null);
    })();
    return () => { cancelled = true; };
  }, [stopsKey, isLoaded]);

  // Path drawn on the map: real road route when available, straight lines meanwhile
  const routePath = roadPath ?? stopPoints;

  // Turn-by-turn navigation link for the whole trip (Google caps waypoints)
  const navigationUrl = React.useMemo(() => {
    if (stopPoints.length < 1) return null;
    const fmt = (p: google.maps.LatLngLiteral) => `${p.lat},${p.lng}`;
    const destination = stopPoints[stopPoints.length - 1];
    const waypoints = stopPoints.slice(0, -1).slice(0, 9);
    const origin =
      trip?.current_latitude && trip?.current_longitude
        ? `${trip.current_latitude},${trip.current_longitude}`
        : waypoints.length > 0
          ? fmt(waypoints[0])
          : fmt(destination);
    const params = new URLSearchParams({
      api: '1',
      origin,
      destination: fmt(destination),
      travelmode: 'driving',
    });
    if (waypoints.length > 0) params.set('waypoints', waypoints.map(fmt).join('|'));
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }, [stopPoints, trip?.current_latitude, trip?.current_longitude]);

  // Fit bounds
  useEffect(() => {
    if (!map || !isLoaded || !window.google?.maps) return;

    const bounds = new google.maps.LatLngBounds();
    let hasValidBounds = false;

    if (trip?.routes?.schools) {
      bounds.extend({ lat: trip.routes.schools.latitude, lng: trip.routes.schools.longitude });
      hasValidBounds = true;
    }

    if (showDriverLocation && trip?.current_latitude && trip?.current_longitude) {
      bounds.extend({ lat: trip.current_latitude, lng: trip.current_longitude });
      hasValidBounds = true;
    }

    students.forEach((student) => {
      if (student.registrations?.parent_accounts) {
        const parent = student.registrations.parent_accounts;
        if (parent.pickup_latitude && parent.pickup_longitude) {
          bounds.extend({ lat: parent.pickup_latitude, lng: parent.pickup_longitude });
          hasValidBounds = true;
        }
      }
    });

    if (hasValidBounds) {
      map.fitBounds(bounds, 50);
    }
  }, [map, trip, students, showDriverLocation, isLoaded]);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const createStudentIcon = (statusColor: string, isAbsent: boolean, pickupOrder?: number | null) => {
    if (isAbsent) {
      // Red circle with X line for absent
      return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="16" fill="#dc2626" stroke="white" stroke-width="2"/>
          <circle cx="18" cy="13" r="4" fill="white" opacity="0.5"/>
          <path d="M10 28c0-4 4-6 8-6s8 2 8 6" fill="white" opacity="0.5"/>
          <line x1="8" y1="8" x2="28" y2="28" stroke="white" stroke-width="3" stroke-linecap="round"/>
          <line x1="28" y1="8" x2="8" y2="28" stroke="white" stroke-width="3" stroke-linecap="round"/>
        </svg>
      `);
    }
    
    const orderText = pickupOrder ? `<text x="18" y="22" font-size="11" font-weight="bold" fill="white" text-anchor="middle" font-family="Arial">${pickupOrder}</text>` : '';
    
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="16" fill="${statusColor}" stroke="white" stroke-width="2"/>
        <circle cx="18" cy="12" r="4" fill="white"/>
        <path d="M8 28c0-4 4-6 10-6s10 2 10 6" fill="white"/>
        ${orderText}
      </svg>
    `);
  };

  return (
    <div className="relative w-full h-full">
      {isDriver && navigationUrl && (
        <Button
          size="sm"
          className="absolute top-3 left-3 z-10 gap-2 shadow-lg"
          onClick={() => window.open(navigationUrl, '_blank', 'noopener')}
        >
          <Navigation className="h-4 w-4" />
          Navigate
        </Button>
      )}
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={defaultCenter}
        zoom={12}
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
        {/* Route Polyline */}
        {routePath.length > 1 && (
          <Polyline
            path={routePath}
            options={{
              strokeColor: "#3B82F6",
              strokeOpacity: 0.8,
              strokeWeight: 5,
              geodesic: false,
              icons: [{
                icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 3, strokeColor: "#1d4ed8" },
                offset: "50%",
                repeat: "100px",
              }],
            }}
          />
        )}

        {/* School Marker */}
        {trip?.routes?.schools && window.google?.maps && (
          <Marker
            position={{
              lat: trip.routes.schools.latitude,
              lng: trip.routes.schools.longitude,
            }}
            icon={{
              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
                  <circle cx="22" cy="22" r="20" fill="#1d4ed8" stroke="white" stroke-width="2"/>
                  <path d="M11 20l11-7 11 7M13 22v9h18v-9M19 31v-5h6v5" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              `),
              scaledSize: new google.maps.Size(44, 44),
            }}
            onClick={() => setActiveMarker('school')}
          >
            {activeMarker === 'school' && (
              <InfoWindow onCloseClick={() => setActiveMarker(null)}>
                <div style={{ padding: '4px' }}>
                  <h3 style={{ fontWeight: 'bold', margin: 0 }}>{trip.routes.schools.name}</h3>
                  <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>المدرسة</p>
                </div>
              </InfoWindow>
            )}
          </Marker>
        )}

        {/* Driver Marker */}
        {showDriverLocation && trip?.current_latitude && trip?.current_longitude && window.google?.maps && (
          <Marker
            position={{
              lat: trip.current_latitude,
              lng: trip.current_longitude,
            }}
            icon={{
              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 52 52">
                  <circle cx="26" cy="26" r="24" fill="#2563EB" stroke="white" stroke-width="3">
                    <animate attributeName="r" values="22;24;22" dur="2s" repeatCount="indefinite"/>
                  </circle>
                  <circle cx="26" cy="26" r="18" fill="#3b82f6" stroke="none"/>
                  <path d="M37 25.5C37 24 36 23 34 23H31L29 18H23L21 23H18C16 23 15 24 15 25.5L15 34H17V35.5C17 36.3 17.7 37 18.5 37C19.3 37 20 36.3 20 35.5V34H32V35.5C32 36.3 32.7 37 33.5 37C34.3 37 35 36.3 35 35.5V34H37V25.5ZM19 30C18 30 17 29 17 28C17 27 18 26 19 26C20 26 21 27 21 28C21 29 20 30 19 30ZM33 30C32 30 31 29 31 28C31 27 32 26 33 26C34 26 35 27 35 28C35 29 34 30 33 30ZM17 25L19 20.5H33L35 25H17Z" fill="white"/>
                </svg>
              `),
              scaledSize: new google.maps.Size(52, 52),
            }}
          />
        )}

        {/* Student Markers */}
        {students.map((student) => {
          if (!student.registrations?.parent_accounts) return null;
          
          const parent = student.registrations.parent_accounts;
          if (!parent.pickup_latitude || !parent.pickup_longitude) return null;
          if (!window.google?.maps) return null;

          const statusColor = STATUS_COLORS[student.status] || STATUS_COLORS.pending;
          const isAbsent = todayAbsences.includes(student.registration_id);

          return (
            <Marker
              key={student.id}
              position={{
                lat: parent.pickup_latitude,
                lng: parent.pickup_longitude,
              }}
              icon={{
                url: createStudentIcon(statusColor, isAbsent, student.pickup_order),
                scaledSize: new google.maps.Size(36, 36),
              }}
              onClick={() => {
                if (isDriver && onStudentClick) {
                  onStudentClick(student);
                }
                setActiveMarker(student.id);
              }}
            >
              {activeMarker === student.id && (
                <InfoWindow onCloseClick={() => setActiveMarker(null)}>
                  <div style={{ padding: '4px' }}>
                    <h3 style={{ fontWeight: 'bold', margin: 0, fontSize: '13px' }}>
                      {student.registrations.student_name}
                      {isAbsent && <span style={{ color: '#dc2626', marginRight: '4px' }}> (غائب)</span>}
                    </h3>
                    <p style={{ margin: 0, color: '#666', fontSize: '11px' }}>{parent.parent_name}</p>
                    <p style={{ margin: 0, color: '#888', fontSize: '11px' }}>{parent.father_phone}</p>
                    {student.pickup_order && (
                      <p style={{ margin: '2px 0 0', color: '#3b82f6', fontSize: '11px', fontWeight: 'bold' }}>
                        ترتيب الاستلام: {student.pickup_order}
                      </p>
                    )}
                    {isDriver && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${parent.pickup_latitude},${parent.pickup_longitude}&travelmode=driving`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'inline-block', marginTop: '6px', color: '#2563eb', fontSize: '11px', fontWeight: 600 }}
                      >
                        ▸ التوجه إلى هذه المحطة
                      </a>
                    )}
                  </div>
                </InfoWindow>
              )}
            </Marker>
          );
        })}
      </GoogleMap>
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-background/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border">
        <h4 className="text-xs font-semibold mb-2">الحالة</h4>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.pending }} />
            <span>في الانتظار</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.arriving }} />
            <span>الباص في الطريق</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.picked_up }} />
            <span>تم الاستلام</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.dropped_off }} />
            <span>تم التوصيل</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-destructive" />
            <span>غائب</span>
          </div>
        </div>
      </div>
    </div>
  );
}
