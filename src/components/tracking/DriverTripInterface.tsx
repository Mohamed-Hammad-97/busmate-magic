import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLiveTrip, useLiveTripRealtime, type TripStudentStatus, type StudentStatus } from "@/hooks/useLiveTrip";
import { useGeolocation } from "@/hooks/useGeolocation";
import { LiveTripMap } from "./LiveTripMap";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Play,
  Square,
  MapPin,
  Phone,
  Bell,
  CheckCircle2,
  Clock,
  Navigation,
  Users,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DriverTripInterfaceProps {
  routeId: string;
  onClose?: () => void;
}

const STATUS_CONFIG: Record<StudentStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "في الانتظار", color: "bg-amber-500", icon: <Clock className="h-4 w-4" /> },
  arriving: { label: "الباص في الطريق", color: "bg-blue-500", icon: <Navigation className="h-4 w-4" /> },
  picked_up: { label: "تم الاستلام", color: "bg-green-500", icon: <CheckCircle2 className="h-4 w-4" /> },
  dropped_off: { label: "تم التوصيل", color: "bg-gray-500", icon: <CheckCircle2 className="h-4 w-4" /> },
};

export function DriverTripInterface({ routeId, onClose }: DriverTripInterfaceProps) {
  const { toast } = useToast();
  const [selectedStudent, setSelectedStudent] = useState<TripStudentStatus | null>(null);
  const [showStudentDialog, setShowStudentDialog] = useState(false);
  
  const {
    activeTrip,
    tripStudents,
    isLoading,
    startTrip,
    updateLocation,
    updateStudentStatus,
    endTrip,
    isStarting,
    isEnding,
  } = useLiveTrip(routeId);

  useLiveTripRealtime(activeTrip?.id);

  const { latitude, longitude, startTracking, stopTracking, isTracking, error: geoError } = useGeolocation();

  // Fetch route details
  const { data: route } = useQuery({
    queryKey: ["route-details", routeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routes")
        .select(`
          *,
          schools (name),
          drivers (full_name),
          supervisors (full_name)
        `)
        .eq("id", routeId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Start location tracking when trip starts
  useEffect(() => {
    if (activeTrip?.status === "in_progress" && !isTracking) {
      startTracking((lat, lng) => {
        if (activeTrip?.id) {
          updateLocation({ tripId: activeTrip.id, lat, lng });
        }
      });
    }
  }, [activeTrip?.status, activeTrip?.id, isTracking]);

  // Stop tracking when component unmounts
  useEffect(() => {
    return () => {
      stopTracking();
    };
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
      pending: undefined,
      arriving: "arriving_soon",
      picked_up: "picked_up",
      dropped_off: "arrived_at_school",
    };

    updateStudentStatus({
      statusId: selectedStudent.id,
      registrationId: selectedStudent.registration_id,
      tripId: activeTrip.id,
      status: newStatus,
      notificationType: notificationMap[newStatus],
    });

    setShowStudentDialog(false);
    toast({
      title: "تم التحديث",
      description: `تم تحديث حالة ${selectedStudent.registrations?.student_name} وإرسال إشعار`,
    });
  };

  const handleArriveAtStudent = () => {
    if (!selectedStudent || !activeTrip) return;

    updateStudentStatus({
      statusId: selectedStudent.id,
      registrationId: selectedStudent.registration_id,
      tripId: activeTrip.id,
      status: "arriving",
      notificationType: "arrived_at_pickup",
    });

    toast({
      title: "تم الإشعار",
      description: `تم إرسال إشعار الوصول لـ ${selectedStudent.registrations?.student_name}`,
    });
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b bg-background">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">{route?.name || "الرحلة"}</h2>
            <p className="text-sm text-muted-foreground">{route?.schools?.name}</p>
          </div>
          
          {!activeTrip || activeTrip.status === "completed" ? (
            <Button onClick={handleStartTrip} disabled={isStarting} className="gap-2">
              {isStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              بدء الرحلة
            </Button>
          ) : (
            <Button onClick={handleEndTrip} disabled={isEnding} variant="destructive" className="gap-2">
              {isEnding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
              إنهاء الرحلة
            </Button>
          )}
        </div>

        {/* Stats */}
        {activeTrip?.status === "in_progress" && (
          <div className="grid grid-cols-4 gap-2">
            <Card className="p-2">
              <div className="text-center">
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">إجمالي</p>
              </div>
            </Card>
            <Card className="p-2">
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-500">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">في الانتظار</p>
              </div>
            </Card>
            <Card className="p-2">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-500">{stats.pickedUp}</p>
                <p className="text-xs text-muted-foreground">تم الاستلام</p>
              </div>
            </Card>
            <Card className="p-2">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-500">{stats.droppedOff}</p>
                <p className="text-xs text-muted-foreground">تم التوصيل</p>
              </div>
            </Card>
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
      <div className="flex-1 relative min-h-[300px]">
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
          <div className="p-3 bg-muted/50">
            <h3 className="font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" />
              الطلاب ({tripStudents.length})
            </h3>
          </div>
          <ScrollArea className="h-48">
            <div className="p-2 space-y-2">
              {tripStudents.map((student) => {
                const config = STATUS_CONFIG[student.status as StudentStatus];
                return (
                  <Card
                    key={student.id}
                    className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleStudentClick(student)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full ${config.color} flex items-center justify-center text-white`}>
                          {config.icon}
                        </div>
                        <div>
                          <p className="font-medium">{student.registrations?.student_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {student.registrations?.parent_accounts?.parent_name}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {config.label}
                        </Badge>
                        <a
                          href={`tel:${student.registrations?.parent_accounts?.father_phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 hover:bg-muted rounded-full"
                        >
                          <Phone className="h-4 w-4" />
                        </a>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Student Action Dialog */}
      <Dialog open={showStudentDialog} onOpenChange={setShowStudentDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{selectedStudent?.registrations?.student_name}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm">موقع الاستلام</p>
                <a
                  href={`https://www.google.com/maps?q=${selectedStudent?.registrations?.parent_accounts?.pickup_latitude},${selectedStudent?.registrations?.parent_accounts?.pickup_longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  فتح في الخرائط
                </a>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm">هاتف ولي الأمر</p>
                <a
                  href={`tel:${selectedStudent?.registrations?.parent_accounts?.father_phone}`}
                  className="text-xs text-primary hover:underline"
                >
                  {selectedStudent?.registrations?.parent_accounts?.father_phone}
                </a>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {selectedStudent?.status === "pending" && (
                <>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={handleArriveAtStudent}
                  >
                    <Bell className="h-4 w-4" />
                    إشعار الوصول
                  </Button>
                  <Button
                    className="gap-2"
                    onClick={() => handleUpdateStudentStatus("picked_up")}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    تم الاستلام
                  </Button>
                </>
              )}
              {selectedStudent?.status === "arriving" && (
                <Button
                  className="gap-2 col-span-2"
                  onClick={() => handleUpdateStudentStatus("picked_up")}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  تم الاستلام
                </Button>
              )}
              {selectedStudent?.status === "picked_up" && (
                <Button
                  className="gap-2 col-span-2"
                  onClick={() => handleUpdateStudentStatus("dropped_off")}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  تم التوصيل
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
