import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParentAuth } from "@/contexts/ParentAuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CalendarOff, Trash2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ar, enGB } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

export function AbsenceRegistration() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const dateLocale = isAr ? ar : enGB;
  const { parentAccount } = useParentAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedRegistration, setSelectedRegistration] = useState<string>("");
  const [reason, setReason] = useState("");

  // Fetch registrations
  const { data: registrations = [] } = useQuery({
    queryKey: ["parent-registrations-absence", parentAccount?.id],
    queryFn: async () => {
      if (!parentAccount?.id) return [];
      const { data, error } = await supabase
        .from("registrations")
        .select("id, student_name, schools (name)")
        .eq("parent_id", parentAccount.id)
        .eq("status", "complete");
      if (error) throw error;
      return data;
    },
    enabled: !!parentAccount?.id,
  });

  // Fetch existing absences
  const { data: absences = [], isLoading } = useQuery({
    queryKey: ["parent-absences", parentAccount?.id],
    queryFn: async () => {
      if (!parentAccount?.id) return [];
      const { data, error } = await supabase
        .from("student_absences")
        .select("*, registrations (student_name)")
        .eq("parent_id", parentAccount.id)
        .order("absence_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!parentAccount?.id,
  });

  // Register absence
  const registerAbsence = useMutation({
    mutationFn: async () => {
      if (!selectedDate || !selectedRegistration || !parentAccount?.id) return;
      const { error } = await supabase.from("student_absences").insert({
        registration_id: selectedRegistration,
        parent_id: parentAccount.id,
        absence_date: format(selectedDate, "yyyy-MM-dd"),
        reason: reason || null,
      });
      if (error) {
        if (error.code === "23505") throw new Error(t("parentPortal.absenceDuplicate"));
        throw error;
      }
    },
    onSuccess: () => {
      toast({ title: t("parentPortal.absenceSaved") });
      setSelectedDate(undefined);
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["parent-absences"] });
    },
    onError: (error: Error) => {
      toast({ title: t("parentPortal.errorTitle"), description: error.message, variant: "destructive" });
    },
  });

  // Delete absence
  const deleteAbsence = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("student_absences").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: t("parentPortal.absenceCancelled") });
      queryClient.invalidateQueries({ queryKey: ["parent-absences"] });
    },
  });

  // Get absence dates for calendar highlighting
  const absenceDates = absences
    .filter((a: any) => !selectedRegistration || a.registration_id === selectedRegistration)
    .map((a: any) => new Date(a.absence_date));

  return (
    <div className="space-y-4">
      {/* Register Absence */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarOff className="h-5 w-5" />
            {t("parentPortal.registerAbsence")}
          </CardTitle>
          <CardDescription>{t("parentPortal.registerAbsenceDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={selectedRegistration} onValueChange={setSelectedRegistration}>
            <SelectTrigger>
              <SelectValue placeholder={t("parentPortal.selectStudent")} />
            </SelectTrigger>
            <SelectContent>
              {registrations.map((reg: any) => (
                <SelectItem key={reg.id} value={reg.id}>
                  {reg.student_name} - {reg.schools?.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
              modifiers={{ absent: absenceDates }}
              modifiersStyles={{ absent: { backgroundColor: "hsl(var(--destructive))", color: "white", borderRadius: "50%" } }}
              className="rounded-md border pointer-events-auto"
            />
          </div>

          <Textarea
            placeholder={t("parentPortal.absenceReasonPlaceholder")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
          />

          <Button
            className="w-full"
            onClick={() => registerAbsence.mutate()}
            disabled={!selectedDate || !selectedRegistration || registerAbsence.isPending}
          >
            {registerAbsence.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            {t("parentPortal.submitAbsence")}
          </Button>
        </CardContent>
      </Card>

      {/* Absence History */}
      <Card>
        <CardHeader>
          <CardTitle>{t("parentPortal.absencesLog")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : absences.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>{t("parentPortal.noAbsences")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {absences.map((absence: any) => (
                <div
                  key={absence.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-sm">{absence.registrations?.student_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(absence.absence_date), "EEEE dd MMMM yyyy", { locale: dateLocale })}
                    </p>
                    {absence.reason && (
                      <p className="text-xs text-muted-foreground mt-1">{absence.reason}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {new Date(absence.absence_date) >= new Date(new Date().setHours(0, 0, 0, 0)) ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteAbsence.mutate(absence.id)}
                        disabled={deleteAbsence.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    ) : (
                      <Badge variant="secondary">{t("parentPortal.absenceExpired")}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
