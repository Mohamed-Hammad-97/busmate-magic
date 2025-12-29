import React, { useState, useCallback, useEffect } from 'react';
import { GoogleMap, Marker, InfoWindow, Polyline } from '@react-google-maps/api';
import { useGoogleMaps } from '@/components/maps/GoogleMapsProvider';
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

const defaultCenter = {
  lat: 30.0444,
  lng: 31.2357,
};

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
  const { isLoaded } = useGoogleMaps();

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [showStudents, setShowStudents] = useState(true);
  const [showSchools, setShowSchools] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [activeMarker, setActiveMarker] = useState<string | null>(null);

  const containerStyle = {
    width: '100%',
    height,
  };

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
    let hasPoints = false;

    if (showStudents) {
      students.forEach((student) => {
        if (student.lat && student.lng) {
          bounds.extend({ lat: student.lat, lng: student.lng });
          hasPoints = true;
        }
      });
    }

    if (showSchools) {
      schools.forEach((school) => {
        bounds.extend({ lat: school.latitude, lng: school.longitude });
        hasPoints = true;
      });
    }

    if (showRoutes) {
      routes.forEach((route) => {
        route.students.forEach((student) => {
          if (student.lat && student.lng) {
            bounds.extend({ lat: student.lat, lng: student.lng });
            hasPoints = true;
          }
        });
        if (route.school) {
          bounds.extend({ lat: route.school.latitude, lng: route.school.longitude });
          hasPoints = true;
        }
      });
    }

    if (hasPoints) {
      map.fitBounds(bounds, 50);
    }
  }, [map, students, schools, routes, showStudents, showSchools, showRoutes, isLoaded]);

  const focusOnRoute = (route: RouteData) => {
    if (!map || !window.google?.maps) return;

    const bounds = new google.maps.LatLngBounds();
    route.students.forEach((s) => {
      if (s.lat && s.lng) bounds.extend({ lat: s.lat, lng: s.lng });
    });
    if (route.school) {
      bounds.extend({ lat: route.school.latitude, lng: route.school.longitude });
    }

    map.fitBounds(bounds, 50);
  };

  if (!isLoaded) {
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

      <div className="w-full rounded-lg border border-border overflow-hidden" style={{ height }}>
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
          {/* Standalone Student Markers */}
          {showStudents && students.map((student) => {
            if (!student.lat || !student.lng) return null;
            if (!window.google?.maps) return null;
            return (
              <Marker
                key={student.id}
                position={{ lat: student.lat, lng: student.lng }}
                label={{
                  text: student.pickup_order?.toString() || '•',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '10px',
                }}
                icon={{
                  url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" fill="#3B82F6" stroke="white" stroke-width="2"/>
                    </svg>
                  `),
                  scaledSize: new google.maps.Size(24, 24),
                  labelOrigin: new google.maps.Point(12, 12),
                }}
                onClick={() => setActiveMarker(student.id)}
              >
                {activeMarker === student.id && (
                  <InfoWindow onCloseClick={() => setActiveMarker(null)}>
                    <strong>{student.student_name || student.parent_name}</strong>
                  </InfoWindow>
                )}
              </Marker>
            );
          })}

          {/* School Markers */}
          {showSchools && schools.map((school) => {
            if (!window.google?.maps) return null;
            return (
              <Marker
                key={school.id}
                position={{ lat: school.latitude, lng: school.longitude }}
                icon={{
                  url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
                      <circle cx="16" cy="16" r="14" fill="#3B82F6" stroke="white" stroke-width="3"/>
                      <path d="M8 14l8-5 8 5M10 17v6h12v-6M14 23v-3h4v3" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  `),
                  scaledSize: new google.maps.Size(32, 32),
                }}
                onClick={() => setActiveMarker(`school-${school.id}`)}
              >
                {activeMarker === `school-${school.id}` && (
                  <InfoWindow onCloseClick={() => setActiveMarker(null)}>
                    <strong>{school.name}</strong>
                  </InfoWindow>
                )}
              </Marker>
            );
          })}

          {/* Route Lines and Markers */}
          {showRoutes && showRouteLine && routes.map((route, idx) => {
            const color = route.color || ROUTE_COLORS[idx % ROUTE_COLORS.length];
            const isSelected = selectedRoute?.id === route.id;

            // Sort students by pickup_order
            const sortedStudents = [...route.students].sort(
              (a, b) => (a.pickup_order || 0) - (b.pickup_order || 0)
            );

            // Create path coordinates
            const path: { lat: number; lng: number }[] = [];
            sortedStudents.forEach((student) => {
              if (student.lat && student.lng) {
                path.push({ lat: student.lat, lng: student.lng });
              }
            });
            if (route.school) {
              path.push({ lat: route.school.latitude, lng: route.school.longitude });
            }

            return (
              <React.Fragment key={route.id}>
                {/* Route Line */}
                {path.length >= 2 && (
                  <Polyline
                    path={path}
                    options={{
                      strokeColor: color,
                      strokeWeight: isSelected ? 5 : 3,
                      strokeOpacity: isSelected ? 1 : 0.7,
                    }}
                  />
                )}

                {/* Route Student Markers */}
                {sortedStudents.map((student) => {
                  if (!student.lat || !student.lng) return null;
                  if (!window.google?.maps) return null;
                  return (
                    <Marker
                      key={`route-${route.id}-${student.id}`}
                      position={{ lat: student.lat, lng: student.lng }}
                      label={{
                        text: student.pickup_order?.toString() || '•',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '10px',
                      }}
                      icon={{
                        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10" fill="${color}" stroke="white" stroke-width="2"/>
                          </svg>
                        `),
                        scaledSize: new google.maps.Size(24, 24),
                        labelOrigin: new google.maps.Point(12, 12),
                      }}
                      onClick={() => onRouteClick?.(route)}
                    />
                  );
                })}
              </React.Fragment>
            );
          })}
        </GoogleMap>
      </div>

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
