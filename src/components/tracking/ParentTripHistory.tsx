import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { History, Loader2, School, Home, ArrowRight, ArrowDownToLine, Clock } from "lucide-react";

const PAGE_SIZE = 10;
const TZ = "Africa/Cairo";

type HistoryTrip = {
  id: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  routes?: { name: string | null; schools?: { name: string | null } | null } | null;
};

type StudentRow = {
  live_trip_id: string;
  registration_id: string;
  picked_up_at: string | null;
  dropped_off_at: string | null;
  status: string;
};

function cairoParts(iso: string) {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(d),
  );
  return { date, hour };
}

function fmtTime(iso: string | null, locale: string) {
  if (!iso) return null;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function fmtDay(dateKey: string, locale: string) {
  const d = new Date(`${dateKey}T12:00:00Z`);
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

interface Props {
  routeIds: string[];
  students: { id: string; student_name: string | null }[];
}

export function ParentTripHistory({ routeIds, students }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const [page, setPage] = useState(0);
  const limit = (page + 1) * PAGE_SIZE;
  const routeKey = routeIds.join(",");
  const registrationIds = students.map((s) => s.id);

  const { data: trips = [], isLoading } = useQuery({
    queryKey: ["parent-trip-history", routeKey, limit],
    enabled: routeIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_trips")
        .select("id, started_at, completed_at, created_at, routes(name, schools(name))")
        .in("route_id", routeIds)
        .eq("status", "completed")
        .order("started_at", { ascending: false, nullsFirst: false })
        .range(0, limit - 1);
      if (error) throw error;
      return (data || []) as unknown as HistoryTrip[];
    },
  });

  const tripIds = trips.map((tr) => tr.id);

  const { data: statuses = [] } = useQuery({
    queryKey: ["parent-trip-history-statuses", tripIds.join(","), registrationIds.join(",")],
    enabled: tripIds.length > 0 && registrationIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_student_status")
        .select("live_trip_id, registration_id, picked_up_at, dropped_off_at, status")
        .in("live_trip_id", tripIds)
        .in("registration_id", registrationIds);
      if (error) throw error;
      return (data || []) as StudentRow[];
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<string, HistoryTrip[]>();
    for (const trip of trips) {
      const ref = trip.started_at || trip.completed_at || trip.created_at;
      const { date } = cairoParts(ref);
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(trip);
    }
    return Array.from(map.entries());
  }, [trips]);

  const nameOf = (id: string) => students.find((s) => s.id === id)?.student_name || "—";

  if (routeIds.length === 0) return null;

  return (
    <Card className="border-0 shadow-md mt-4">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <History className="h-4 w-4 text-primary" />
          </div>
          <h3 className="font-bold text-base">{t("parentPortal.tripHistory.title")}</h3>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : grouped.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {t("parentPortal.tripHistory.empty")}
          </p>
        ) : (
          <div className="space-y-5">
            {grouped.map(([dateKey, dayTrips]) => (
              <div key={dateKey} className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground">
                  {fmtDay(dateKey, locale)}
                </div>
                {dayTrips.map((trip) => {
                  const ref = trip.started_at || trip.completed_at || trip.created_at;
                  const { hour } = cairoParts(ref);
                  const toSchool = hour < 12;
                  const rows = statuses.filter((s) => s.live_trip_id === trip.id);
                  return (
                    <div key={trip.id} className="rounded-xl border bg-card p-3 space-y-2.5 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge
                          variant="secondary"
                          className={
                            toSchool
                              ? "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-0 gap-1"
                              : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-0 gap-1"
                          }
                        >
                          {toSchool ? <School className="h-3 w-3" /> : <Home className="h-3 w-3" />}
                          {toSchool
                            ? t("parentPortal.tripHistory.toSchool")
                            : t("parentPortal.tripHistory.toHome")}
                        </Badge>
                        <span className="text-xs text-muted-foreground truncate max-w-full">
                          {trip.routes?.name}
                          {trip.routes?.schools?.name ? ` · ${trip.routes.schools.name}` : ""}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {t("parentPortal.tripHistory.started")}:{" "}
                          <span className="font-medium text-foreground tabular-nums">
                            {fmtTime(trip.started_at, locale) || "—"}
                          </span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {t("parentPortal.tripHistory.finished")}:{" "}
                          <span className="font-medium text-foreground tabular-nums">
                            {fmtTime(trip.completed_at, locale) || "—"}
                          </span>
                        </span>
                      </div>

                      {rows.length === 0 ? (
                        <div className="text-xs text-muted-foreground">
                          {t("parentPortal.tripHistory.noRecord")}
                        </div>
                      ) : (
                        <div className="space-y-1.5 pt-1 border-t">
                          {rows.map((row) => (
                            <div
                              key={row.registration_id + row.live_trip_id}
                              className="flex flex-wrap items-center justify-between gap-2 pt-1.5"
                            >
                              <span className="text-sm font-medium break-words">
                                {nameOf(row.registration_id)}
                              </span>
                              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                                <span className="flex items-center gap-1 text-green-700 dark:text-green-400">
                                  <ArrowRight className="h-3 w-3 rtl:rotate-180" />
                                  {t("parentPortal.tripHistory.pickedUp")}:{" "}
                                  <span className="tabular-nums font-medium">
                                    {fmtTime(row.picked_up_at, locale) || "—"}
                                  </span>
                                </span>
                                <span className="flex items-center gap-1 text-blue-700 dark:text-blue-400">
                                  <ArrowDownToLine className="h-3 w-3" />
                                  {t("parentPortal.tripHistory.droppedOff")}:{" "}
                                  <span className="tabular-nums font-medium">
                                    {fmtTime(row.dropped_off_at, locale) || "—"}
                                  </span>
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {trips.length >= limit && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setPage((p) => p + 1)}
              >
                {t("parentPortal.tripHistory.loadMore")}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
