import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, Marker, Polyline, Autocomplete } from "@react-google-maps/api";
import { GoogleMapsProvider, useGoogleMaps } from "@/components/maps/GoogleMapsProvider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, GripVertical, Trash2, MapPin, Save, Plus, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { computeDrivingRoute } from "@/lib/googleRoutes";
import { attachAutocompleteEnterFix } from "@/lib/placesEnterHelper";

export interface StationDraft {
  id?: string;
  name: string;
  station_type: "pickup" | "dropoff" | "both";
  station_order: number;
  latitude: number;
  longitude: number;
  is_active?: boolean;
  _tempId?: string;
}

interface Props {
  lineId: string;
  isRtl: boolean;
}

const DEFAULT_CENTER = { lat: 30.0444, lng: 31.2357 }; // Cairo
const containerStyle = { width: "100%", height: "420px" };

export default function LineMapEditor(props: Props) {
  return (
    <GoogleMapsProvider>
      <Inner {...props} />
    </GoogleMapsProvider>
  );
}

function Inner({ lineId, isRtl }: Props) {
  const { isLoaded } = useGoogleMaps();
  const { toast } = useToast();
  const [stations, setStations] = useState<StationDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingPoint, setPendingPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [pendingName, setPendingName] = useState("");
  const [pendingType, setPendingType] = useState<"pickup" | "dropoff" | "both">("both");
  const [routePath, setRoutePath] = useState<google.maps.LatLngLiteral[]>([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeSource, setRouteSource] = useState<string>("");
  const mapRef = useRef<google.maps.Map | null>(null);
  const acRef = useRef<google.maps.places.Autocomplete | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const dragIdx = useRef<number | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    return attachAutocompleteEnterFix(searchInputRef.current, (place) => {
      if (place.geometry?.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        setPendingPoint({ lat, lng });
        setPendingName(place.name || place.formatted_address || "");
        mapRef.current?.panTo({ lat, lng });
        mapRef.current?.setZoom(15);
      }
    });
  }, [isLoaded]);

  // Load existing stations
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("daily_line_stations")
        .select("*")
        .eq("line_id", lineId)
        .order("station_order");
      setStations(
        (data || []).map((s: any, i: number) => ({
          id: s.id,
          name: s.name,
          station_type: s.station_type,
          station_order: i,
          latitude: s.latitude ?? DEFAULT_CENTER.lat,
          longitude: s.longitude ?? DEFAULT_CENTER.lng,
          is_active: s.is_active,
        })),
      );
      setLoading(false);
    })();
  }, [lineId]);

  const initialCenter = useMemo(() => {
    if (stations[0]?.latitude) return { lat: stations[0].latitude, lng: stations[0].longitude };
    return DEFAULT_CENTER;
  }, [stations]);

  // Compute driving route via Google Routes API when stations change
  useEffect(() => {
    if (!isLoaded || stations.length < 2) {
      setRoutePath([]);
      setRouteError(null);
      return;
    }
    let cancelled = false;
    setRouteLoading(true);
    setRouteError(null);
    const stops = stations.map((s) => ({ lat: s.latitude, lng: s.longitude }));
    computeDrivingRoute(stops).then((res) => {
      if (cancelled) return;
      setRoutePath(res.path);
      setRouteSource(res.source);
      setRouteError(res.source === "straight_fallback" ? res.error || "No driving route available" : null);
      setRouteLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, stations]);

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    setPendingPoint({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    setPendingName("");
  }, []);

  const handlePlaceChange = useCallback(() => {
    const place = acRef.current?.getPlace();
    if (place?.geometry?.location) {
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      setPendingPoint({ lat, lng });
      setPendingName(place.name || "");
      mapRef.current?.panTo({ lat, lng });
      mapRef.current?.setZoom(15);
    }
  }, []);

  const addPending = () => {
    if (!pendingPoint || !pendingName.trim()) return;
    setStations((s) => [
      ...s,
      {
        name: pendingName.trim(),
        station_type: pendingType,
        station_order: s.length,
        latitude: pendingPoint.lat,
        longitude: pendingPoint.lng,
        _tempId: Math.random().toString(36).slice(2),
      },
    ]);
    setPendingPoint(null);
    setPendingName("");
    setPendingType("both");
  };

  const removeStation = (i: number) => {
    setStations((s) => s.filter((_, idx) => idx !== i).map((st, idx) => ({ ...st, station_order: idx })));
  };

  const updateStation = (i: number, patch: Partial<StationDraft>) => {
    setStations((s) => s.map((st, idx) => (idx === i ? { ...st, ...patch } : st)));
  };

  const onDragStart = (i: number) => (dragIdx.current = i);
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (i: number) => {
    const from = dragIdx.current;
    if (from === null || from === i) return;
    setStations((s) => {
      const copy = [...s];
      const [moved] = copy.splice(from, 1);
      copy.splice(i, 0, moved);
      return copy.map((st, idx) => ({ ...st, station_order: idx }));
    });
    dragIdx.current = null;
  };

  const save = async () => {
    setSaving(true);
    try {
      // Delete removed stations
      const { data: existing } = await supabase
        .from("daily_line_stations")
        .select("id")
        .eq("line_id", lineId);
      const keepIds = new Set(stations.filter((s) => s.id).map((s) => s.id));
      const toDelete = (existing || []).filter((e: any) => !keepIds.has(e.id)).map((e: any) => e.id);
      if (toDelete.length > 0) {
        await supabase.from("daily_line_stations").delete().in("id", toDelete);
      }
      // Upsert
      for (const s of stations) {
        const payload = {
          line_id: lineId,
          name: s.name,
          station_type: s.station_type,
          station_order: s.station_order,
          latitude: s.latitude,
          longitude: s.longitude,
          is_active: s.is_active ?? true,
        };
        if (s.id) {
          await supabase.from("daily_line_stations").update(payload).eq("id", s.id);
        } else {
          await supabase.from("daily_line_stations").insert(payload);
        }
      }
      toast({ title: isRtl ? "تم حفظ الخط" : "Line saved" });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !isLoaded) {
    return (
      <div className="flex items-center justify-center h-[420px] bg-muted rounded-lg">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-5 gap-3">
      <div className="md:col-span-3 space-y-2">
        <Autocomplete
          onLoad={(ac) => (acRef.current = ac)}
          onPlaceChanged={handlePlaceChange}
          options={{ componentRestrictions: { country: "eg" } }}
        >
          <Input ref={searchInputRef} placeholder={isRtl ? "ابحث عن مكان..." : "Search a place..."} />
        </Autocomplete>

        <div className="rounded-lg overflow-hidden border">
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={initialCenter}
            zoom={12}
            onLoad={(m) => {
              mapRef.current = m;
            }}
            onClick={handleMapClick}
            options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
          >
            {stations.map((s, i) => (
              <Marker
                key={s.id || s._tempId || i}
                position={{ lat: s.latitude, lng: s.longitude }}
                draggable
                onDragEnd={(e) => {
                  if (e.latLng) updateStation(i, { latitude: e.latLng.lat(), longitude: e.latLng.lng() });
                }}
                label={{ text: String(i + 1), color: "white", fontWeight: "bold" }}
              />
            ))}
            {pendingPoint && (
              <Marker
                position={pendingPoint}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 10,
                  fillColor: "#f97316",
                  fillOpacity: 0.9,
                  strokeColor: "white",
                  strokeWeight: 2,
                }}
              />
            )}
            {routePath.length > 0 && (
              <Polyline
                path={routePath}
                options={
                  routeSource === "straight_fallback"
                    ? {
                        strokeColor: "#94a3b8",
                        strokeWeight: 3,
                        strokeOpacity: 0,
                        icons: [
                          {
                            icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 },
                            offset: "0",
                            repeat: "12px",
                          },
                        ],
                      }
                    : { strokeColor: "#3b82f6", strokeWeight: 5, strokeOpacity: 0.9 }
                }
              />
            )}
          </GoogleMap>
        </div>

        {routeError && (
          <div className="flex items-start gap-2 p-2 border border-amber-300 bg-amber-50 dark:bg-amber-950/30 rounded text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">
                {isRtl
                  ? "تعذر رسم المسار على الطريق — يتم عرض خطوط مستقيمة"
                  : "Could not draw road route — showing straight lines"}
              </div>
              <div className="opacity-80">
                {isRtl
                  ? "فعّل Routes API (أو Directions API) في Google Cloud Console لمفتاح الخرائط الخاص بك."
                  : "Enable the Routes API (or Directions API) in Google Cloud Console for your Maps key."}
              </div>
            </div>
          </div>
        )}

        {pendingPoint && (
          <div className="grid grid-cols-12 gap-2 p-3 border rounded-lg bg-muted/30">
            <Input
              className="col-span-5"
              placeholder={isRtl ? "اسم المحطة" : "Station name"}
              value={pendingName}
              onChange={(e) => setPendingName(e.target.value)}
              autoFocus
            />
            <Select value={pendingType} onValueChange={(v: any) => setPendingType(v)}>
              <SelectTrigger className="col-span-4">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="both">{isRtl ? "ركوب/نزول" : "Both"}</SelectItem>
                <SelectItem value="pickup">{isRtl ? "ركوب فقط" : "Pickup"}</SelectItem>
                <SelectItem value="dropoff">{isRtl ? "نزول فقط" : "Dropoff"}</SelectItem>
              </SelectContent>
            </Select>
            <Button className="col-span-2" onClick={addPending} disabled={!pendingName.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              className="col-span-1"
              variant="ghost"
              onClick={() => {
                setPendingPoint(null);
                setPendingName("");
              }}
            >
              ×
            </Button>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {isRtl
            ? "انقر على الخريطة أو ابحث عن مكان لإضافة محطة. اسحب علامة لتعديل الموقع."
            : "Click the map or search for a place to add a station. Drag a marker to adjust."}
          {routeLoading && (
            <span className="ml-2 inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> {isRtl ? "حساب المسار..." : "Routing..."}
            </span>
          )}
        </p>
      </div>

      <div className="md:col-span-2 space-y-2 max-h-[520px] overflow-auto pr-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs">
            {isRtl ? "المحطات (اسحب للترتيب)" : "Stations (drag to reorder)"}
          </Label>
          <Badge variant="outline">{stations.length}</Badge>
        </div>
        {stations.length === 0 && (
          <div className="text-center text-muted-foreground text-sm p-6 border rounded-lg border-dashed">
            <MapPin className="h-6 w-6 mx-auto mb-2 opacity-50" />
            {isRtl ? "لا توجد محطات" : "No stations yet"}
          </div>
        )}
        {stations.map((s, i) => (
          <div
            key={s.id || s._tempId || i}
            draggable
            onDragStart={() => onDragStart(i)}
            onDragOver={onDragOver}
            onDrop={() => onDrop(i)}
            className="flex items-center gap-2 p-2 border rounded-lg bg-background hover:bg-muted/30 cursor-move"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <Input
                value={s.name}
                onChange={(e) => updateStation(i, { name: e.target.value })}
                className="h-7 text-sm"
              />
              <div className="flex items-center gap-1 mt-1">
                <Select
                  value={s.station_type}
                  onValueChange={(v: any) => updateStation(i, { station_type: v })}
                >
                  <SelectTrigger className="h-6 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">{isRtl ? "ركوب/نزول" : "Both"}</SelectItem>
                    <SelectItem value="pickup">{isRtl ? "ركوب" : "Pickup"}</SelectItem>
                    <SelectItem value="dropoff">{isRtl ? "نزول" : "Dropoff"}</SelectItem>
                  </SelectContent>
                </Select>
                {i === 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    {isRtl ? "البداية" : "Start"}
                  </Badge>
                )}
                {i === stations.length - 1 && stations.length > 1 && (
                  <Badge variant="secondary" className="text-[10px]">
                    {isRtl ? "النهاية" : "End"}
                  </Badge>
                )}
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => removeStation(i)}>
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        ))}

        <Button className="w-full mt-3" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
          {isRtl ? "حفظ الخط" : "Save Line"}
        </Button>
      </div>
    </div>
  );
}
