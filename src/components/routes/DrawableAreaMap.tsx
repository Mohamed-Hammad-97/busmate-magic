import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Polygon, Polyline } from '@react-google-maps/api';
import { useGoogleMapsToken } from '@/hooks/useGoogleMapsToken';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { MapPin, Trash2, Loader2, Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface PolygonPoint {
  lat: number;
  lng: number;
}

interface SearchArea {
  points: PolygonPoint[];
}

interface SchoolLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface DrawableAreaMapProps {
  school?: SchoolLocation | null;
  onAreaChange: (area: SearchArea | null) => void;
  searchArea: SearchArea | null;
  height?: string;
}

const libraries: ("drawing" | "geometry")[] = ["drawing", "geometry"];

const DrawableAreaMap: React.FC<DrawableAreaMapProps> = ({
  school,
  onAreaChange,
  searchArea,
  height = '300px',
}) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { token, isLoading: tokenLoading } = useGoogleMapsToken();

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: token || '',
    libraries,
    language: 'ar',
    region: 'EG',
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tempPoints, setTempPoints] = useState<PolygonPoint[]>([]);

  const containerStyle = {
    width: '100%',
    height,
  };

  const defaultCenter = school 
    ? { lat: school.latitude, lng: school.longitude }
    : { lat: 30.0444, lng: 31.2357 };

  const onLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Handle map click for adding points
  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (!isDrawing || !e.latLng) return;
    
    const newPoint = { lat: e.latLng.lat(), lng: e.latLng.lng() };
    setTempPoints(prev => [...prev, newPoint]);
  }, [isDrawing]);

  // Center on school when it changes
  useEffect(() => {
    if (map && school) {
      map.panTo({ lat: school.latitude, lng: school.longitude });
      map.setZoom(12);
    }
  }, [map, school]);

  const startDrawing = () => {
    setIsDrawing(true);
    setTempPoints([]);
    onAreaChange(null);
  };

  const confirmPolygon = () => {
    if (tempPoints.length >= 3) {
      onAreaChange({ points: tempPoints });
    }
    setIsDrawing(false);
    setTempPoints([]);
  };

  const cancelDrawing = () => {
    setIsDrawing(false);
    setTempPoints([]);
  };

  const undoLastPoint = () => {
    setTempPoints(prev => prev.slice(0, -1));
  };

  const clearArea = () => {
    onAreaChange(null);
    setTempPoints([]);
    setIsDrawing(false);
  };

  if (tokenLoading) {
    return (
      <div className="flex items-center justify-center bg-muted rounded-lg" style={{ height }}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError || !token) {
    return (
      <div className="flex items-center justify-center bg-muted rounded-lg" style={{ height }}>
        <p className="text-muted-foreground">Google Maps API key not configured</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center bg-muted rounded-lg" style={{ height }}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const polygonOptions = {
    fillColor: '#3B82F6',
    fillOpacity: 0.15,
    strokeColor: '#3B82F6',
    strokeWeight: 2,
    clickable: false,
  };

  const tempPolygonOptions = {
    fillColor: '#F59E0B',
    fillOpacity: 0.15,
    strokeColor: '#F59E0B',
    strokeWeight: 2,
    strokeDasharray: [3, 3],
    clickable: false,
  };

  const polylineOptions = {
    strokeColor: '#F59E0B',
    strokeWeight: 2,
    strokeDasharray: [3, 3],
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {!isDrawing ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={startDrawing}
            >
              <MapPin className="h-4 w-4 mr-2" />
              {isRtl ? 'رسم منطقة البحث' : 'Draw Search Area'}
            </Button>
            {searchArea && (
              <Button variant="outline" size="sm" onClick={clearArea}>
                <Trash2 className="h-4 w-4 mr-2" />
                {isRtl ? 'مسح المنطقة' : 'Clear Area'}
              </Button>
            )}
          </>
        ) : (
          <>
            <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
              <MapPin className="h-3 w-3 mr-1" />
              {tempPoints.length} {isRtl ? 'نقاط' : 'points'}
            </Badge>
            <Button
              variant="default"
              size="sm"
              onClick={confirmPolygon}
              disabled={tempPoints.length < 3}
              className="bg-green-600 hover:bg-green-700"
            >
              <Check className="h-4 w-4 mr-2" />
              {isRtl ? 'تأكيد المنطقة' : 'Confirm Area'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={undoLastPoint}
              disabled={tempPoints.length === 0}
            >
              {isRtl ? 'تراجع' : 'Undo'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={cancelDrawing}
            >
              <X className="h-4 w-4 mr-2" />
              {isRtl ? 'إلغاء' : 'Cancel'}
            </Button>
          </>
        )}
      </div>

      {searchArea && searchArea.points.length >= 3 && (
        <div className="text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/30 p-2 rounded-lg border border-blue-200 dark:border-blue-800">
          {isRtl
            ? `منطقة البحث: ${searchArea.points.length} نقاط`
            : `Search area: ${searchArea.points.length} point polygon`}
        </div>
      )}

      <div className="w-full rounded-lg border border-border overflow-hidden" style={{ height }}>
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={defaultCenter}
          zoom={school ? 12 : 10}
          onLoad={onLoad}
          onUnmount={onUnmount}
          onClick={handleMapClick}
          options={{
            disableDefaultUI: false,
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
            draggableCursor: isDrawing ? 'crosshair' : undefined,
          }}
        >
          {/* School Marker */}
          {school && (
            <Marker
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
            />
          )}

          {/* Saved Polygon */}
          {searchArea && searchArea.points.length >= 3 && !isDrawing && (
            <Polygon
              paths={searchArea.points}
              options={polygonOptions}
            />
          )}

          {/* Temp Polygon while drawing */}
          {isDrawing && tempPoints.length >= 3 && (
            <Polygon
              paths={tempPoints}
              options={tempPolygonOptions}
            />
          )}

          {/* Temp Polyline for 2 points */}
          {isDrawing && tempPoints.length >= 2 && tempPoints.length < 3 && (
            <Polyline
              path={tempPoints}
              options={polylineOptions}
            />
          )}

          {/* Point Markers while drawing */}
          {isDrawing && tempPoints.map((point, idx) => (
            <Marker
              key={idx}
              position={point}
              label={{
                text: (idx + 1).toString(),
                color: 'white',
                fontWeight: 'bold',
                fontSize: '12px',
              }}
              icon={{
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
                    <circle cx="14" cy="14" r="12" fill="#F59E0B" stroke="white" stroke-width="3"/>
                  </svg>
                `),
                scaledSize: new google.maps.Size(28, 28),
                labelOrigin: new google.maps.Point(14, 14),
              }}
            />
          ))}

          {/* Saved polygon point markers */}
          {!isDrawing && searchArea && searchArea.points.map((point, idx) => (
            <Marker
              key={idx}
              position={point}
              label={{
                text: (idx + 1).toString(),
                color: 'white',
                fontWeight: 'bold',
                fontSize: '12px',
              }}
              icon={{
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
                    <circle cx="14" cy="14" r="12" fill="#3B82F6" stroke="white" stroke-width="3"/>
                  </svg>
                `),
                scaledSize: new google.maps.Size(28, 28),
                labelOrigin: new google.maps.Point(14, 14),
              }}
            />
          ))}
        </GoogleMap>
      </div>

      {isDrawing && (
        <div className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-lg border border-amber-200 dark:border-amber-800 text-center">
          {isRtl
            ? 'انقر على الخريطة لإضافة نقاط. تحتاج 3 نقاط على الأقل لتكوين المنطقة.'
            : 'Click on the map to add points. You need at least 3 points to form an area.'}
        </div>
      )}
    </div>
  );
};

export default DrawableAreaMap;
