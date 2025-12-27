import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface LocationPickerMapProps {
  initialLat?: number;
  initialLng?: number;
  onLocationChange: (lat: number, lng: number) => void;
  mapboxToken: string;
}

const LocationPickerMap: React.FC<LocationPickerMapProps> = ({
  initialLat = 30.0444,
  initialLng = 31.2357,
  onLocationChange,
  mapboxToken,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [initialLng, initialLat],
      zoom: 12,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Add draggable marker
    marker.current = new mapboxgl.Marker({
      draggable: true,
      color: 'hsl(var(--primary))',
    })
      .setLngLat([initialLng, initialLat])
      .addTo(map.current);

    marker.current.on('dragend', () => {
      const lngLat = marker.current?.getLngLat();
      if (lngLat) {
        onLocationChange(lngLat.lat, lngLat.lng);
      }
    });

    // Click on map to move marker
    map.current.on('click', (e) => {
      marker.current?.setLngLat(e.lngLat);
      onLocationChange(e.lngLat.lat, e.lngLat.lng);
    });

    map.current.on('load', () => {
      setIsMapReady(true);
    });

    return () => {
      map.current?.remove();
    };
  }, [mapboxToken]);

  // Update marker position when initial values change
  useEffect(() => {
    if (isMapReady && marker.current && map.current) {
      marker.current.setLngLat([initialLng, initialLat]);
      map.current.flyTo({
        center: [initialLng, initialLat],
        zoom: 12,
      });
    }
  }, [initialLat, initialLng, isMapReady]);

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Click on the map or drag the marker to set the school location
      </p>
      <div ref={mapContainer} className="w-full h-[250px] rounded-lg border border-border" />
    </div>
  );
};

export default LocationPickerMap;
