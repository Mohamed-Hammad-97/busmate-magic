import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CalendarDays, Clock, Users, CheckCircle2, MapPin,
  Loader2, ChevronLeft, Navigation, Bus,
} from "lucide-react";
import { format, formatDistanceStrict } from "date-fns";
import { ar } from "date-fns/locale";

interface TripHistoryProps {
  routeId: string;
  routeName?: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "في الانتظار", color: "bg-amber-500" },
  arriving: { label: "في الطريق", color: "bg-blue-500" },
  picked_up: { label: "تم الاستلام", color: "bg-green-500" },
  dropped_off: { label: "تم التوصيل", color: "bg-muted-foreground" },
};

export function TripHistory({ routeId, routeName }: TripHistoryProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  // Fetch completed trips for this route
  const { data: trips = [], isLoading } = useQuery({
    queryKey: ["trip-history", routeId, selectedDate?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from("live_trips")
        .select(`
          id, status, started_at, completed_at, 
          current_latitude, current_longitude,
          routes (name, schools (name)),
          drivers (full_name),
          supervisors (full_name)
        `)
        .eq("route_id", routeId)
        .eq("status", "completed")
        .order("started_at", { ascending: false })
        .limit(30);

      if (selectedDate) {
        const dayStart = new Date(selectedDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(selectedDate);
        dayEnd.setHours(23, 59, 59, 999);
        query = query.gte("started_at", dayStart.toISOString()).lte("started_at", dayEnd.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch trip details (students) for selected trip
  const { data: tripDetails = [], isLoading: detailsLoading } = useQuery({
    queryKey: ["trip-detail", selectedTripId],
    queryFn: async () => {
      if (!selectedTripId) return [];
      const { data, error } = await supabase
        .from("trip_student_status")
        .select(`
          id, status, arrived_at, picked_up_at, dropped_off_at, pickup_order,
          registrations (student_name, parent_accounts (parent_name, father_phone))
        `)
        .eq("live_trip_id", selectedTripId)
        .order("pickup_order", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedTripId,
  });

  const selectedTrip = trips.find(t => t.id === selectedTripId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-base flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          سجل الرحلات {routeName && `- ${routeName}`}
        </h3>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <CalendarDays className="h-4 w-4" />
              {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "اختر تاريخ"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => setSelectedDate(date)}
              disabled={(date) => date > new Date()}
              className="pointer-events-auto"
            />
            {selectedDate && (
              <div className="p-2 border-t">
                <Button variant="ghost" size="sm" className="w-full" onClick={() => setSelectedDate(undefined)}>
                  عرض الكل
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : trips.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Bus className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>لا توجد رحلات مكتملة {selectedDate && "في هذا التاريخ"}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {trips.map((trip: any) => {
            const duration = trip.started_at && trip.completed_at
              ? formatDistanceStrict(new Date(trip.started_at), new Date(trip.completed_at), { locale: ar })
              : null;

            return (
              <Card
                key={trip.id}
                className="cursor-pointer hover:shadow-md transition-all hover:border-primary/30"
                onClick={() => setSelectedTripId(trip.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <CheckCircle2 className="h-3 w-3 ml-1" />
                          مكتملة
                        </Badge>
                        {trip.started_at && (
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(trip.started_at), "EEEE dd MMMM yyyy", { locale: ar })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {trip.started_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(trip.started_at), "HH:mm")}
                            {trip.completed_at && ` - ${format(new Date(trip.completed_at), "HH:mm")}`}
                          </span>
                        )}
                        {duration && (
                          <span className="flex items-center gap-1">
                            <Navigation className="h-3 w-3" />
                            {duration}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {trip.drivers && <span>السائق: {trip.drivers.full_name}</span>}
                        {trip.supervisors && <span>المشرف: {trip.supervisors.full_name}</span>}
                      </div>
                    </div>
                    <ChevronLeft className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Trip Detail Dialog */}
      <Dialog open={!!selectedTripId} onOpenChange={() => setSelectedTripId(null)}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bus className="h-5 w-5 text-primary" />
              تفاصيل الرحلة
            </DialogTitle>
          </DialogHeader>

          {selectedTrip && (
            <div className="space-y-4">
              {/* Trip summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">بداية الرحلة</p>
                  <p className="font-medium text-sm">
                    {selectedTrip.started_at ? format(new Date(selectedTrip.started_at), "HH:mm - dd/MM/yyyy") : "-"}
                  </p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">نهاية الرحلة</p>
                  <p className="font-medium text-sm">
                    {selectedTrip.completed_at ? format(new Date(selectedTrip.completed_at), "HH:mm - dd/MM/yyyy") : "-"}
                  </p>
                </div>
                {(selectedTrip as any).drivers && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">السائق</p>
                    <p className="font-medium text-sm">{(selectedTrip as any).drivers.full_name}</p>
                  </div>
                )}
                {(selectedTrip as any).supervisors && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">المشرف</p>
                    <p className="font-medium text-sm">{(selectedTrip as any).supervisors.full_name}</p>
                  </div>
                )}
              </div>

              {/* Students */}
              <div>
                <h4 className="font-semibold text-sm flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4" />
                  الطلاب ({tripDetails.length})
                </h4>
                <ScrollArea className="max-h-[300px]">
                  {detailsLoading ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {tripDetails.map((student: any) => {
                        const statusInfo = STATUS_LABELS[student.status] || STATUS_LABELS.pending;
                        return (
                          <div key={student.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                            <div className="flex items-center gap-3">
                              {student.pickup_order && (
                                <span className="w-6 h-6 bg-primary text-primary-foreground rounded-full text-xs flex items-center justify-center font-bold">
                                  {student.pickup_order}
                                </span>
                              )}
                              <div>
                                <p className="font-medium text-sm">{student.registrations?.student_name}</p>
                                <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                                  {student.picked_up_at && (
                                    <span>استلام: {format(new Date(student.picked_up_at), "HH:mm")}</span>
                                  )}
                                  {student.dropped_off_at && (
                                    <span>توصيل: {format(new Date(student.dropped_off_at), "HH:mm")}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Badge className={`${statusInfo.color} text-white text-[10px]`}>
                              {statusInfo.label}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
