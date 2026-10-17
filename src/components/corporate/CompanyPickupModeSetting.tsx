import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyAuth } from "@/contexts/CompanyAuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin } from "lucide-react";
import { toast } from "sonner";

type Mode = "line" | "custom" | "both";

export function CompanyPickupModeSetting() {
  const { account, token } = useCompanyAuth();
  const qc = useQueryClient();
  const canEdit =
    account?.role === "admin" || ((account as any)?.permissions || []).includes("manage_accounts");

  const { data: mode = "both" } = useQuery({
    queryKey: ["company-portal", "pickup-mode"],
    enabled: !!token,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("company-portal-data", {
        body: { action: "get-pickup-mode" },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error) throw error;
      return (data?.pickup_mode || "both") as Mode;
    },
  });

  const update = useMutation({
    mutationFn: async (pickup_mode: Mode) => {
      const { data, error } = await supabase.functions.invoke("company-portal-data", {
        body: { action: "update-pickup-mode", data: { pickup_mode } },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company-portal", "pickup-mode"] });
      toast.success("تم حفظ طريقة الالتقاط");
    },
    onError: (e: any) => toast.error(e.message || "حدث خطأ"),
  });

  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-sm">طريقة الالتقاط في نموذج التسجيل</p>
            <p className="text-xs text-muted-foreground">Pickup method in the registration form</p>
          </div>
        </div>
        <Select value={mode} onValueChange={(v) => update.mutate(v as Mode)} disabled={!canEdit || update.isPending}>
          <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="both">الاثنين (يختار الموظف) / Both</SelectItem>
            <SelectItem value="line">اختيار خط فقط / Select line</SelectItem>
            <SelectItem value="custom">نقطة التقاط مخصصة فقط / Custom pickup</SelectItem>
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
