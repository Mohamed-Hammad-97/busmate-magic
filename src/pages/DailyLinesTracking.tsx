import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHero } from "@/components/layout/PageHero";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Bus, Navigation, Users, Clock, Calendar, MapPin, ArrowUpCircle, ArrowDownCircle, Phone, CheckCircle, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import DailyLinesLiveMap from "@/components/daily-lines/DailyLinesLiveMap";

export default function DailyLinesTracking() {
  const [openTripId, setOpenTripId] = useState<string | null>(null);

  const { data: trips = [], isLoading, refetch } = useQuery({
    queryKey: ["daily-lines-tracking"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("daily_line_trips")
        .select("*, daily_lines(name, city), drivers(full_name, phone)")
        .gte("trip_date", today)
        .in("status", ["scheduled", "in_progress"])
        .order("trip_date", { ascending: true })
        .order("departure_time", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15000,
  });

  const inProgress = trips.filter((t: any) => t.status === "in_progress");
  const scheduled = trips.filter((t: any) => t.status === "scheduled");

  return (
    <DashboardLayout>
      <PageHero
        icon={Navigation}
        title="Daily Lines — Live Tracking"
        description="Monitor active and scheduled daily line trips in real time"
      />

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-0 shadow-md bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/20">
            <CardContent className="pt-5 pb-4 text-center">
              <Navigation className="h-6 w-6 mx-auto text-green-600 mb-1" />
              <div className="text-3xl font-bold text-green-600">{inProgress.length}</div>
              <p className="text-xs text-muted-foreground">In progress now</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20">
            <CardContent className="pt-5 pb-4 text-center">
              <Calendar className="h-6 w-6 mx-auto text-blue-600 mb-1" />
              <div className="text-3xl font-bold text-blue-600">{scheduled.length}</div>
              <p className="text-xs text-muted-foreground">Scheduled</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="pt-5 pb-4 text-center">
              <Button variant="ghost" className="gap-2" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" /> Refresh
              </Button>
              <p className="text-xs text-muted-foreground mt-1">Auto-refreshes every 15s</p>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
        ) : trips.length === 0 ? (
          <Card className="border-0 shadow-md">
            <CardContent className="py-12 text-center text-muted-foreground">
              <Bus className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="font-medium">No active or upcoming daily line trips</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {trips.map((trip: any) => {
              const isActive = trip.status === "in_progress";
              return (
                <Card key={trip.id} className={`border-0 shadow-md cursor-pointer hover:shadow-lg transition-all ${isActive ? "ring-2 ring-green-500" : ""}`} onClick={() => setOpenTripId(trip.id)}>
                  {isActive && <div className="h-1 bg-gradient-to-r from-green-500 to-emerald-500" />}
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Bus className="h-5 w-5 text-primary" />
                        </div>
                        {trip.daily_lines?.name}
                      </CardTitle>
                      <Badge className={isActive ? "bg-green-500" : "bg-blue-500"}>{trip.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                        <Calendar className="h-4 w-4 text-primary" />{format(new Date(trip.trip_date), "MMM d")}
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                        <Clock className="h-4 w-4 text-primary" />{trip.departure_time?.slice(0, 5)}
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                        <MapPin className="h-4 w-4 text-primary" />{trip.daily_lines?.city}
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                        <Users className="h-4 w-4 text-primary" />{trip.total_seats - trip.available_seats}/{trip.total_seats}
                      </div>
                    </div>
                    {trip.drivers && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                        <Phone className="h-3 w-3" /> {trip.drivers.full_name} — {trip.drivers.phone}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!openTripId} onOpenChange={(o) => !o && setOpenTripId(null)}>
        <DialogContent className="max-w-3xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Trip Details</DialogTitle>
          </DialogHeader>
          {openTripId && <TripDetailView tripId={openTripId} />}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function TripDetailView({ tripId }: { tripId: string }) {
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["daily-line-admin-trip-bookings", tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_line_bookings")
        .select("*, pickup:daily_line_stations!pickup_station_id(name), dropoff:daily_line_stations!dropoff_station_id(name)")
        .eq("trip_id", tripId)
        .neq("payment_status", "cancelled")
        .order("boarding_code");
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 5000,
  });

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  const boarded = bookings.filter((b: any) => b.boarded_at && !b.dropped_at).length;
  const dropped = bookings.filter((b: any) => b.dropped_at).length;

  return (
    <div className="flex-1 overflow-y-auto space-y-3 pr-2">
      <div className="grid grid-cols-3 gap-2 text-center text-sm sticky top-0 bg-background pb-2">
        <div className="p-2 bg-muted/50 rounded-lg">
          <div className="font-bold text-lg">{bookings.length}</div>
          <div className="text-xs text-muted-foreground">Total</div>
        </div>
        <div className="p-2 bg-green-50 dark:bg-green-950/20 rounded-lg">
          <div className="font-bold text-lg text-green-600">{boarded}</div>
          <div className="text-xs text-muted-foreground">On board</div>
        </div>
        <div className="p-2 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
          <div className="font-bold text-lg text-blue-600">{dropped}</div>
          <div className="text-xs text-muted-foreground">Dropped</div>
        </div>
      </div>
      {bookings.map((b: any) => {
        const isBoarded = !!b.boarded_at;
        const isDropped = !!b.dropped_at;
        return (
          <Card key={b.id} className={`border ${isDropped ? "opacity-60" : isBoarded ? "border-green-500" : ""}`}>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-12 w-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl shrink-0">
                    {b.boarding_code}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{b.passenger_name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {b.passenger_phone}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge variant={b.payment_status === "paid" ? "default" : "secondary"}>{b.payment_status}</Badge>
                  {isDropped ? <Badge className="bg-blue-500">Dropped</Badge> : isBoarded ? <Badge className="bg-green-500">On board</Badge> : <Badge variant="outline">Waiting</Badge>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1"><ArrowUpCircle className="h-3 w-3 text-green-600" />{b.pickup?.name || "—"}</div>
                <div className="flex items-center gap-1"><ArrowDownCircle className="h-3 w-3 text-blue-600" />{b.dropoff?.name || "—"}</div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
