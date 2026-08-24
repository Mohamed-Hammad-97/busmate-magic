import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Phone, MapPin, Bus, Search, ArrowRight } from "lucide-react";

interface RouteOption {
  id: string;
  name: string;
  schools?: { name: string } | null;
}

interface StudentRow {
  registration_id: string;
  pickup_order: number | null;
  registrations: {
    student_name: string;
    grade: string | null;
    status: string;
    parent_accounts: {
      parent_name: string;
      father_phone: string;
      mother_phone: string | null;
      pickup_address: string | null;
      pickup_latitude: number | null;
      pickup_longitude: number | null;
    } | null;
  } | null;
}

function CallButton({ label, phone }: { label: string; phone: string }) {
  return (
    <a href={`tel:${phone}`} className="flex-1">
      <Button variant="outline" size="sm" className="w-full gap-2 justify-start">
        <Phone className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="truncate text-xs">
          <span className="text-muted-foreground">{label}: </span>
          {phone}
        </span>
      </Button>
    </a>
  );
}

export function DriverStudentsList({ routes }: { routes: RouteOption[] }) {
  const { t } = useTranslation();
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(
    routes.length === 1 ? routes[0].id : null
  );
  const [search, setSearch] = useState("");

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["driver-route-students", selectedRouteId],
    queryFn: async () => {
      if (!selectedRouteId) return [];
      const { data, error } = await supabase
        .from("route_assignments")
        .select(
          `registration_id, pickup_order,
           registrations (
             student_name, grade, status,
             parent_accounts ( parent_name, father_phone, mother_phone, pickup_address, pickup_latitude, pickup_longitude )
           )`
        )
        .eq("route_id", selectedRouteId)
        .order("pickup_order", { ascending: true });
      if (error) throw error;
      return ((data || []) as unknown as StudentRow[]).filter(
        (r) => r.registrations && r.registrations.status !== "cancelled"
      );
    },
    enabled: !!selectedRouteId,
  });

  if (routes.length === 0) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="py-12 text-center text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
          {t("driverPortal.noRoutes")}
        </CardContent>
      </Card>
    );
  }

  if (!selectedRouteId) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground mb-3">{t("driverPortal.selectRouteStudents")}</p>
        {routes.map((route) => (
          <Card
            key={route.id}
            className="cursor-pointer hover:border-primary/30 transition-all border-0 shadow-sm hover:shadow-md"
            onClick={() => setSelectedRouteId(route.id)}
          >
            <CardContent className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bus className="h-4 w-4 text-primary" />
                </div>
                <span className="font-medium text-sm">{route.name}</span>
              </div>
              <span className="text-xs text-muted-foreground">{route.schools?.name}</span>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const term = search.trim().toLowerCase();
  const filtered = students.filter((s) => {
    if (!term) return true;
    return (
      s.registrations?.student_name?.toLowerCase().includes(term) ||
      s.registrations?.parent_accounts?.parent_name?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {routes.length > 1 && (
          <Button variant="ghost" size="sm" className="gap-1" onClick={() => setSelectedRouteId(null)}>
            <ArrowRight className="h-4 w-4 rtl:rotate-0 ltr:rotate-180" />
            {t("driverPortal.back")}
          </Button>
        )}
        <div className="relative flex-1">
          <Search className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("driverPortal.searchStudents")}
            className="ps-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-0 shadow-md">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            {t("driverPortal.noStudents")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => {
            const p = s.registrations?.parent_accounts;
            return (
              <Card key={s.registration_id} className="border-0 shadow-md">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{s.registrations?.student_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{p?.parent_name}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {s.registrations?.grade && (
                        <Badge variant="outline" className="text-[10px]">{s.registrations.grade}</Badge>
                      )}
                      {s.pickup_order != null && (
                        <Badge className="text-[10px]">#{s.pickup_order}</Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    {p?.father_phone && <CallButton label={t("driverPortal.fatherPhone")} phone={p.father_phone} />}
                    {p?.mother_phone && <CallButton label={t("driverPortal.motherPhone")} phone={p.mother_phone} />}
                  </div>

                  {(p?.pickup_address || (p?.pickup_latitude && p?.pickup_longitude)) && (
                    <div className="flex items-start gap-2 text-xs bg-muted/50 rounded-lg p-2">
                      <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        {p?.pickup_address && <p className="break-words">{p.pickup_address}</p>}
                        {p?.pickup_latitude && p?.pickup_longitude && (
                          <a
                            href={`https://www.google.com/maps?q=${p.pickup_latitude},${p.pickup_longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {t("driverPortal.openInMaps")}
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
