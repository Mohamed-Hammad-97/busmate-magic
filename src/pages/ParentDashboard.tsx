import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParentAuth } from "@/contexts/ParentAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bus, LogOut, User, CreditCard, MapPin, School, Phone, Bell,
  CheckCircle, Clock, AlertCircle, Navigation, MessageCircle,
  CalendarOff, Wallet, Shield, Route, UserCircle, Car,
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { ParentLiveTracking } from "@/components/tracking/ParentLiveTracking";
import { GoogleMapsProvider } from "@/components/maps/GoogleMapsProvider";
import { ParentChat } from "@/components/chat/ParentChat";
import { SetPasswordDialog } from "@/components/chat/SetPasswordDialog";
import { AbsenceRegistration } from "@/components/parent/AbsenceRegistration";
import { useToast } from "@/hooks/use-toast";
import seaterLogo from "@/assets/seater-logo.jpg";

export default function ParentDashboard() {
  const { parentAccount, signOut, user } = useParentAuth();
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const checkPasswordStatus = async () => {
      if (!parentAccount?.id) return;
      const { data: account } = await supabase
        .from("parent_accounts")
        .select("has_password")
        .eq("id", parentAccount.id)
        .single();
      const { data: registrations } = await supabase
        .from("registrations")
        .select("status")
        .eq("parent_id", parentAccount.id);
      if (account && !account.has_password && registrations && registrations.length > 0) {
        setShowPasswordDialog(true);
      }
    };
    checkPasswordStatus();
  }, [parentAccount?.id]);

  const { data: registrations = [] } = useQuery({
    queryKey: ["parent-registrations", parentAccount?.id],
    queryFn: async () => {
      if (!parentAccount?.id) return [];
      const { data, error } = await supabase
        .from("registrations")
        .select(`
          *,
          schools (name, city),
          subscriptions (
            id, subscription_type, value, number_of_installments,
            payments (*)
          )
        `)
        .eq("parent_id", parentAccount.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!parentAccount?.id,
  });

  const { data: routeAssignments = [] } = useQuery({
    queryKey: ["parent-routes", parentAccount?.id],
    queryFn: async () => {
      if (!parentAccount?.id) return [];
      const regIds = registrations.map((r) => r.id);
      if (regIds.length === 0) return [];
      const { data, error } = await supabase
        .from("route_assignments")
        .select(`
          *,
          registrations (student_name),
          routes (
            name, car_type, max_seats,
            drivers (full_name, phone, license_number),
            supervisors (full_name, phone)
          )
        `)
        .in("registration_id", regIds);
      if (error) throw error;
      return data;
    },
    enabled: registrations.length > 0,
  });

  const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pending_fees: { label: "في انتظار الرسوم", variant: "secondary" },
    complete: { label: "مكتمل", variant: "default" },
    cancelled: { label: "ملغي", variant: "destructive" },
  };

  const paymentStatusLabels: Record<string, { label: string; icon: React.ReactNode }> = {
    paid: { label: "مدفوع", icon: <CheckCircle className="h-4 w-4 text-green-500" /> },
    pending: { label: "في الانتظار", icon: <Clock className="h-4 w-4 text-yellow-500" /> },
    overdue: { label: "متأخر", icon: <AlertCircle className="h-4 w-4 text-red-500" /> },
  };

  const paymentSummary = registrations.reduce(
    (acc, reg) => {
      const subscription = reg.subscriptions?.[0];
      if (subscription?.payments) {
        subscription.payments.forEach((p: any) => {
          acc.total += Number(p.amount);
          if (p.status === "paid") acc.paid += Number(p.amount);
          else acc.pending += Number(p.amount);
        });
      }
      return acc;
    },
    { total: 0, paid: 0, pending: 0 }
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Premium Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={seaterLogo} alt="Seater" className="h-10 w-10 rounded-xl shadow-md" />
            <div>
              <h1 className="text-lg font-bold text-foreground">Seater</h1>
              <p className="text-xs text-muted-foreground">بوابة ولي الأمر</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={signOut}
            >
              <LogOut className="h-4 w-4 ml-1" />
              خروج
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6 max-w-4xl">
        {/* Profile Card */}
        <Card className="overflow-hidden border-0 shadow-lg">
          <div className="h-24 bg-gradient-to-r from-primary to-primary/70 relative">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIi8+PC9zdmc+')] opacity-50" />
          </div>
          <CardContent className="relative -mt-10 pb-4">
            <div className="flex items-end gap-4">
              <div className="h-20 w-20 rounded-2xl bg-background border-4 border-background shadow-lg flex items-center justify-center">
                <UserCircle className="h-12 w-12 text-primary" />
              </div>
              <div className="pb-1">
                <h2 className="text-xl font-bold">{parentAccount?.parent_name}</h2>
                <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    {parentAccount?.father_phone}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {parentAccount?.city}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-0 shadow-md bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="pt-4 pb-3 px-4 text-center">
              <School className="h-5 w-5 mx-auto text-primary mb-1" />
              <div className="text-2xl font-bold text-primary">{registrations.length}</div>
              <p className="text-xs text-muted-foreground">طلاب مسجلين</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/20">
            <CardContent className="pt-4 pb-3 px-4 text-center">
              <CheckCircle className="h-5 w-5 mx-auto text-green-600 mb-1" />
              <div className="text-2xl font-bold text-green-600">{paymentSummary.paid.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">ج.م مدفوع</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20">
            <CardContent className="pt-4 pb-3 px-4 text-center">
              <CreditCard className="h-5 w-5 mx-auto text-amber-600 mb-1" />
              <div className="text-2xl font-bold text-amber-600">{paymentSummary.pending.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">ج.م متبقي</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="tracking" className="space-y-4">
          <TabsList className="grid w-full grid-cols-6 h-12 bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="tracking" className="rounded-lg gap-1 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">
              <Navigation className="h-4 w-4" />
              <span className="hidden sm:inline">التتبع</span>
            </TabsTrigger>
            <TabsTrigger value="children" className="rounded-lg text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">
              <School className="h-4 w-4 sm:hidden" />
              <span className="hidden sm:inline">أبنائي</span>
            </TabsTrigger>
            <TabsTrigger value="routes" className="rounded-lg text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">
              <Route className="h-4 w-4 sm:hidden" />
              <span className="hidden sm:inline">المسارات</span>
            </TabsTrigger>
            <TabsTrigger value="payments" className="rounded-lg text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">
              <Wallet className="h-4 w-4 sm:hidden" />
              <span className="hidden sm:inline">المدفوعات</span>
            </TabsTrigger>
            <TabsTrigger value="absences" className="rounded-lg gap-1 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">
              <CalendarOff className="h-4 w-4" />
              <span className="hidden sm:inline">الغياب</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="rounded-lg gap-1 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">
              <MessageCircle className="h-4 w-4" />
              <span className="hidden sm:inline">الدعم</span>
            </TabsTrigger>
          </TabsList>

          {/* Live Tracking Tab */}
          <TabsContent value="tracking">
            <GoogleMapsProvider>
              <ParentLiveTracking />
            </GoogleMapsProvider>
          </TabsContent>

          {/* Children Tab */}
          <TabsContent value="children" className="space-y-4">
            {registrations.length === 0 ? (
              <Card className="border-0 shadow-md">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <School className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                  <p>لا يوجد طلاب مسجلين</p>
                </CardContent>
              </Card>
            ) : (
              registrations.map((reg: any) => (
                <Card key={reg.id} className="border-0 shadow-md overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-primary to-primary/50" />
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
                          <User className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{reg.student_name}</CardTitle>
                          <CardDescription>{reg.schools?.name} - {reg.grade}</CardDescription>
                        </div>
                      </div>
                      <Badge variant={statusLabels[reg.status]?.variant || "secondary"}>
                        {statusLabels[reg.status]?.label || reg.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="p-2.5 bg-muted/50 rounded-lg">
                        <span className="text-muted-foreground text-xs block">نوع السيارة</span>
                        <span className="font-medium">{reg.car_type === "ac" ? "مكيف" : "بدون تكييف"}</span>
                      </div>
                      <div className="p-2.5 bg-muted/50 rounded-lg">
                        <span className="text-muted-foreground text-xs block">قسم التعليم</span>
                        <span className="font-medium">
                          {reg.education_department === "national" ? "وطني" : reg.education_department === "ig" ? "IG" : "أمريكي"}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Routes Tab - Enhanced with full details */}
          <TabsContent value="routes" className="space-y-4">
            {routeAssignments.length === 0 ? (
              <Card className="border-0 shadow-md">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Route className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                  <h3 className="font-semibold text-lg mb-1">لم يتم تعيين مسار بعد</h3>
                  <p className="text-sm">سيظهر هنا تفاصيل المسار عند تعيينه</p>
                </CardContent>
              </Card>
            ) : (
              routeAssignments.map((assignment: any) => (
                <Card key={assignment.id} className="border-0 shadow-md overflow-hidden">
                  {/* Route header */}
                  <div className="bg-gradient-to-r from-primary to-primary/80 p-4 text-primary-foreground">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
                        <Bus className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">{assignment.routes?.name}</h3>
                        <p className="text-sm text-primary-foreground/80">
                          الطالب: {assignment.registrations?.student_name}
                        </p>
                      </div>
                    </div>
                  </div>

                  <CardContent className="p-4 space-y-4">
                    {/* Route Info Pills */}
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="gap-1 px-3 py-1">
                        <Car className="h-3.5 w-3.5" />
                        {assignment.routes?.car_type === "ac" ? "سيارة مكيفة" : "بدون تكييف"}
                      </Badge>
                      {assignment.pickup_order && (
                        <Badge variant="secondary" className="gap-1 px-3 py-1">
                          ترتيب الاستلام: {assignment.pickup_order}
                        </Badge>
                      )}
                      {assignment.routes?.max_seats && (
                        <Badge variant="secondary" className="gap-1 px-3 py-1">
                          {assignment.routes.max_seats} مقعد
                        </Badge>
                      )}
                    </div>

                    {/* Driver & Supervisor Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {assignment.routes?.drivers && (
                        <div className="border rounded-xl p-4 bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-950/20">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                              <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">السائق</p>
                              <p className="font-semibold">{assignment.routes.drivers.full_name}</p>
                            </div>
                          </div>
                          <div className="space-y-2 text-sm">
                            <a
                              href={`tel:${assignment.routes.drivers.phone}`}
                              className="flex items-center gap-2 text-primary hover:underline"
                            >
                              <Phone className="h-3.5 w-3.5" />
                              {assignment.routes.drivers.phone}
                            </a>
                            {assignment.routes.drivers.license_number && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Car className="h-3.5 w-3.5" />
                                رخصة: {assignment.routes.drivers.license_number}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {assignment.routes?.supervisors && (
                        <div className="border rounded-xl p-4 bg-gradient-to-br from-purple-50/50 to-transparent dark:from-purple-950/20">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
                              <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">المشرفة</p>
                              <p className="font-semibold">{assignment.routes.supervisors.full_name}</p>
                            </div>
                          </div>
                          <div className="space-y-2 text-sm">
                            <a
                              href={`tel:${assignment.routes.supervisors.phone}`}
                              className="flex items-center gap-2 text-primary hover:underline"
                            >
                              <Phone className="h-3.5 w-3.5" />
                              {assignment.routes.supervisors.phone}
                            </a>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* No driver/supervisor assigned */}
                    {!assignment.routes?.drivers && !assignment.routes?.supervisors && (
                      <div className="p-4 bg-muted/50 rounded-xl text-center text-sm text-muted-foreground">
                        <AlertCircle className="h-5 w-5 mx-auto mb-2" />
                        لم يتم تعيين سائق أو مشرفة بعد
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="space-y-4">
            {registrations.map((reg: any) => {
              const subscription = reg.subscriptions?.[0];
              if (!subscription?.payments?.length) return null;

              return (
                <Card key={reg.id} className="border-0 shadow-md overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-green-500 to-emerald-500" />
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wallet className="h-5 w-5 text-green-600" />
                      {reg.student_name}
                    </CardTitle>
                    <CardDescription>
                      {subscription.subscription_type === "monthly" ? "اشتراك شهري" : "اشتراك سنوي"} -
                      إجمالي: {Number(subscription.value).toLocaleString()} ج.م
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">القسط</TableHead>
                          <TableHead className="text-right">المبلغ</TableHead>
                          <TableHead className="text-right">الاستحقاق</TableHead>
                          <TableHead className="text-right">الدفع</TableHead>
                          <TableHead className="text-right">الحالة</TableHead>
                          <TableHead className="text-right"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {subscription.payments
                          .sort((a: any, b: any) => a.installment_number - b.installment_number)
                          .map((payment: any) => (
                            <TableRow key={payment.id}>
                              <TableCell className="font-medium">{payment.installment_number}</TableCell>
                              <TableCell>{Number(payment.amount).toLocaleString()} ج.م</TableCell>
                              <TableCell className="text-xs">
                                {format(new Date(payment.due_date), "dd MMM yyyy", { locale: ar })}
                              </TableCell>
                              <TableCell className="text-xs">
                                {payment.paid_date
                                  ? format(new Date(payment.paid_date), "dd MMM yyyy", { locale: ar })
                                  : "-"}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5">
                                  {paymentStatusLabels[payment.status]?.icon}
                                  <span className="text-xs">{paymentStatusLabels[payment.status]?.label || payment.status}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                {payment.status !== "paid" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1 h-7 text-xs"
                                    onClick={() => toast({ title: "الدفع الإلكتروني", description: "سيتم تفعيل الدفع الإلكتروني قريباً" })}
                                  >
                                    <Wallet className="h-3 w-3" />
                                    ادفع
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="absences">
            <AbsenceRegistration />
          </TabsContent>

          <TabsContent value="chat">
            <ParentChat />
          </TabsContent>
        </Tabs>
      </main>

      <SetPasswordDialog
        open={showPasswordDialog}
        onOpenChange={setShowPasswordDialog}
        onSuccess={() => setShowPasswordDialog(false)}
      />
    </div>
  );
}
