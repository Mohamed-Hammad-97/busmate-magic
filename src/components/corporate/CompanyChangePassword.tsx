import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { useCompanyAuth } from "@/contexts/CompanyAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Eye, EyeOff, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export function CompanyChangePassword() {
  const { t } = useTranslation();
  const { token } = useCompanyAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const changeMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("company-portal-data", {
        body: { action: "change-password", data: { current_password: currentPassword, new_password: newPassword } },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success(t("companyPortal.passwordChanged", "Password changed successfully"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err: Error) => {
      toast.error(err.message || t("companyPortal.passwordChangeError", "Failed to change password"));
    },
  });

  const canSubmit = currentPassword && newPassword.length >= 6 && newPassword === confirmPassword && !changeMutation.isPending;

  return (
    <div className="max-w-md mx-auto">
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lock className="h-5 w-5 text-primary" />
            {t("companyPortal.changePassword", "Change Password")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("companyPortal.currentPassword", "Current Password")}</Label>
            <div className="relative">
              <Input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="pr-10"
              />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("companyPortal.newPassword", "New Password")}</Label>
            <div className="relative">
              <Input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="pr-10"
              />
              <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {newPassword && newPassword.length < 6 && (
              <p className="text-xs text-destructive">{t("companyPortal.passwordMinLength", "Password must be at least 6 characters")}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t("companyPortal.confirmPassword", "Confirm New Password")}</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-destructive">{t("companyPortal.passwordMismatch", "Passwords do not match")}</p>
            )}
          </div>

          <Button onClick={() => changeMutation.mutate()} disabled={!canSubmit} className="w-full gap-2">
            {changeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            {t("companyPortal.changePassword", "Change Password")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
