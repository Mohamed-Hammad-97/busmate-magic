import React, { useState, useCallback, useEffect } from 'react';
import { GoogleMap, Marker, InfoWindow, DirectionsRenderer } from '@react-google-maps/api';
import { useGoogleMaps } from '@/components/maps/GoogleMapsProvider';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { Users, School, Route, Loader2, ExternalLink } from 'lucide-react';

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
  const [directionsResults, setDirectionsResults] = useState<Map<string, google.maps.DirectionsResult>>(new Map());
  const [loadingRoutes, setLoadingRoutes] = useState<Set<string>>(new Set());

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

  // Calculate real directions for routes
  useEffect(() => {
    if (!isLoaded || !window.google?.maps || routes.length === 0 || !showRouteLine) return;

    const directionsService = new google.maps.DirectionsService();

    routes.forEach((route) => {
      // Skip if already loaded or loading
      if (directionsResults.has(route.id) || loadingRoutes.has(route.id)) return;

      const sortedStudents = [...route.students]
        .filter(s => s.lat && s.lng)
        .sort((a, b) => (a.pickup_order || 0) - (b.pickup_order || 0));

      if (sortedStudents.length === 0) return;

      // Build waypoints
      const waypoints: google.maps.DirectionsWaypoint[] = [];
      let origin: google.maps.LatLngLiteral | null = null;
      let destination: google.maps.LatLngLiteral | null = null;

      if (sortedStudents.length === 1 && route.school) {
        origin = { lat: sortedStudents[0].lat, lng: sortedStudents[0].lng };
        destination = { lat: route.school.latitude, lng: route.school.longitude };
      } else if (sortedStudents.length >= 2) {
        origin = { lat: sortedStudents[0].lat, lng: sortedStudents[0].lng };
        
        if (route.school) {
          destination = { lat: route.school.latitude, lng: route.school.longitude };
          // Add intermediate students as waypoints
          for (let i = 1; i < sortedStudents.length; i++) {
            waypoints.push({
              location: { lat: sortedStudents[i].lat, lng: sortedStudents[i].lng },
              stopover: true,
            });
          }
        } else {
          destination = { lat: sortedStudents[sortedStudents.length - 1].lat, lng: sortedStudents[sortedStudents.length - 1].lng };
          for (let i = 1; i < sortedStudents.length - 1; i++) {
            waypoints.push({
              location: { lat: sortedStudents[i].lat, lng: sortedStudents[i].lng },
              stopover: true,
            });
          }
        }
      }

      if (!origin || !destination) return;

      setLoadingRoutes(prev => new Set(prev).add(route.id));

      directionsService.route(
        {
          origin,
          destination,
          waypoints: waypoints.slice(0, 23), // Google limits to 25 waypoints total
          travelMode: google.maps.TravelMode.DRIVING,
          optimizeWaypoints: false, // Keep the pickup order
        },
        (result, status) => {
          setLoadingRoutes(prev => {
            const next = new Set(prev);
            next.delete(route.id);
            return next;
          });

          if (status === google.maps.DirectionsStatus.OK && result) {
            setDirectionsResults(prev => new Map(prev).set(route.id, result));
          }
        }
      );
    });
  }, [isLoaded, routes, showRouteLine, directionsResults, loadingRoutes]);

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

  // Generate Google Maps URL for a route
  const getGoogleMapsUrl = (route: RouteData): string => {
    const sortedStudents = [...route.students]
      .filter(s => s.lat && s.lng)
      .sort((a, b) => (a.pickup_order || 0) - (b.pickup_order || 0));

    if (sortedStudents.length === 0) return '';

    const origin = `${sortedStudents[0].lat},${sortedStudents[0].lng}`;
    
    let destination = '';
    if (route.school) {
      destination = `${route.school.latitude},${route.school.longitude}`;
    } else if (sortedStudents.length > 1) {
      const last = sortedStudents[sortedStudents.length - 1];
      destination = `${last.lat},${last.lng}`;
    } else {
      return `https://www.google.com/maps?q=${origin}`;
    }

    // Build waypoints (excluding first and last)
    const waypointStudents = route.school 
      ? sortedStudents.slice(1)
      : sortedStudents.slice(1, -1);
    
    const waypoints = waypointStudents
      .map(s => `${s.lat},${s.lng}`)
      .join('|');

    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
    
    if (waypoints) {
      url += `&waypoints=${encodeURIComponent(waypoints)}`;
    }

    return url;
  };

  const openInGoogleMaps = (route: RouteData) => {
    const url = getGoogleMapsUrl(route);
    if (url) {
      window.open(url, '_blank');
    }
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

          {/* Route Directions (Real Roads) */}
          {showRoutes && showRouteLine && routes.map((route, idx) => {
            const color = route.color || ROUTE_COLORS[idx % ROUTE_COLORS.length];
            const isSelected = selectedRoute?.id === route.id;
            const directions = directionsResults.get(route.id);

            if (!directions) return null;

            return (
              <DirectionsRenderer
                key={route.id}
                directions={directions}
                options={{
                  suppressMarkers: true, // We'll show our own markers
                  polylineOptions: {
                    strokeColor: color,
                    strokeWeight: isSelected ? 6 : 4,
                    strokeOpacity: isSelected ? 1 : 0.8,
                  },
                }}
              />
            );
          })}

          {/* Route Student Markers */}
          {showRoutes && routes.map((route, idx) => {
            const color = route.color || ROUTE_COLORS[idx % ROUTE_COLORS.length];
            const sortedStudents = [...route.students].sort(
              (a, b) => (a.pickup_order || 0) - (b.pickup_order || 0)
            );

            return (
              <React.Fragment key={`markers-${route.id}`}>
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
          <div className="grid gap-2 max-h-64 overflow-y-auto">
            {routes.map((route, idx) => {
              const isLoading = loadingRoutes.has(route.id);
              return (
                <div
                  key={route.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    selectedRoute?.id === route.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <button
                    className="flex items-center gap-3 flex-1 text-left"
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
                        {isLoading && <span className="ml-2">({isRtl ? 'جاري التحميل...' : 'loading route...'})</span>}
                      </p>
                    </div>
                  </button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      openInGoogleMaps(route);
                    }}
                    title={isRtl ? 'فتح في خرائط جوجل' : 'Open in Google Maps'}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default RouteMap;
