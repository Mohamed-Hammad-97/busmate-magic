import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { Circle, Trash2, Loader2, MousePointer2 } from 'lucide-react';

interface SearchArea {
  center: { lat: number; lng: number };
  radiusKm: number;
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

// Generate circle coordinates
function generateCircleCoordinates(
  centerLng: number,
  centerLat: number,
  radiusKm: number,
  points: number = 64
): [number, number][] {
  const coords: [number, number][] = [];
  const earthRadius = 6371; // km

  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const latOffset = (radiusKm / earthRadius) * (180 / Math.PI);
    const lngOffset = latOffset / Math.cos((centerLat * Math.PI) / 180);

    coords.push([
      centerLng + lngOffset * Math.cos(angle),
      centerLat + latOffset * Math.sin(angle),
    ]);
  }

  return coords;
}

const DrawableAreaMap: React.FC<DrawableAreaMapProps> = ({
  school,
  onAreaChange,
  searchArea,
  height = '300px',
}) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { token, isLoading: tokenLoading } = useMapboxToken();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const schoolMarker = useRef<mapboxgl.Marker | null>(null);
  const centerMarker = useRef<mapboxgl.Marker | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ lng: number; lat: number } | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !token) return;

    mapboxgl.accessToken = token;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: school ? [school.longitude, school.latitude] : [31.2357, 30.0444],
      zoom: school ? 12 : 10,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    return () => {
      map.current?.remove();
    };
  }, [token]);

  // Update school marker
  useEffect(() => {
    if (!map.current || !school) return;

    if (schoolMarker.current) {
      schoolMarker.current.remove();
    }

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

    schoolMarker.current = new mapboxgl.Marker(el)
      .setLngLat([school.longitude, school.latitude])
      .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`<strong>${school.name}</strong>`))
      .addTo(map.current);

    map.current.flyTo({
      center: [school.longitude, school.latitude],
      zoom: 12,
      duration: 1000,
    });
  }, [school]);

  // Update circle on map
  useEffect(() => {
    if (!map.current) return;

    const sourceId = 'search-area';
    const layerId = 'search-area-fill';
    const outlineId = 'search-area-outline';

    const updateCircle = () => {
      if (!map.current?.isStyleLoaded()) return;

      // Remove existing layers and source
      if (map.current.getLayer(outlineId)) map.current.removeLayer(outlineId);
      if (map.current.getLayer(layerId)) map.current.removeLayer(layerId);
      if (map.current.getSource(sourceId)) map.current.removeSource(sourceId);

      if (!searchArea) return;

      const coordinates = generateCircleCoordinates(
        searchArea.center.lng,
        searchArea.center.lat,
        searchArea.radiusKm
      );

      map.current.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [coordinates],
          },
        },
      });

      map.current.addLayer({
        id: layerId,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': '#3B82F6',
          'fill-opacity': 0.15,
        },
      });

      map.current.addLayer({
        id: outlineId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': '#3B82F6',
          'line-width': 2,
          'line-dasharray': [2, 2],
        },
      });

      // Update center marker
      if (centerMarker.current) centerMarker.current.remove();

      const centerEl = document.createElement('div');
      centerEl.style.cssText = `
        width: 16px;
        height: 16px;
        background: #3B82F6;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      `;

      centerMarker.current = new mapboxgl.Marker(centerEl)
        .setLngLat([searchArea.center.lng, searchArea.center.lat])
        .addTo(map.current);
    };

    if (map.current.isStyleLoaded()) {
      updateCircle();
    } else {
      map.current.on('load', updateCircle);
    }

    return () => {
      if (centerMarker.current) {
        centerMarker.current.remove();
        centerMarker.current = null;
      }
    };
  }, [searchArea]);

  // Handle drawing
  const handleMouseDown = useCallback(
    (e: mapboxgl.MapMouseEvent) => {
      if (!isDrawing) return;
      setDrawStart({ lng: e.lngLat.lng, lat: e.lngLat.lat });
    },
    [isDrawing]
  );

  const handleMouseUp = useCallback(
    (e: mapboxgl.MapMouseEvent) => {
      if (!isDrawing || !drawStart) return;

      const endLng = e.lngLat.lng;
      const endLat = e.lngLat.lat;

      // Calculate radius using Haversine
      const R = 6371;
      const dLat = ((endLat - drawStart.lat) * Math.PI) / 180;
      const dLon = ((endLng - drawStart.lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((drawStart.lat * Math.PI) / 180) *
          Math.cos((endLat * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const radiusKm = Math.max(0.5, R * c);

      onAreaChange({
        center: { lat: drawStart.lat, lng: drawStart.lng },
        radiusKm: Math.round(radiusKm * 10) / 10,
      });

      setDrawStart(null);
      setIsDrawing(false);
    },
    [isDrawing, drawStart, onAreaChange]
  );

  // Add/remove drawing event listeners
  useEffect(() => {
    if (!map.current) return;

    const mapInstance = map.current;

    if (isDrawing) {
      mapInstance.getCanvas().style.cursor = 'crosshair';
      mapInstance.on('mousedown', handleMouseDown);
      mapInstance.on('mouseup', handleMouseUp);
    } else {
      mapInstance.getCanvas().style.cursor = '';
      mapInstance.off('mousedown', handleMouseDown);
      mapInstance.off('mouseup', handleMouseUp);
    }

    return () => {
      mapInstance.off('mousedown', handleMouseDown);
      mapInstance.off('mouseup', handleMouseUp);
    };
  }, [isDrawing, handleMouseDown, handleMouseUp]);

  const clearArea = () => {
    onAreaChange(null);
    if (centerMarker.current) {
      centerMarker.current.remove();
      centerMarker.current = null;
    }
  };

  if (tokenLoading) {
    return (
      <div className="flex items-center justify-center bg-muted rounded-lg" style={{ height }}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          variant={isDrawing ? 'default' : 'outline'}
          size="sm"
          onClick={() => setIsDrawing(!isDrawing)}
        >
          {isDrawing ? (
            <>
              <MousePointer2 className="h-4 w-4 mr-2" />
              {isRtl ? 'انقر واسحب لرسم الدائرة' : 'Click & drag to draw circle'}
            </>
          ) : (
            <>
              <Circle className="h-4 w-4 mr-2" />
              {isRtl ? 'رسم منطقة البحث' : 'Draw Search Area'}
            </>
          )}
        </Button>
        {searchArea && (
          <Button variant="outline" size="sm" onClick={clearArea}>
            <Trash2 className="h-4 w-4 mr-2" />
            {isRtl ? 'مسح المنطقة' : 'Clear Area'}
          </Button>
        )}
      </div>

      {searchArea && (
        <div className="text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/30 p-2 rounded-lg border border-blue-200 dark:border-blue-800">
          {isRtl
            ? `منطقة البحث: نصف قطر ${searchArea.radiusKm} كم`
            : `Search area: ${searchArea.radiusKm} km radius`}
        </div>
      )}

      <div ref={mapContainer} className="w-full rounded-lg border border-border" style={{ height }} />

      {isDrawing && (
        <p className="text-sm text-muted-foreground text-center">
          {isRtl
            ? 'انقر على الخريطة لتحديد مركز الدائرة، ثم اسحب لتحديد نصف القطر'
            : 'Click on map to set circle center, then drag to set radius'}
        </p>
      )}
    </div>
  );
};

export default DrawableAreaMap;
