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
  routeNumber?: string | number | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "في الانتظار", color: "bg-warning text-warning-foreground" },
  arriving: { label: "في الطريق", color: "bg-info text-info-foreground" },
  picked_up: { label: "تم الاستلام", color: "bg-success text-success-foreground" },
  dropped_off: { label: "تم التوصيل", color: "bg-muted-foreground" },
};

export function TripHistory({ routeId, routeName, routeNumber }: TripHistoryProps) {
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
          سجل الرحلات {routeName && `- #${routeNumber ?? '-'} - ${routeName}`}
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
        <DialogContent
          dir="rtl"
          className="flex h-[min(90dvh,46rem)] w-[calc(100%-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:rounded-xl"
        >
          <DialogHeader className="shrink-0 border-b px-5 py-4 text-start sm:px-6">
            <DialogTitle className="flex items-center gap-2 pe-8 text-lg leading-7">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Bus className="h-5 w-5 text-primary" />
              </span>
              <span className="min-w-0">
                <span className="block">تفاصيل الرحلة</span>
                {routeName && (
                  <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">
                    #{routeNumber ?? "-"} - {routeName}
                  </span>
                )}
              </span>
            </DialogTitle>
          </DialogHeader>

          {selectedTrip && (
            <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-4 pt-4 sm:px-6 sm:pb-6">
              {/* Trip summary */}
              <div className="grid shrink-0 grid-cols-2 gap-2 sm:gap-3">
                <div className="min-w-0 rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">بداية الرحلة</p>
                  <p className="mt-1 break-words text-sm font-semibold tabular-nums">
                    {selectedTrip.started_at ? format(new Date(selectedTrip.started_at), "HH:mm - dd/MM/yyyy") : "-"}
                  </p>
                </div>
                <div className="min-w-0 rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">نهاية الرحلة</p>
                  <p className="mt-1 break-words text-sm font-semibold tabular-nums">
                    {selectedTrip.completed_at ? format(new Date(selectedTrip.completed_at), "HH:mm - dd/MM/yyyy") : "-"}
                  </p>
                </div>
                {(selectedTrip as any).drivers && (
                  <div className="min-w-0 rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">السائق</p>
                    <p className="mt-1 break-words text-sm font-semibold">{(selectedTrip as any).drivers.full_name}</p>
                  </div>
                )}
                {(selectedTrip as any).supervisors && (
                  <div className="min-w-0 rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">المشرف</p>
                    <p className="mt-1 break-words text-sm font-semibold">{(selectedTrip as any).supervisors.full_name}</p>
                  </div>
                )}
              </div>

              {/* Students */}
              <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-muted/10">
                <h4 className="flex shrink-0 items-center gap-2 border-b bg-background px-4 py-3 text-sm font-semibold">
                  <Users className="h-4 w-4 text-primary" />
                  الطلاب ({tripDetails.length})
                </h4>
                <ScrollArea className="min-h-0 flex-1">
                  {detailsLoading ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-2 p-2 sm:p-3">
                      {tripDetails.map((student: any) => {
                        const statusInfo = STATUS_LABELS[student.status] || STATUS_LABELS.pending;
                        return (
                          <div key={student.id} className="flex min-h-16 items-center justify-between gap-3 rounded-lg border bg-card p-3 shadow-sm">
                            <div className="flex min-w-0 items-center gap-3">
                              {student.pickup_order && (
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                                  {student.pickup_order}
                                </span>
                              )}
                              <div className="min-w-0">
                                <p className="break-words text-sm font-semibold leading-5">{student.registrations?.student_name}</p>
                                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                                  {student.picked_up_at && (
                                    <span>استلام: {format(new Date(student.picked_up_at), "HH:mm")}</span>
                                  )}
                                  {student.dropped_off_at && (
                                    <span>توصيل: {format(new Date(student.dropped_off_at), "HH:mm")}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Badge className={`${statusInfo.color} shrink-0 whitespace-nowrap border-0 text-[10px]`}>
                              {statusInfo.label}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
