import React, { useState, useMemo, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { School, MapPin, Users, Loader2 } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';
import { useGoogleMapsToken } from '@/hooks/useGoogleMapsToken';

type Registration = Tables<'registrations'> & {
  parent_accounts: Tables<'parent_accounts'>;
  schools: Tables<'schools'>;
};

interface RegistrationsMapProps {
  registrations: Registration[];
}

const containerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = {
  lat: 30.0444,
  lng: 31.2357,
};

const RegistrationsMap: React.FC<RegistrationsMapProps> = ({ registrations }) => {
  const { token, isLoading: tokenLoading, error: tokenError } = useGoogleMapsToken();
  
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: token || '',
    language: 'ar',
    region: 'EG',
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedSchool, setSelectedSchool] = useState<string | null>(null);
  const [showAllStudents, setShowAllStudents] = useState(false);
  const [activeMarker, setActiveMarker] = useState<string | null>(null);

  // Get unique schools from registrations
  const schools = useMemo(() => {
    const schoolMap: Record<string, Tables<'schools'>> = {};
    registrations.forEach((reg) => {
      if (reg.schools && !schoolMap[reg.schools.id]) {
        schoolMap[reg.schools.id] = reg.schools;
      }
    });
    return Object.values(schoolMap);
  }, [registrations]);

  // Get registrations for selected school
  const filteredRegistrations = useMemo(() => {
    if (showAllStudents) return registrations;
    if (!selectedSchool) return [];
    return registrations.filter((reg) => reg.school_id === selectedSchool);
  }, [registrations, selectedSchool, showAllStudents]);

  const onLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Fit bounds when filteredRegistrations change
  React.useEffect(() => {
    if (!map || filteredRegistrations.length === 0 && !selectedSchool) return;

    const bounds = new google.maps.LatLngBounds();
    
    if (selectedSchool) {
      const school = schools.find((s) => s.id === selectedSchool);
      if (school) {
        bounds.extend({ lat: school.latitude, lng: school.longitude });
      }
    }

    filteredRegistrations.forEach((reg) => {
      if (reg.parent_accounts) {
        bounds.extend({
          lat: reg.parent_accounts.pickup_latitude,
          lng: reg.parent_accounts.pickup_longitude,
        });
      }
    });

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, 50);
    }
  }, [map, filteredRegistrations, selectedSchool, schools]);

  const handleSchoolClick = (schoolId: string) => {
    setShowAllStudents(false);
    setSelectedSchool(schoolId === selectedSchool ? null : schoolId);
    setActiveMarker(null);
  };

  const handleShowAll = () => {
    setSelectedSchool(null);
    setShowAllStudents(true);
    setActiveMarker(null);
  };

  if (tokenLoading) {
    return (
      <div className="h-[500px] flex items-center justify-center bg-muted rounded-lg">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tokenError || !token || loadError) {
    return (
      <div className="h-[500px] flex items-center justify-center bg-muted rounded-lg">
        <p className="text-muted-foreground">Google Maps API key not configured</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="h-[500px] flex items-center justify-center bg-muted rounded-lg">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-[500px]">
      {/* Schools Sidebar */}
      <div className="w-64 border border-border rounded-lg bg-card flex flex-col">
        <div className="p-3 border-b border-border">
          <h3 className="font-semibold flex items-center gap-2">
            <School className="h-4 w-4" />
            Schools
          </h3>
        </div>
        <div className="p-2 border-b border-border">
          <Button
            variant={showAllStudents ? 'default' : 'outline'}
            size="sm"
            className="w-full"
            onClick={handleShowAll}
          >
            <Users className="h-4 w-4 mr-2" />
            Show All Students ({registrations.length})
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {schools.map((school) => {
              const count = registrations.filter((r) => r.school_id === school.id).length;
              return (
                <Button
                  key={school.id}
                  variant={selectedSchool === school.id ? 'default' : 'ghost'}
                  size="sm"
                  className="w-full justify-start text-left h-auto py-2"
                  onClick={() => handleSchoolClick(school.id)}
                >
                  <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{school.name}</div>
                    <div className="text-xs text-muted-foreground">{count} students</div>
                  </div>
                </Button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <div className="w-full h-full rounded-lg border border-border overflow-hidden">
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
            {/* School Marker */}
            {selectedSchool && schools.find((s) => s.id === selectedSchool) && (
              <Marker
                position={{
                  lat: schools.find((s) => s.id === selectedSchool)!.latitude,
                  lng: schools.find((s) => s.id === selectedSchool)!.longitude,
                }}
                icon={{
                  url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
                      <circle cx="20" cy="20" r="18" fill="#3B82F6" stroke="white" stroke-width="3"/>
                      <path d="M10 16l10-6 10 6M12 20v8h16v-8M18 28v-4h4v4" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  `),
                  scaledSize: new google.maps.Size(40, 40),
                }}
                onClick={() => setActiveMarker(`school-${selectedSchool}`)}
              >
                {activeMarker === `school-${selectedSchool}` && (
                  <InfoWindow onCloseClick={() => setActiveMarker(null)}>
                    <div className="font-semibold">
                      {schools.find((s) => s.id === selectedSchool)?.name}
                    </div>
                  </InfoWindow>
                )}
              </Marker>
            )}

            {/* Student Markers */}
            {filteredRegistrations.map((reg) => {
              if (!reg.parent_accounts) return null;
              return (
                <Marker
                  key={reg.id}
                  position={{
                    lat: reg.parent_accounts.pickup_latitude,
                    lng: reg.parent_accounts.pickup_longitude,
                  }}
                  icon={{
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                      <svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48">
                        <path d="M18 0C8 0 0 8 0 18c0 14 18 30 18 30s18-16 18-30c0-10-8-18-18-18z" fill="#EF4444"/>
                        <circle cx="18" cy="16" r="10" fill="white"/>
                        <circle cx="14" cy="14" r="2" fill="#EF4444"/>
                        <circle cx="22" cy="14" r="2" fill="#EF4444"/>
                        <path d="M12 20c2 3 8 3 12 0" fill="none" stroke="#EF4444" stroke-width="2" stroke-linecap="round"/>
                      </svg>
                    `),
                    scaledSize: new google.maps.Size(36, 48),
                    anchor: new google.maps.Point(18, 48),
                  }}
                  onClick={() => setActiveMarker(reg.id)}
                >
                  {activeMarker === reg.id && (
                    <InfoWindow onCloseClick={() => setActiveMarker(null)}>
                      <div className="min-w-[150px]">
                        <strong>{reg.student_name || 'Student'}</strong><br/>
                        <span className="text-gray-600">Parent: {reg.parent_accounts.parent_name}</span><br/>
                        <span className="text-gray-600">School: {reg.schools?.name || 'N/A'}</span>
                      </div>
                    </InfoWindow>
                  )}
                </Marker>
              );
            })}
          </GoogleMap>
        </div>
        {(selectedSchool || showAllStudents) && (
          <div className="absolute top-2 left-2 bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-md border border-border text-sm">
            {showAllStudents 
              ? `Showing all ${filteredRegistrations.length} students`
              : `${filteredRegistrations.length} students for ${schools.find(s => s.id === selectedSchool)?.name}`
            }
          </div>
        )}
      </div>
    </div>
  );
};

export default RegistrationsMap;
