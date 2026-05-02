import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDriverAuth } from "@/contexts/DriverAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Bus, MapPin, Clock, Play, CheckCircle, Users, Phone, ArrowDownCircle, ArrowUpCircle, Calendar, Navigation } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useGeolocation } from "@/hooks/useGeolocation";
import LineRoutePreviewMap from "@/components/daily-lines/LineRoutePreviewMap";

export function DriverDailyLineTrips() {
  const { driverAccount } = useDriverAuth();
  const queryClient = useQueryClient();
  const [openTripId, setOpenTripId] = useState<string | null>(null);

  const driverId = driverAccount?.driver_id;

  const { data: trips = [], isLoading } = useQuery({
    queryKey: ["driver-daily-line-trips", driverId],
    queryFn: async () => {
      if (!driverId) return [];
      const { data, error } = await supabase
        .from("daily_line_trips")
        .select("*, daily_lines(name, city)")
        .eq("driver_id", driverId)
        .gte("trip_date", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0])
        .order("trip_date", { ascending: true })
        .order("departure_time", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!driverId,
    refetchInterval: 30000,
  });

  const startTripMutation = useMutation({
    mutationFn: async (tripId: string) => {
      const { error } = await supabase
        .from("daily_line_trips")
        .update({ status: "in_progress", started_at: new Date().toISOString() })
        .eq("id", tripId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Trip started");
      queryClient.invalidateQueries({ queryKey: ["driver-daily-line-trips"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const completeTripMutation = useMutation({
    mutationFn: async (tripId: string) => {
      const { error } = await supabase
        .from("daily_line_trips")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", tripId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Trip completed");
      setOpenTripId(null);
      queryClient.invalidateQueries({ queryKey: ["driver-daily-line-trips"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  if (trips.length === 0) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="py-12 text-center text-muted-foreground">
          <Bus className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="font-medium">No daily line trips assigned</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {trips.map((trip: any) => {
          const isActive = trip.status === "in_progress";
          const isCompleted = trip.status === "completed";
          return (
            <Card key={trip.id} className={`border-0 shadow-md overflow-hidden ${isActive ? "ring-2 ring-green-500" : ""}`}>
              {isActive && <div className="h-1 bg-gradient-to-r from-green-500 to-emerald-500" />}
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Bus className="h-5 w-5 text-primary" />
                    </div>
                    {trip.daily_lines?.name}
                  </CardTitle>
                  <Badge className={isActive ? "bg-green-500" : isCompleted ? "bg-muted text-muted-foreground" : "bg-blue-500"}>
                    {trip.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                    <Calendar className="h-4 w-4 text-primary" />
                    {format(new Date(trip.trip_date), "MMM d")}
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                    <Clock className="h-4 w-4 text-primary" />
                    {trip.departure_time?.slice(0, 5)}
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                    <MapPin className="h-4 w-4 text-primary" />
                    {trip.daily_lines?.city}
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                    <Users className="h-4 w-4 text-primary" />
                    {trip.total_seats - trip.available_seats}/{trip.total_seats} booked
                  </div>
                </div>

                {!isCompleted && (
                  <div className="flex gap-2">
                    {!isActive ? (
                      <Button className="flex-1 gap-2" onClick={() => startTripMutation.mutate(trip.id)} disabled={startTripMutation.isPending}>
                        <Play className="h-4 w-4" /> Start Trip
                      </Button>
                    ) : (
                      <Button className="flex-1 gap-2 bg-green-600 hover:bg-green-700" onClick={() => setOpenTripId(trip.id)}>
                        <Users className="h-4 w-4" /> Manage Passengers
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!openTripId} onOpenChange={(o) => !o && setOpenTripId(null)}>
        <DialogContent className="max-w-2xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Trip Passengers</DialogTitle>
          </DialogHeader>
          {openTripId && (
            <DailyTripPassengers
              tripId={openTripId}
              onComplete={() => completeTripMutation.mutate(openTripId)}
              completing={completeTripMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function DailyTripPassengers({ tripId, onComplete, completing }: { tripId: string; onComplete: () => void; completing: boolean }) {
  const queryClient = useQueryClient();
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["daily-line-trip-bookings", tripId],
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

  const boardMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase
        .from("daily_line_bookings")
        .update({ boarded_at: new Date().toISOString() })
        .eq("id", bookingId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Passenger boarded");
      queryClient.invalidateQueries({ queryKey: ["daily-line-trip-bookings", tripId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const dropMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase
        .from("daily_line_bookings")
        .update({ dropped_at: new Date().toISOString() })
        .eq("id", bookingId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Passenger dropped off");
      queryClient.invalidateQueries({ queryKey: ["daily-line-trip-bookings", tripId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  const onboard = bookings.filter((b: any) => b.boarded_at && !b.dropped_at).length;

  return (
    <div className="flex-1 overflow-y-auto space-y-3 pr-2">
      <div className="grid grid-cols-3 gap-2 text-center text-sm sticky top-0 bg-background pb-2">
        <div className="p-2 bg-muted/50 rounded-lg">
          <div className="font-bold text-lg">{bookings.length}</div>
          <div className="text-xs text-muted-foreground">Total</div>
        </div>
        <div className="p-2 bg-green-50 dark:bg-green-950/20 rounded-lg">
          <div className="font-bold text-lg text-green-600">{onboard}</div>
          <div className="text-xs text-muted-foreground">On board</div>
        </div>
        <div className="p-2 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
          <div className="font-bold text-lg text-blue-600">{bookings.filter((b: any) => b.dropped_at).length}</div>
          <div className="text-xs text-muted-foreground">Dropped</div>
        </div>
      </div>

      {bookings.map((b: any) => {
        const boarded = !!b.boarded_at;
        const dropped = !!b.dropped_at;
        return (
          <Card key={b.id} className={`border ${dropped ? "opacity-60" : boarded ? "border-green-500" : ""}`}>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-12 w-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl shrink-0">
                    {b.boarding_code}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{b.passenger_name}</p>
                    <a href={`tel:${b.passenger_phone}`} className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {b.passenger_phone}
                    </a>
                  </div>
                </div>
                <Badge variant={b.payment_status === "paid" ? "default" : "secondary"} className="shrink-0">
                  {b.payment_status}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <ArrowUpCircle className="h-3 w-3 text-green-600" />
                  {b.pickup?.name || "—"}
                </div>
                <div className="flex items-center gap-1">
                  <ArrowDownCircle className="h-3 w-3 text-blue-600" />
                  {b.dropoff?.name || "—"}
                </div>
              </div>
              <div className="flex gap-2">
                {!boarded ? (
                  <Button size="sm" className="flex-1 gap-1" onClick={() => boardMutation.mutate(b.id)} disabled={boardMutation.isPending}>
                    <ArrowUpCircle className="h-4 w-4" /> Mark Boarded
                  </Button>
                ) : !dropped ? (
                  <Button size="sm" className="flex-1 gap-1 bg-blue-600 hover:bg-blue-700" onClick={() => dropMutation.mutate(b.id)} disabled={dropMutation.isPending}>
                    <ArrowDownCircle className="h-4 w-4" /> Mark Dropped
                  </Button>
                ) : (
                  <div className="flex-1 text-center text-xs text-muted-foreground py-1.5 flex items-center justify-center gap-1">
                    <CheckCircle className="h-4 w-4 text-green-600" /> Completed
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Button className="w-full bg-green-600 hover:bg-green-700 sticky bottom-0" onClick={onComplete} disabled={completing}>
        <CheckCircle className="h-4 w-4 mr-2" /> Complete Trip
      </Button>
    </div>
  );
}
