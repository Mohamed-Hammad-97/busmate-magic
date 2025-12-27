import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import { Button } from '@/components/ui/button';
import { MapPin, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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
  const geocoder = useRef<MapboxGeocoder | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('الموقع الجغرافي غير مدعوم في متصفحك');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        marker.current?.setLngLat([longitude, latitude]);
        map.current?.flyTo({
          center: [longitude, latitude],
          zoom: 15,
        });
        onLocationChange(latitude, longitude);
        setIsLocating(false);
        toast.success('تم تحديد موقعك الحالي');
      },
      (error) => {
        setIsLocating(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error('تم رفض الوصول إلى الموقع');
            break;
          case error.POSITION_UNAVAILABLE:
            toast.error('معلومات الموقع غير متوفرة');
            break;
          case error.TIMEOUT:
            toast.error('انتهت مهلة طلب الموقع');
            break;
          default:
            toast.error('حدث خطأ أثناء تحديد الموقع');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    // Use Arabic localized style
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [initialLng, initialLat],
      zoom: 12,
    });

    // Set language to Arabic after style loads
    map.current.on('load', () => {
      const layers = map.current?.getStyle().layers;
      if (layers) {
        layers.forEach((layer) => {
          if (layer.type === 'symbol' && layer.layout?.['text-field']) {
            map.current?.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name_ar'], ['get', 'name']]);
          }
        });
      }
      setIsMapReady(true);
    });

    // Add geocoder (search bar) with Arabic support
    geocoder.current = new MapboxGeocoder({
      accessToken: mapboxToken,
      mapboxgl: mapboxgl as any,
      placeholder: 'ابحث عن موقع...',
      language: 'ar',
      countries: 'eg',
      marker: false,
    });

    map.current.addControl(geocoder.current, 'top-left');
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Handle geocoder result
    geocoder.current.on('result', (e) => {
      const [lng, lat] = e.result.center;
      marker.current?.setLngLat([lng, lat]);
      onLocationChange(lat, lng);
    });

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

    return () => {
      geocoder.current = null;
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
        انقر على الخريطة أو اسحب العلامة لتحديد موقع المدرسة
      </p>
      <div ref={mapContainer} className="w-full h-[250px] rounded-lg border border-border" />
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleGetCurrentLocation}
        disabled={isLocating}
      >
        {isLocating ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            جاري تحديد الموقع...
          </>
        ) : (
          <>
            <MapPin className="mr-2 h-4 w-4" />
            استخدام موقعي الحالي
          </>
        )}
      </Button>
    </div>
  );
};

export default LocationPickerMap;
