import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useParentAuth } from "@/contexts/ParentAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bus, Navigation, LogOut, Loader2, ChevronRight } from "lucide-react";
import seaterLogo from "@/assets/seater-logo.jpg";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";

export default function ParentServiceSelector() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const navigate = useNavigate();
  const { parentAccount, signOut, isLoading } = useParentAuth();

  // School/other registrations
  const { data: registrations = [], isLoading: loadingRegs } = useQuery({
    queryKey: ["selector-registrations", parentAccount?.id],
    enabled: !!parentAccount,
    queryFn: async () => {
      const { data } = await supabase
        .from("registrations")
        .select("id")
        .eq("parent_id", parentAccount!.id)
        .limit(1);
      return data || [];
    },
  });

  // Daily line bookings (match by parent_id OR phone)
  const { data: dlBookings = [], isLoading: loadingDl } = useQuery({
    queryKey: ["selector-dl-bookings", parentAccount?.id],
    enabled: !!parentAccount,
    queryFn: async () => {
      if (!parentAccount) return [];
      const phones = [parentAccount.father_phone, parentAccount.mother_phone].filter(Boolean);
      const orParts: string[] = [`parent_id.eq.${parentAccount.id}`];
      phones.forEach((p) => orParts.push(`passenger_phone.eq.${p}`));
      const { data } = await supabase
        .from("daily_line_bookings")
        .select("id")
        .or(orParts.join(","))
        .limit(1);
      return data || [];
    },
  });

  const hasSchool = registrations.length > 0;
  const hasDailyLine = dlBookings.length > 0;
  const ready = !isLoading && !loadingRegs && !loadingDl && !!parentAccount;

  // Auto-redirect when only one service
  useEffect(() => {
    if (!ready) return;
    if (hasSchool && !hasDailyLine) navigate("/parent/dashboard", { replace: true });
    else if (!hasSchool && hasDailyLine) navigate("/daily-line/portal", { replace: true });
    // If neither, stay here and show empty state with both options
  }, [ready, hasSchool, hasDailyLine, navigate]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Both services exist OR neither (edge case) — show selector
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5" dir={isRtl ? "rtl" : "ltr"}>
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={seaterLogo} alt="Seater" className="h-9 w-9 rounded-lg object-cover" />
            <div>
              <h1 className="text-lg font-bold">{parentAccount?.parent_name}</h1>
              <p className="text-xs text-muted-foreground">{isRtl ? "اختر الخدمة" : "Choose a service"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">
            {isRtl ? "أهلاً بك مجدداً 👋" : "Welcome back 👋"}
          </h2>
          <p className="text-muted-foreground text-lg">
            {isRtl
              ? "لديك أكثر من خدمة. اختر الخدمة التي تريد الدخول إليها."
              : "You have more than one service. Pick the one you want to access."}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {/* School Bus / Subscriptions */}
          <Card
            className={`group cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1 border-2 ${
              hasSchool ? "hover:border-primary" : "opacity-60"
            }`}
            onClick={() => navigate("/parent/dashboard")}
          >
            <CardHeader>
              <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Bus className="h-7 w-7" />
              </div>
              <CardTitle className="flex items-center justify-between">
                {isRtl ? "اشتراكاتي" : "My Subscriptions"}
                <ChevronRight className={`h-5 w-5 text-muted-foreground ${isRtl ? "rotate-180" : ""}`} />
              </CardTitle>
              <CardDescription>
                {isRtl
                  ? "باص المدرسة، الشركات والخدمات الخاصة"
                  : "School bus, corporate & private services"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {hasSchool
                  ? isRtl
                    ? `${registrations.length === 1 ? "اشتراك نشط" : "اشتراكات نشطة"}`
                    : "Active subscriptions"
                  : isRtl
                  ? "لا يوجد اشتراك حالياً"
                  : "No active subscription"}
              </p>
            </CardContent>
          </Card>

          {/* Daily Line */}
          <Card
            className={`group cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1 border-2 ${
              hasDailyLine ? "hover:border-primary" : "opacity-60"
            }`}
            onClick={() => navigate("/daily-line/portal")}
          >
            <CardHeader>
              <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Navigation className="h-7 w-7" />
              </div>
              <CardTitle className="flex items-center justify-between">
                {isRtl ? "خطوط يومية" : "Daily Lines"}
                <ChevronRight className={`h-5 w-5 text-muted-foreground ${isRtl ? "rotate-180" : ""}`} />
              </CardTitle>
              <CardDescription>
                {isRtl ? "حجوزات الرحلات اليومية المجدولة" : "Pre-scheduled daily trip bookings"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {hasDailyLine
                  ? isRtl
                    ? "لديك حجوزات"
                    : "You have bookings"
                  : isRtl
                  ? "لم تقم بأي حجز بعد"
                  : "No bookings yet"}
              </p>
            </CardContent>
          </Card>
        </div>

        {!hasSchool && !hasDailyLine && (
          <p className="text-center text-sm text-muted-foreground mt-8">
            {isRtl
              ? "لم نجد أي اشتراكات أو حجوزات مرتبطة بحسابك."
              : "We couldn't find any subscriptions or bookings on your account."}
          </p>
        )}
      </main>
    </div>
  );
}
