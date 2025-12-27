import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapboxToken } from '@/hooks/useMapboxToken';
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
  const pointMarkers = useRef<mapboxgl.Marker[]>([]);

  const [isDrawing, setIsDrawing] = useState(false);
  const [tempPoints, setTempPoints] = useState<PolygonPoint[]>([]);

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

  // Update polygon on map
  const updatePolygon = useCallback((points: PolygonPoint[], isTemp: boolean = false) => {
    if (!map.current) return;

    const sourceId = isTemp ? 'temp-polygon' : 'search-polygon';
    const fillLayerId = isTemp ? 'temp-polygon-fill' : 'search-polygon-fill';
    const outlineLayerId = isTemp ? 'temp-polygon-outline' : 'search-polygon-outline';
    const lineLayerId = isTemp ? 'temp-polygon-line' : 'search-polygon-line';

    // Remove existing layers and source
    [fillLayerId, outlineLayerId, lineLayerId].forEach(id => {
      if (map.current?.getLayer(id)) map.current.removeLayer(id);
    });
    if (map.current.getSource(sourceId)) map.current.removeSource(sourceId);

    if (points.length < 2) return;

    const coordinates = points.map(p => [p.lng, p.lat]);
    
    // Close the polygon if we have 3+ points
    if (points.length >= 3) {
      const closedCoords = [...coordinates, coordinates[0]];

      map.current.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [closedCoords],
          },
        },
      });

      map.current.addLayer({
        id: fillLayerId,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': isTemp ? '#F59E0B' : '#3B82F6',
          'fill-opacity': 0.15,
        },
      });

      map.current.addLayer({
        id: outlineLayerId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': isTemp ? '#F59E0B' : '#3B82F6',
          'line-width': 2,
          'line-dasharray': isTemp ? [3, 3] : [1, 0],
        },
      });
    } else {
      // Just draw a line between points
      map.current.addSource(sourceId, {
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
        id: lineLayerId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': isTemp ? '#F59E0B' : '#3B82F6',
          'line-width': 2,
          'line-dasharray': [3, 3],
        },
      });
    }
  }, []);

  // Update point markers
  const updatePointMarkers = useCallback((points: PolygonPoint[], isTemp: boolean = false) => {
    // Clear existing markers
    pointMarkers.current.forEach(m => m.remove());
    pointMarkers.current = [];

    if (!map.current) return;

    points.forEach((point, idx) => {
      const el = document.createElement('div');
      el.style.cssText = `
        width: 28px;
        height: 28px;
        background: ${isTemp ? '#F59E0B' : '#3B82F6'};
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 12px;
        font-weight: bold;
        cursor: pointer;
      `;
      el.innerText = (idx + 1).toString();

      const marker = new mapboxgl.Marker(el)
        .setLngLat([point.lng, point.lat])
        .addTo(map.current!);

      pointMarkers.current.push(marker);
    });
  }, []);

  // Draw saved polygon
  useEffect(() => {
    if (!map.current?.isStyleLoaded()) {
      map.current?.on('load', () => {
        if (searchArea && searchArea.points.length >= 3) {
          updatePolygon(searchArea.points, false);
          updatePointMarkers(searchArea.points, false);
        }
      });
    } else {
      if (searchArea && searchArea.points.length >= 3) {
        updatePolygon(searchArea.points, false);
        updatePointMarkers(searchArea.points, false);
      } else if (!isDrawing) {
        // Clear polygon if no search area
        const sourceId = 'search-polygon';
        ['search-polygon-fill', 'search-polygon-outline', 'search-polygon-line'].forEach(id => {
          if (map.current?.getLayer(id)) map.current.removeLayer(id);
        });
        if (map.current?.getSource(sourceId)) map.current.removeSource(sourceId);
        pointMarkers.current.forEach(m => m.remove());
        pointMarkers.current = [];
      }
    }
  }, [searchArea, isDrawing, updatePolygon, updatePointMarkers]);

  // Draw temp polygon while drawing
  useEffect(() => {
    if (!map.current?.isStyleLoaded()) return;
    
    if (isDrawing && tempPoints.length > 0) {
      updatePolygon(tempPoints, true);
      updatePointMarkers(tempPoints, true);
    } else {
      // Clear temp layers
      ['temp-polygon-fill', 'temp-polygon-outline', 'temp-polygon-line'].forEach(id => {
        if (map.current?.getLayer(id)) map.current.removeLayer(id);
      });
      if (map.current?.getSource('temp-polygon')) map.current.removeSource('temp-polygon');
    }
  }, [tempPoints, isDrawing, updatePolygon, updatePointMarkers]);

  // Handle map click for adding points
  const handleMapClick = useCallback((e: mapboxgl.MapMouseEvent) => {
    if (!isDrawing) return;
    
    const newPoint = { lat: e.lngLat.lat, lng: e.lngLat.lng };
    setTempPoints(prev => [...prev, newPoint]);
  }, [isDrawing]);

  // Add/remove click listener
  useEffect(() => {
    if (!map.current) return;

    const mapInstance = map.current;

    if (isDrawing) {
      mapInstance.getCanvas().style.cursor = 'crosshair';
      mapInstance.on('click', handleMapClick);
    } else {
      mapInstance.getCanvas().style.cursor = '';
      mapInstance.off('click', handleMapClick);
    }

    return () => {
      mapInstance.off('click', handleMapClick);
    };
  }, [isDrawing, handleMapClick]);

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

      <div ref={mapContainer} className="w-full rounded-lg border border-border" style={{ height }} />

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
