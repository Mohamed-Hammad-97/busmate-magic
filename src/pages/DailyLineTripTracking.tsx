import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParentAuth } from "@/contexts/ParentAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Bus, Phone, Loader2, Navigation, Car, MapPin, Clock,
  Calendar, User, CheckCircle2, AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import LineRoutePreviewMap from "@/components/daily-lines/LineRoutePreviewMap";

export default function DailyLineTripTracking() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const navigate = useNavigate();
  const { bookingId } = useParams<{ bookingId: string }>();
  const { user, parentAccount, isLoading } = useParentAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate(`/parent/auth?redirect=/daily-line/trip/${bookingId}`, { replace: true });
    }
  }, [user, isLoading, navigate, bookingId]);

  // Booking + trip + stations
  const { data: booking, isLoading: loadingBooking } = useQuery({
    queryKey: ["dl-tracking-booking", bookingId, parentAccount?.id],
    enabled: !!bookingId && !!parentAccount,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_line_bookings")
        .select(`
          *,
          daily_line_trips!inner(
            *,
            daily_lines(name, city)
          ),
          pickup:daily_line_stations!pickup_station_id(id, name, latitude, longitude),
          dropoff:daily_line_stations!dropoff_station_id(id, name, latitude, longitude)
        `)
        .eq("id", bookingId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const tripId = booking?.daily_line_trips?.id;
  const lineId = booking?.daily_line_trips?.line_id;
  const driverId = booking?.daily_line_trips?.driver_id;

  const { data: stations = [] } = useQuery({
    queryKey: ["dl-tracking-stations", lineId],
    enabled: !!lineId,
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_line_stations")
        .select("*")
        .eq("line_id", lineId!)
        .order("station_order");
      return data || [];
    },
  });

  const { data: driver } = useQuery({
    queryKey: ["dl-tracking-driver", driverId],
    enabled: !!driverId,
    queryFn: async () => {
      const { data } = await supabase
        .from("drivers")
        .select("id, full_name, phone, vehicle_plate, vehicle_model, vehicle_color")
        .eq("id", driverId!)
        .maybeSingle();
      return data;
    },
  });

  // Live position from realtime updates on daily_line_trips
  const [livePos, setLivePos] = useState<{ lat: number; lng: number } | null>(() => {
    const lat = booking?.daily_line_trips?.current_latitude;
    const lng = booking?.daily_line_trips?.current_longitude;
    return lat && lng ? { lat, lng } : null;
  });

  useEffect(() => {
    const lat = booking?.daily_line_trips?.current_latitude;
    const lng = booking?.daily_line_trips?.current_longitude;
    if (lat && lng) setLivePos({ lat, lng });
  }, [booking?.daily_line_trips?.current_latitude, booking?.daily_line_trips?.current_longitude]);

  // Determine if this passenger's leg is finished (driver dropped them off OR trip completed/cancelled)
  const isFinished =
    !!booking?.dropped_at ||
    booking?.daily_line_trips?.status === "completed" ||
    booking?.daily_line_trips?.status === "cancelled";

  useEffect(() => {
    if (!tripId || isFinished) return;
    const channel = supabase
      .channel(`dl-trip-${tripId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "daily_line_trips", filter: `id=eq.${tripId}` },
        (payload: any) => {
          const lat = payload.new?.current_latitude;
          const lng = payload.new?.current_longitude;
          if (lat && lng) setLivePos({ lat, lng });
          // If driver completed the trip, refetch booking so UI updates
          if (payload.new?.status === "completed" || payload.new?.status === "cancelled") {
            qc.invalidateQueries({ queryKey: ["dl-tracking-booking", bookingId] });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId, isFinished, qc, bookingId]);

  // Subscribe to this specific booking row → refetch when driver sets dropped_at / payment changes
  useEffect(() => {
    if (!bookingId) return;
    const channel = supabase
      .channel(`dl-booking-${bookingId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "daily_line_bookings", filter: `id=eq.${bookingId}` },
        () => qc.invalidateQueries({ queryKey: ["dl-tracking-booking", bookingId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId, qc]);

  if (isLoading || loadingBooking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
            <p>{isRtl ? "لم يتم العثور على الحجز" : "Booking not found"}</p>
            <Button onClick={() => navigate("/daily-line/portal")}>
              {isRtl ? "رجوع" : "Back"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const trip = booking.daily_line_trips;
  const tripStatus = trip.status;
  const isLive = tripStatus === "in_progress";
  const pickupNav = booking.pickup?.latitude && booking.pickup?.longitude
    ? `https://www.google.com/maps/dir/?api=1&destination=${booking.pickup.latitude},${booking.pickup.longitude}`
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30" dir={isRtl ? "rtl" : "ltr"}>
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur-xl">
        <div className="container mx-auto flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/daily-line/portal")}>
            <ArrowLeft className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{trip.daily_lines?.name}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <Calendar className="h-3 w-3" />
              {trip.trip_date} · {trip.departure_time?.slice(0, 5)}
            </div>
          </div>
          <Badge
            className={
              isLive
                ? "bg-green-500 animate-pulse"
                : tripStatus === "completed"
                  ? "bg-muted text-muted-foreground"
                  : "bg-blue-500"
            }
          >
            {isLive ? (isRtl ? "مباشر" : "LIVE") : tripStatus}
          </Badge>
        </div>
      </header>

      <main className="container mx-auto p-4 max-w-3xl space-y-4">
        {/* Live Map */}
        <Card className="overflow-hidden border-0 shadow-lg">
          <div className="relative">
            <LineRoutePreviewMap
              stations={stations as any}
              height="380px"
              highlightStationId={booking.pickup_station_id || undefined}
              driverLocation={livePos}
            />
            {isLive && livePos && (
              <div className="absolute top-3 left-3 bg-background/95 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-lg border flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-medium">{isRtl ? "تتبع مباشر" : "Live tracking"}</span>
              </div>
            )}
            {!livePos && (
              <div className="absolute bottom-3 left-3 right-3 bg-background/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg border text-center">
                <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {isRtl ? "في انتظار إشارة GPS من السائق..." : "Waiting for driver GPS signal..."}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Booking summary */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">{isRtl ? "كود الركوب" : "Boarding code"}</div>
                <div className="text-3xl font-bold tabular-nums tracking-wider">{booking.boarding_code}</div>
              </div>
              <div className="text-end space-y-1">
                <PaymentStatusBadge status={booking.payment_status} isRtl={isRtl} />
                <div className="text-sm text-muted-foreground">
                  {Number(booking.final_price).toFixed(2)} EGP
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm pt-2 border-t">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs text-muted-foreground">{isRtl ? "محطة الركوب" : "Pickup"}</div>
                  <div className="font-medium">{booking.pickup?.name || "—"}</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs text-muted-foreground">{isRtl ? "محطة النزول" : "Drop-off"}</div>
                  <div className="font-medium">{booking.dropoff?.name || "—"}</div>
                </div>
              </div>
            </div>
            {pickupNav && (
              <Button asChild variant="outline" size="sm" className="w-full">
                <a href={pickupNav} target="_blank" rel="noreferrer">
                  <Navigation className="h-4 w-4 mr-1" />
                  {isRtl ? "التوجيه إلى محطة الركوب" : "Navigate to pickup"}
                </a>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Driver / Captain card */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <User className="h-4 w-4 text-primary" />
              {isRtl ? "بيانات الكابتن" : "Captain Details"}
            </div>
            {driver ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{driver.full_name}</div>
                    <div className="text-xs text-muted-foreground">{isRtl ? "كابتن الرحلة" : "Trip captain"}</div>
                  </div>
                  <Button asChild size="sm" className="bg-green-600 hover:bg-green-700">
                    <a href={`tel:${driver.phone}`}>
                      <Phone className="h-4 w-4 mr-1" />
                      {isRtl ? "اتصال" : "Call"}
                    </a>
                  </Button>
                </div>
                {(driver.vehicle_plate || driver.vehicle_model || driver.vehicle_color) && (
                  <div className="pt-3 border-t space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Car className="h-4 w-4 text-primary" />
                      {isRtl ? "بيانات السيارة" : "Vehicle Details"}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {driver.vehicle_plate && (
                        <div className="p-2 bg-muted/50 rounded-lg">
                          <div className="text-[10px] text-muted-foreground">{isRtl ? "اللوحة" : "Plate"}</div>
                          <div className="font-bold text-sm">{driver.vehicle_plate}</div>
                        </div>
                      )}
                      {driver.vehicle_model && (
                        <div className="p-2 bg-muted/50 rounded-lg">
                          <div className="text-[10px] text-muted-foreground">{isRtl ? "الموديل" : "Model"}</div>
                          <div className="font-bold text-sm">{driver.vehicle_model}</div>
                        </div>
                      )}
                      {driver.vehicle_color && (
                        <div className="p-2 bg-muted/50 rounded-lg">
                          <div className="text-[10px] text-muted-foreground">{isRtl ? "اللون" : "Color"}</div>
                          <div className="font-bold text-sm">{driver.vehicle_color}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-muted-foreground py-2">
                {isRtl ? "لم يتم تعيين كابتن بعد" : "No captain assigned yet"}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Boarding status */}
        {(booking.boarded_at || booking.dropped_at) && (
          <Card>
            <CardContent className="p-4 space-y-2 text-sm">
              {booking.boarded_at && (
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  {isRtl ? "تم الركوب" : "Boarded"} · {format(new Date(booking.boarded_at), "HH:mm")}
                </div>
              )}
              {booking.dropped_at && (
                <div className="flex items-center gap-2 text-blue-700">
                  <CheckCircle2 className="h-4 w-4" />
                  {isRtl ? "تم النزول" : "Dropped off"} · {format(new Date(booking.dropped_at), "HH:mm")}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

function PaymentStatusBadge({ status, isRtl }: { status: string; isRtl: boolean }) {
  const map: Record<string, { label: string; cls: string }> = {
    paid: { label: isRtl ? "مدفوع" : "Paid", cls: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30" },
    pending: { label: isRtl ? "قيد الانتظار" : "Pending", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" },
    cancelled: { label: isRtl ? "ملغي" : "Cancelled", cls: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30" },
  };
  const m = map[status] || map.pending;
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
}
