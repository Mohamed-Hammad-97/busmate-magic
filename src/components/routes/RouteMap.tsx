import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { Users, School, Route, Loader2 } from 'lucide-react';

interface Student {
  id: string;
  student_name: string;
  parent_name: string;
  lat: number;
  lng: number;
  pickup_order?: number;
}

interface SchoolLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface RouteData {
  id: string;
  name: string;
  students: Student[];
  school?: SchoolLocation;
  color?: string;
}

interface RouteMapProps {
  students?: Student[];
  schools?: SchoolLocation[];
  routes?: RouteData[];
  selectedRoute?: RouteData | null;
  onRouteClick?: (route: RouteData) => void;
  showControls?: boolean;
  height?: string;
  showRouteLine?: boolean;
}

const ROUTE_COLORS = [
  '#3B82F6', // blue
  '#EF4444', // red
  '#10B981', // green
  '#F59E0B', // amber
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
];

const RouteMap: React.FC<RouteMapProps> = ({
  students = [],
  schools = [],
  routes = [],
  selectedRoute,
  onRouteClick,
  showControls = true,
  height = '400px',
  showRouteLine = true,
}) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { token, isLoading: tokenLoading } = useMapboxToken();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  const [showStudents, setShowStudents] = useState(true);
  const [showSchools, setShowSchools] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);

  useEffect(() => {
    if (!mapContainer.current || !token) return;

    mapboxgl.accessToken = token;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [31.2357, 30.0444], // Cairo, Egypt
      zoom: 10,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    return () => {
      map.current?.remove();
    };
  }, [token]);

  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Clear existing route lines
    routes.forEach((_, idx) => {
      if (map.current?.getLayer(`route-line-${idx}`)) {
        map.current.removeLayer(`route-line-${idx}`);
      }
      if (map.current?.getSource(`route-${idx}`)) {
        map.current.removeSource(`route-${idx}`);
      }
    });

    const bounds = new mapboxgl.LngLatBounds();
    let hasPoints = false;

    // Add student markers
    if (showStudents) {
      students.forEach((student) => {
        if (!student.lat || !student.lng) return;
        
        const el = document.createElement('div');
        el.style.cssText = `
          width: 24px;
          height: 24px;
          background: #3B82F6;
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 10px;
          font-weight: bold;
        `;
        el.innerText = student.pickup_order?.toString() || '•';

        const marker = new mapboxgl.Marker(el)
          .setLngLat([student.lng, student.lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(
              `<strong>${student.student_name || student.parent_name}</strong>`
            )
          )
          .addTo(map.current!);

        markersRef.current.push(marker);
        bounds.extend([student.lng, student.lat]);
        hasPoints = true;
      });
    }

    // Add school markers
    if (showSchools) {
      schools.forEach((school) => {
        const el = document.createElement('div');
        el.style.cssText = `
          width: 32px;
          height: 32px;
          background: hsl(var(--primary));
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        `;
        el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 6 8-4 8 4"></path><path d="m18 10 4 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8l4-2"></path><path d="M14 22v-4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v4"></path><path d="M18 5v17"></path><path d="M6 5v17"></path><circle cx="12" cy="9" r="2"></circle></svg>`;

        const marker = new mapboxgl.Marker(el)
          .setLngLat([school.longitude, school.latitude])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(`<strong>${school.name}</strong>`)
          )
          .addTo(map.current!);

        markersRef.current.push(marker);
        bounds.extend([school.longitude, school.latitude]);
        hasPoints = true;
      });
    }

    // Add route lines and markers
    if (showRoutes && showRouteLine) {
      routes.forEach((route, idx) => {
        const color = route.color || ROUTE_COLORS[idx % ROUTE_COLORS.length];
        const isSelected = selectedRoute?.id === route.id;

        // Sort students by pickup_order
        const sortedStudents = [...route.students].sort(
          (a, b) => (a.pickup_order || 0) - (b.pickup_order || 0)
        );

        // Create line coordinates: students -> school
        const coordinates: [number, number][] = [];
        sortedStudents.forEach((student) => {
          if (student.lat && student.lng) {
            coordinates.push([student.lng, student.lat]);
            bounds.extend([student.lng, student.lat]);
            hasPoints = true;
          }
        });

        if (route.school) {
          coordinates.push([route.school.longitude, route.school.latitude]);
          bounds.extend([route.school.longitude, route.school.latitude]);
          hasPoints = true;
        }

        // Add route line
        if (coordinates.length >= 2 && map.current) {
          map.current.on('load', () => {
            if (!map.current?.getSource(`route-${idx}`)) {
              map.current?.addSource(`route-${idx}`, {
                type: 'geojson',
                data: {
                  type: 'Feature',
                  properties: {},
                  geometry: {
                    type: 'LineString',
                    coordinates,
                  },
                },
              });

              map.current?.addLayer({
                id: `route-line-${idx}`,
                type: 'line',
                source: `route-${idx}`,
                layout: {
                  'line-join': 'round',
                  'line-cap': 'round',
                },
                paint: {
                  'line-color': color,
                  'line-width': isSelected ? 5 : 3,
                  'line-opacity': isSelected ? 1 : 0.7,
                },
              });
            }
          });

          // For already loaded map
          if (map.current.isStyleLoaded()) {
            if (!map.current.getSource(`route-${idx}`)) {
              map.current.addSource(`route-${idx}`, {
                type: 'geojson',
                data: {
                  type: 'Feature',
                  properties: {},
                  geometry: {
                    type: 'LineString',
                    coordinates,
                  },
                },
              });

              map.current.addLayer({
                id: `route-line-${idx}`,
                type: 'line',
                source: `route-${idx}`,
                layout: {
                  'line-join': 'round',
                  'line-cap': 'round',
                },
                paint: {
                  'line-color': color,
                  'line-width': isSelected ? 5 : 3,
                  'line-opacity': isSelected ? 1 : 0.7,
                },
              });
            }
          }
        }

        // Add student markers for route
        sortedStudents.forEach((student) => {
          if (!student.lat || !student.lng) return;

          const el = document.createElement('div');
          el.style.cssText = `
            width: 24px;
            height: 24px;
            background: ${color};
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 10px;
            font-weight: bold;
            cursor: pointer;
          `;
          el.innerText = student.pickup_order?.toString() || '•';

          const marker = new mapboxgl.Marker(el)
            .setLngLat([student.lng, student.lat])
            .setPopup(
              new mapboxgl.Popup({ offset: 25 }).setHTML(
                `<strong>${route.name}</strong><br/>${student.student_name || student.parent_name}`
              )
            )
            .addTo(map.current!);

          el.addEventListener('click', () => onRouteClick?.(route));
          markersRef.current.push(marker);
        });
      });
    }

    // Fit bounds
    if (hasPoints) {
      map.current.fitBounds(bounds, { padding: 50, maxZoom: 14 });
    }
  }, [students, schools, routes, showStudents, showSchools, showRoutes, selectedRoute, showRouteLine, onRouteClick]);

  const focusOnRoute = (route: RouteData) => {
    if (!map.current) return;

    const bounds = new mapboxgl.LngLatBounds();
    route.students.forEach((s) => {
      if (s.lat && s.lng) bounds.extend([s.lng, s.lat]);
    });
    if (route.school) {
      bounds.extend([route.school.longitude, route.school.latitude]);
    }

    map.current.fitBounds(bounds, { padding: 50, maxZoom: 15, duration: 1500 });
  };

  if (tokenLoading) {
    return (
      <div className="flex items-center justify-center bg-muted rounded-lg" style={{ height }}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showControls && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant={showStudents ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowStudents(!showStudents)}
          >
            <Users className="h-4 w-4 mr-2" />
            {isRtl ? 'الطلاب' : 'Students'}
          </Button>
          <Button
            variant={showSchools ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowSchools(!showSchools)}
          >
            <School className="h-4 w-4 mr-2" />
            {isRtl ? 'المدارس' : 'Schools'}
          </Button>
          <Button
            variant={showRoutes ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowRoutes(!showRoutes)}
          >
            <Route className="h-4 w-4 mr-2" />
            {isRtl ? 'الخطوط' : 'Routes'}
          </Button>
        </div>
      )}

      <div ref={mapContainer} className="w-full rounded-lg border border-border" style={{ height }} />

      {showRoutes && routes.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">{isRtl ? 'الخطوط' : 'Routes'}</h4>
          <div className="grid gap-2 max-h-48 overflow-y-auto">
            {routes.map((route, idx) => (
              <button
                key={route.id}
                className={`flex items-center gap-3 p-2 rounded-lg border transition-colors text-left ${
                  selectedRoute?.id === route.id
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => {
                  onRouteClick?.(route);
                  focusOnRoute(route);
                }}
              >
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: route.color || ROUTE_COLORS[idx % ROUTE_COLORS.length] }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{route.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {route.students.length} {isRtl ? 'طالب' : 'students'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RouteMap;
