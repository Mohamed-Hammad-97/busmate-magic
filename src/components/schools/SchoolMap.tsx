import React, { useState, useCallback, useEffect } from 'react';
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';
import type { Tables } from '@/integrations/supabase/types';

type School = Tables<'schools'>;

export interface SchoolMapProps {
  schools: School[];
  onSchoolClick?: (school: School) => void;
}

const containerStyle = {
  width: '100%',
  height: '400px',
};

const defaultCenter = {
  lat: 30.0444,
  lng: 31.2357,
};

const SchoolMap: React.FC<SchoolMapProps> = ({ schools, onSchoolClick }) => {

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [activeMarker, setActiveMarker] = useState<string | null>(null);

  const onLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Fit bounds to show all schools
  useEffect(() => {
    if (!map || schools.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    schools.forEach((school) => {
      bounds.extend({ lat: school.latitude, lng: school.longitude });
    });
    map.fitBounds(bounds, 50);
  }, [map, schools]);

  return (
    <div className="w-full h-[400px] rounded-lg border border-border overflow-hidden">
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
        {schools.map((school) => (
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
            onClick={() => {
              setActiveMarker(school.id);
              onSchoolClick?.(school);
            }}
          >
            {activeMarker === school.id && (
              <InfoWindow onCloseClick={() => setActiveMarker(null)}>
                <div>
                  <strong>{school.name}</strong><br/>
                  {school.city || 'No city'}
                </div>
              </InfoWindow>
            )}
          </Marker>
        ))}
      </GoogleMap>
    </div>
  );
};

export default SchoolMap;
