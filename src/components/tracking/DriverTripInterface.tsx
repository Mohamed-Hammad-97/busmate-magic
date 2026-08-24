import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLiveTrip, useLiveTripRealtime, type TripStudentStatus, type StudentStatus } from "@/hooks/useLiveTrip";
import { useGeolocation } from "@/hooks/useGeolocation";
import { LiveTripMap } from "./LiveTripMap";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Play, Square, MapPin, Phone, Bell, CheckCircle2,
  Clock, Navigation, Users, Loader2, AlertCircle, Ban, ArrowRight,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

interface DriverTripInterfaceProps {
  routeId: string;
  onClose?: () => void;
}

const STATUS_CONFIG: Record<StudentStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "في الانتظار", color: "bg-amber-500", icon: <Clock className="h-4 w-4" /> },
  arriving: { label: "الباص في الطريق", color: "bg-blue-500", icon: <Navigation className="h-4 w-4" /> },
  picked_up: { label: "تم الاستلام", color: "bg-green-500", icon: <CheckCircle2 className="h-4 w-4" /> },
  dropped_off: { label: "تم التوصيل", color: "bg-muted-foreground", icon: <CheckCircle2 className="h-4 w-4" /> },
};

export function DriverTripInterface({ routeId, onClose }: DriverTripInterfaceProps) {
  const { toast } = useToast();
  const [selectedStudent, setSelectedStudent] = useState<TripStudentStatus | null>(null);
  const [showStudentDialog, setShowStudentDialog] = useState(false);
  
  const {
    activeTrip, tripStudents, isLoading,
    startTrip, updateLocation, updateStudentStatus, endTrip,
    isStarting, isEnding,
  } = useLiveTrip(routeId);

  useLiveTripRealtime(activeTrip?.id);

  const { latitude, longitude, startTracking, stopTracking, isTracking, error: geoError } = useGeolocation();

  const { data: route } = useQuery({
    queryKey: ["route-details", routeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routes")
        .select(`*, schools (name), drivers (full_name), supervisors (full_name)`)
        .eq("id", routeId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch today's absences
  const registrationIds = tripStudents.map(s => s.registration_id);
  const { data: todayAbsences = [] } = useQuery({
    queryKey: ["driver-trip-absences", registrationIds],
    queryFn: async () => {
      if (registrationIds.length === 0) return [];
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("student_absences")
        .select("registration_id")
        .in("registration_id", registrationIds)
        .eq("absence_date", today);
      if (error) return [];
      return data.map(a => a.registration_id);
    },
    enabled: registrationIds.length > 0,
  });

  useEffect(() => {
    if (activeTrip?.status === "in_progress" && !isTracking) {
      startTracking((lat, lng) => {
        if (activeTrip?.id) {
          updateLocation({ tripId: activeTrip.id, lat, lng });
        }
      });
    }
  }, [activeTrip?.status, activeTrip?.id, isTracking]);

  useEffect(() => {
    return () => { stopTracking(); };
  }, []);

  const handleStartTrip = () => {
    startTrip({
      routeId,
      driverId: route?.driver_id || undefined,
      supervisorId: route?.supervisor_id || undefined,
    });
  };

  const handleEndTrip = () => {
    if (activeTrip?.id) {
      stopTracking();
      endTrip(activeTrip.id);
    }
  };

  const handleStudentClick = (student: TripStudentStatus) => {
    setSelectedStudent(student);
    setShowStudentDialog(true);
  };

  const handleUpdateStudentStatus = (newStatus: StudentStatus) => {
    if (!selectedStudent || !activeTrip) return;
    const notificationMap: Record<StudentStatus, "arriving_soon" | "arrived_at_pickup" | "picked_up" | "arrived_at_school" | undefined> = {
      pending: undefined, arriving: "arriving_soon", picked_up: "picked_up", dropped_off: "arrived_at_school",
    };
    updateStudentStatus({
      statusId: selectedStudent.id, registrationId: selectedStudent.registration_id,
      tripId: activeTrip.id, status: newStatus, notificationType: notificationMap[newStatus],
    });
    setShowStudentDialog(false);
    toast({ title: "تم التحديث", description: `تم تحديث حالة ${selectedStudent.registrations?.student_name}` });
  };

  const handleArriveAtStudent = () => {
    if (!selectedStudent || !activeTrip) return;
    updateStudentStatus({
      statusId: selectedStudent.id, registrationId: selectedStudent.registration_id,
      tripId: activeTrip.id, status: "arriving", notificationType: "arrived_at_pickup",
    });
    toast({ title: "تم الإشعار", description: `تم إرسال إشعار الوصول لـ ${selectedStudent.registrations?.student_name}` });
  };

  const stats = {
    total: tripStudents.length,
    pending: tripStudents.filter((s) => s.status === "pending").length,
    pickedUp: tripStudents.filter((s) => s.status === "picked_up").length,
    droppedOff: tripStudents.filter((s) => s.status === "dropped_off").length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col min-h-full">
        {/* Header */}
        <div className="p-4 border-b bg-background sticky top-0 z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 min-w-0">
              {onClose && (
                <Button variant="ghost" size="icon" className="shrink-0" onClick={onClose} aria-label="رجوع">
                  <ArrowRight className="h-5 w-5" />
                </Button>
              )}
              <div className="min-w-0">
                <h2 className="text-lg font-bold truncate">{route?.name || "الرحلة"}</h2>
                <p className="text-xs text-muted-foreground truncate">{route?.schools?.name}</p>
              </div>
            </div>

            
            {!activeTrip || activeTrip.status === "completed" ? (
              <Button onClick={handleStartTrip} disabled={isStarting} size="sm" className="gap-2">
                {isStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                بدء الرحلة
              </Button>
            ) : (
              <Button onClick={handleEndTrip} disabled={isEnding} variant="destructive" size="sm" className="gap-2">
                {isEnding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
                إنهاء الرحلة
              </Button>
            )}
          </div>

          {/* Stats */}
          {activeTrip?.status === "in_progress" && (
            <div className="grid grid-cols-4 gap-2">
              {[
                { val: stats.total, label: "إجمالي", color: "text-foreground" },
                { val: stats.pending, label: "في الانتظار", color: "text-amber-500" },
                { val: stats.pickedUp, label: "تم الاستلام", color: "text-green-500" },
                { val: stats.droppedOff, label: "تم التوصيل", color: "text-muted-foreground" },
              ].map((s, i) => (
                <div key={i} className="bg-muted/50 rounded-lg p-2 text-center">
                  <p className={`text-xl font-bold ${s.color}`}>{s.val}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {geoError && (
            <div className="mt-2 p-2 bg-destructive/10 rounded-lg flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              {geoError}
            </div>
          )}
        </div>

        {/* Map */}
        <div className="h-[350px] relative">
          <LiveTripMap
            trip={activeTrip}
            students={tripStudents}
            onStudentClick={handleStudentClick}
            showDriverLocation={isTracking}
            isDriver={true}
          />
        </div>

        {/* Student List */}
        {activeTrip?.status === "in_progress" && (
          <div className="border-t">
            <div className="p-3 bg-muted/50 sticky top-0">
              <h3 className="font-semibold flex items-center gap-2 text-sm">
                <Users className="h-4 w-4" />
                الطلاب ({tripStudents.length})
              </h3>
            </div>
            <div className="p-2 space-y-2">
              {tripStudents.map((student) => {
                const config = STATUS_CONFIG[student.status as StudentStatus];
                const isAbsent = todayAbsences.includes(student.registration_id);
                return (
                  <Card
                    key={student.id}
                    className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors ${isAbsent ? "opacity-60 border-destructive/30" : ""}`}
                    onClick={() => handleStudentClick(student)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full ${isAbsent ? "bg-destructive" : config.color} flex items-center justify-center text-white relative`}>
                          {isAbsent ? <Ban className="h-4 w-4" /> : config.icon}
                          {student.pickup_order && (
                            <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary text-[9px] text-primary-foreground rounded-full flex items-center justify-center font-bold">
                              {student.pickup_order}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-sm flex items-center gap-1">
                            {student.registrations?.student_name}
                            {isAbsent && <span className="text-destructive text-xs">(غائب)</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {student.registrations?.parent_accounts?.parent_name}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {config.label}
                        </Badge>
                        {(() => {
                          const father = student.registrations?.parent_accounts?.father_phone;
                          const mother = student.registrations?.parent_accounts?.mother_phone;
                          if (father && mother) {
                            return (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    onClick={(e) => e.stopPropagation()}
                                    className="p-1.5 hover:bg-muted rounded-full"
                                    aria-label="اتصال"
                                  >
                                    <Phone className="h-3.5 w-3.5" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                  <DropdownMenuItem asChild>
                                    <a href={`tel:${father}`}>اتصال بالأب — {father}</a>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem asChild>
                                    <a href={`tel:${mother}`}>اتصال بالأم — {mother}</a>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            );
                          }
                          const single = father || mother;
                          if (!single) return null;
                          return (
                            <a
                              href={`tel:${single}`}
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 hover:bg-muted rounded-full"
                            >
                              <Phone className="h-3.5 w-3.5" />
                            </a>
                          );
                        })()}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Student Action Dialog */}
      <Dialog open={showStudentDialog} onOpenChange={setShowStudentDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{selectedStudent?.registrations?.student_name}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm">موقع الاستلام</p>
                {selectedStudent?.registrations?.parent_accounts?.pickup_address && (
                  <p className="text-xs text-muted-foreground break-words">
                    {selectedStudent.registrations.parent_accounts.pickup_address}
                  </p>
                )}
                <a
                  href={`https://www.google.com/maps?q=${selectedStudent?.registrations?.parent_accounts?.pickup_latitude},${selectedStudent?.registrations?.parent_accounts?.pickup_longitude}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  فتح في الخرائط
                </a>
              </div>
            </div>

            <div className="space-y-2">
              {selectedStudent?.registrations?.parent_accounts?.father_phone && (
                <a
                  href={`tel:${selectedStudent.registrations.parent_accounts.father_phone}`}
                  className="flex items-center gap-3 rounded-lg border p-2 hover:bg-muted/50"
                >
                  <Phone className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">هاتف الأب</p>
                    <p className="text-sm font-medium truncate">
                      {selectedStudent.registrations.parent_accounts.father_phone}
                    </p>
                  </div>
                </a>
              )}
              {selectedStudent?.registrations?.parent_accounts?.mother_phone && (
                <a
                  href={`tel:${selectedStudent.registrations.parent_accounts.mother_phone}`}
                  className="flex items-center gap-3 rounded-lg border p-2 hover:bg-muted/50"
                >
                  <Phone className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">هاتف الأم</p>
                    <p className="text-sm font-medium truncate">
                      {selectedStudent.registrations.parent_accounts.mother_phone}
                    </p>
                  </div>
                </a>
              )}
            </div>


            <div className="grid grid-cols-2 gap-2">
              {selectedStudent?.status === "pending" && (
                <>
                  <Button variant="outline" className="gap-2" onClick={handleArriveAtStudent}>
                    <Bell className="h-4 w-4" /> إشعار الوصول
                  </Button>
                  <Button className="gap-2" onClick={() => handleUpdateStudentStatus("picked_up")}>
                    <CheckCircle2 className="h-4 w-4" /> تم الاستلام
                  </Button>
                </>
              )}
              {selectedStudent?.status === "arriving" && (
                <Button className="gap-2 col-span-2" onClick={() => handleUpdateStudentStatus("picked_up")}>
                  <CheckCircle2 className="h-4 w-4" /> تم الاستلام
                </Button>
              )}
              {selectedStudent?.status === "picked_up" && (
                <Button className="gap-2 col-span-2" onClick={() => handleUpdateStudentStatus("dropped_off")}>
                  <CheckCircle2 className="h-4 w-4" /> تم التوصيل
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ScrollArea>
  );
}
