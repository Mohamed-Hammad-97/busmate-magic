import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useMapboxToken } from "@/hooks/useMapboxToken";
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

export function LiveTripMap({
  trip,
  students,
  onStudentClick,
  showDriverLocation = true,
  isDriver = false,
}: LiveTripMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const driverMarker = useRef<mapboxgl.Marker | null>(null);
  const studentMarkers = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const schoolMarker = useRef<mapboxgl.Marker | null>(null);
  const { token, isLoading: tokenLoading } = useMapboxToken();
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !token) return;

    mapboxgl.accessToken = token;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [31.2357, 30.0444], // Cairo default
      zoom: 12,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.current.on("load", () => {
      setMapLoaded(true);
    });

    return () => {
      map.current?.remove();
    };
  }, [token]);

  // Update markers when data changes
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const bounds = new mapboxgl.LngLatBounds();
    let hasValidBounds = false;

    // Update school marker
    if (trip?.routes?.schools) {
      const school = trip.routes.schools;
      if (schoolMarker.current) {
        schoolMarker.current.setLngLat([school.longitude, school.latitude]);
      } else {
        const el = document.createElement("div");
        el.className = "school-marker";
        el.innerHTML = `
          <div class="w-10 h-10 bg-primary rounded-full flex items-center justify-center shadow-lg border-2 border-white">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
        `;

        schoolMarker.current = new mapboxgl.Marker({ element: el })
          .setLngLat([school.longitude, school.latitude])
          .setPopup(new mapboxgl.Popup().setHTML(`<h3 class="font-bold">${school.name}</h3><p>المدرسة</p>`))
          .addTo(map.current!);
      }
      bounds.extend([school.longitude, school.latitude]);
      hasValidBounds = true;
    }

    // Update driver marker
    if (showDriverLocation && trip?.current_latitude && trip?.current_longitude) {
      if (driverMarker.current) {
        driverMarker.current.setLngLat([trip.current_longitude, trip.current_latitude]);
      } else {
        const el = document.createElement("div");
        el.className = "driver-marker";
        el.innerHTML = `
          <div class="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center shadow-lg border-3 border-white animate-pulse">
            <svg class="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.22.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
            </svg>
          </div>
        `;

        driverMarker.current = new mapboxgl.Marker({ element: el })
          .setLngLat([trip.current_longitude, trip.current_latitude])
          .addTo(map.current!);
      }
      bounds.extend([trip.current_longitude, trip.current_latitude]);
      hasValidBounds = true;
    }

    // Update student markers
    const currentStudentIds = new Set<string>();

    students.forEach((student) => {
      if (!student.registrations?.parent_accounts) return;
      
      const parent = student.registrations.parent_accounts;
      const lat = parent.pickup_latitude;
      const lng = parent.pickup_longitude;
      
      if (!lat || !lng) return;
      
      currentStudentIds.add(student.id);
      bounds.extend([lng, lat]);
      hasValidBounds = true;

      const statusColor = STATUS_COLORS[student.status] || STATUS_COLORS.pending;

      if (studentMarkers.current.has(student.id)) {
        // Update existing marker
        const marker = studentMarkers.current.get(student.id)!;
        const el = marker.getElement();
        const innerDiv = el.querySelector("div");
        if (innerDiv) {
          innerDiv.style.backgroundColor = statusColor;
        }
      } else {
        // Create new marker
        const el = document.createElement("div");
        el.className = "student-marker cursor-pointer";
        el.innerHTML = `
          <div class="w-8 h-8 rounded-full flex items-center justify-center shadow-md border-2 border-white transition-all" style="background-color: ${statusColor}">
            <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </div>
        `;

        if (isDriver && onStudentClick) {
          el.onclick = () => onStudentClick(student);
        }

        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <div class="p-2">
            <h3 class="font-bold text-sm">${student.registrations.student_name}</h3>
            <p class="text-xs text-gray-600">${parent.parent_name}</p>
            <p class="text-xs text-gray-500">${parent.father_phone}</p>
          </div>
        `);

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([lng, lat])
          .setPopup(popup)
          .addTo(map.current!);

        studentMarkers.current.set(student.id, marker);
      }
    });

    // Remove markers for students no longer in the list
    studentMarkers.current.forEach((marker, id) => {
      if (!currentStudentIds.has(id)) {
        marker.remove();
        studentMarkers.current.delete(id);
      }
    });

    // Fit bounds
    if (hasValidBounds) {
      map.current.fitBounds(bounds, { padding: 50, maxZoom: 15 });
    }
  }, [trip, students, mapLoaded, showDriverLocation, isDriver, onStudentClick]);

  if (tokenLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="absolute inset-0 rounded-lg" />
      
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
