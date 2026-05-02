import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleMap, Marker, Autocomplete } from '@react-google-maps/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useGoogleMaps } from '@/components/maps/GoogleMapsProvider';
import { attachAutocompleteEnterFix } from '@/lib/placesEnterHelper';

export interface LocationPickerMapProps {
  initialLat?: number;
  initialLng?: number;
  onLocationChange: (lat: number, lng: number) => void;
}

const containerStyle = {
  width: '100%',
  height: '250px',
};

const LocationPickerMap: React.FC<LocationPickerMapProps> = ({
  initialLat = 30.0444,
  initialLng = 31.2357,
  onLocationChange,
}) => {
  const { isLoaded } = useGoogleMaps();
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markerPosition, setMarkerPosition] = useState({ lat: initialLat, lng: initialLng });
  const [isLocating, setIsLocating] = useState(false);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    return attachAutocompleteEnterFix(searchInputRef.current, (place) => {
      if (place.geometry?.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        setMarkerPosition({ lat, lng });
        onLocationChange(lat, lng);
        map?.panTo({ lat, lng });
        map?.setZoom(15);
      }
    });
  }, [isLoaded, map, onLocationChange]);

  const onLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setMarkerPosition({ lat, lng });
      onLocationChange(lat, lng);
    }
  }, [onLocationChange]);

  const handleMarkerDragEnd = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setMarkerPosition({ lat, lng });
      onLocationChange(lat, lng);
    }
  }, [onLocationChange]);

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('الموقع الجغرافي غير مدعوم في متصفحك');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setMarkerPosition({ lat: latitude, lng: longitude });
        onLocationChange(latitude, longitude);
        map?.panTo({ lat: latitude, lng: longitude });
        map?.setZoom(15);
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

  const onAutocompleteLoad = useCallback((autocomplete: google.maps.places.Autocomplete) => {
    autocompleteRef.current = autocomplete;
  }, []);

  const onPlaceChanged = useCallback(() => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      if (place.geometry?.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        setMarkerPosition({ lat, lng });
        onLocationChange(lat, lng);
        map?.panTo({ lat, lng });
        map?.setZoom(15);
      }
    }
  }, [map, onLocationChange]);

  // Update marker position when initial values change
  React.useEffect(() => {
    setMarkerPosition({ lat: initialLat, lng: initialLng });
    map?.panTo({ lat: initialLat, lng: initialLng });
  }, [initialLat, initialLng, map]);

  if (!isLoaded) {
    return (
      <div className="space-y-2">
        <div className="w-full h-[250px] rounded-lg border border-border overflow-hidden flex items-center justify-center bg-muted">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        انقر على الخريطة أو اسحب العلامة لتحديد موقع المدرسة
      </p>
      
      <Autocomplete
        onLoad={onAutocompleteLoad}
        onPlaceChanged={onPlaceChanged}
        options={{
          componentRestrictions: { country: 'eg' },
        }}
      >
        <Input
          ref={searchInputRef}
          type="text"
          placeholder="ابحث عن موقع..."
          className="w-full mb-2"
        />
      </Autocomplete>

      <div className="w-full h-[250px] rounded-lg border border-border overflow-hidden">
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={markerPosition}
          zoom={12}
          onLoad={onLoad}
          onUnmount={onUnmount}
          onClick={handleMapClick}
          options={{
            disableDefaultUI: false,
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
          }}
        >
          <Marker
            position={markerPosition}
            draggable={true}
            onDragEnd={handleMarkerDragEnd}
          />
        </GoogleMap>
      </div>

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
