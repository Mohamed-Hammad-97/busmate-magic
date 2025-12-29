import React, { useState, useCallback, useEffect } from "react";
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';
import { useGoogleMaps } from "@/components/maps/GoogleMapsProvider";
import { Loader2 } from "lucide-react";
import type { TripStudentStatus, LiveTrip } from "@/hooks/useLiveTrip";

interface LiveTripMapProps {
  trip: LiveTrip | null;
  students: TripStudentStatus[];
  onStudentClick?: (student: TripStudentStatus) => void;
  showDriverLocation?: boolean;
  isDriver?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b", // amber
  arriving: "#3b82f6", // blue
  picked_up: "#22c55e", // green
  dropped_off: "#6b7280", // gray
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

  const onLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Fit bounds to show all markers
  useEffect(() => {
    if (!map || !isLoaded || !window.google?.maps) return;

    const bounds = new google.maps.LatLngBounds();
    let hasValidBounds = false;

    // Add school location
    if (trip?.routes?.schools) {
      const school = trip.routes.schools;
      bounds.extend({ lat: school.latitude, lng: school.longitude });
      hasValidBounds = true;
    }

    // Add driver location
    if (showDriverLocation && trip?.current_latitude && trip?.current_longitude) {
      bounds.extend({ lat: trip.current_latitude, lng: trip.current_longitude });
      hasValidBounds = true;
    }

    // Add student locations
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

  return (
    <div className="relative w-full h-full">
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
        {/* School Marker */}
        {trip?.routes?.schools && window.google?.maps && (
          <Marker
            position={{
              lat: trip.routes.schools.latitude,
              lng: trip.routes.schools.longitude,
            }}
            icon={{
              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
                  <circle cx="20" cy="20" r="18" fill="#3B82F6" stroke="white" stroke-width="2"/>
                  <path d="M10 18l10-6 10 6M12 20v8h16v-8M18 28v-4h4v4" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              `),
              scaledSize: new google.maps.Size(40, 40),
            }}
            onClick={() => setActiveMarker('school')}
          >
            {activeMarker === 'school' && (
              <InfoWindow onCloseClick={() => setActiveMarker(null)}>
                <div>
                  <h3 className="font-bold">{trip.routes.schools.name}</h3>
                  <p>المدرسة</p>
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
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
                  <circle cx="24" cy="24" r="22" fill="#2563EB" stroke="white" stroke-width="3"/>
                  <path d="M35 23.5C35 22 34 21 32 21H29L27 16H21L19 21H16C14 21 13 22 13 23.5L13 32H15V33.5C15 34.3 15.7 35 16.5 35C17.3 35 18 34.3 18 33.5V32H30V33.5C30 34.3 30.7 35 31.5 35C32.3 35 33 34.3 33 33.5V32H35V23.5ZM17 28C16 28 15 27 15 26C15 25 16 24 17 24C18 24 19 25 19 26C19 27 18 28 17 28ZM31 28C30 28 29 27 29 26C29 25 30 24 31 24C32 24 33 25 33 26C33 27 32 28 31 28ZM15 23L17 18.5H31L33 23H15Z" fill="white"/>
                </svg>
              `),
              scaledSize: new google.maps.Size(48, 48),
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

          return (
            <Marker
              key={student.id}
              position={{
                lat: parent.pickup_latitude,
                lng: parent.pickup_longitude,
              }}
              icon={{
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
                    <circle cx="16" cy="16" r="14" fill="${statusColor}" stroke="white" stroke-width="2"/>
                    <circle cx="16" cy="12" r="4" fill="white"/>
                    <path d="M8 26c0-4 4-6 8-6s8 2 8 6" fill="white"/>
                  </svg>
                `),
                scaledSize: new google.maps.Size(32, 32),
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
                  <div className="p-2">
                    <h3 className="font-bold text-sm">{student.registrations.student_name}</h3>
                    <p className="text-xs text-gray-600">{parent.parent_name}</p>
                    <p className="text-xs text-gray-500">{parent.father_phone}</p>
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
        </div>
      </div>
    </div>
  );
}
