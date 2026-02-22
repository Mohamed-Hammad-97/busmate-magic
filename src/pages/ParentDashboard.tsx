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
  ChevronLeft, Receipt, CircleDollarSign,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [selectedPaymentReg, setSelectedPaymentReg] = useState<any>(null);
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
        <Card className="overflow-hidden border-0 shadow-xl rounded-2xl">
          <div className="h-28 bg-gradient-to-r from-blue-600 via-blue-500 to-primary rounded-t-2xl" />
          <CardContent className="relative -mt-9 pb-5 px-5">
            <div className="flex items-end gap-4">
              <div className="h-[72px] w-[72px] rounded-2xl bg-background border-4 border-background shadow-xl flex items-center justify-center shrink-0">
                <UserCircle className="h-10 w-10 text-primary" />
              </div>
              <div className="pb-0.5 min-w-0">
                <h2 className="text-xl font-bold truncate">{parentAccount?.parent_name}</h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-primary" />
                    {parentAccount?.father_phone}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
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
          <TabsContent value="payments" className="space-y-3">
            {registrations.filter((r: any) => r.subscriptions?.[0]?.payments?.length).length === 0 ? (
              <Card className="border-0 shadow-md">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Wallet className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                  <p className="font-medium">لا توجد مدفوعات حالياً</p>
                </CardContent>
              </Card>
            ) : (
              registrations.map((reg: any) => {
                const subscription = reg.subscriptions?.[0];
                if (!subscription?.payments?.length) return null;
                const payments = subscription.payments;
                const paidCount = payments.filter((p: any) => p.status === "paid").length;
                const totalAmount = Number(subscription.value);
                const paidAmount = payments.filter((p: any) => p.status === "paid").reduce((s: number, p: any) => s + Number(p.amount), 0);
                const nextPayment = payments.filter((p: any) => p.status !== "paid").sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];

                return (
                  <Card
                    key={reg.id}
                    className="border-0 shadow-md hover:shadow-lg transition-all cursor-pointer overflow-hidden"
                    onClick={() => setSelectedPaymentReg(reg)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/20 flex items-center justify-center shrink-0">
                          <CircleDollarSign className="h-6 w-6 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">{reg.student_name}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {subscription.subscription_type === "monthly" ? "شهري" : "سنوي"} • {totalAmount.toLocaleString()} ج.م
                          </p>
                        </div>
                        <div className="text-left shrink-0">
                          <div className="text-sm font-bold text-green-600">{paidCount}/{payments.length}</div>
                          <p className="text-[10px] text-muted-foreground">أقساط مدفوعة</p>
                        </div>
                        <ChevronLeft className="h-5 w-5 text-muted-foreground/50 shrink-0" />
                      </div>
                      {/* Progress bar */}
                      <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all"
                          style={{ width: `${totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0}%` }}
                        />
                      </div>
                      {nextPayment && (
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          القسط القادم: {format(new Date(nextPayment.due_date), "dd MMM yyyy", { locale: ar })} - {Number(nextPayment.amount).toLocaleString()} ج.م
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* Payment Detail Dialog */}
          <Dialog open={!!selectedPaymentReg} onOpenChange={() => setSelectedPaymentReg(null)}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              {selectedPaymentReg && (() => {
                const subscription = selectedPaymentReg.subscriptions?.[0];
                const payments = subscription?.payments?.sort((a: any, b: any) => a.installment_number - b.installment_number) || [];
                return (
                  <>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/20 flex items-center justify-center">
                          <Receipt className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <div>{selectedPaymentReg.student_name}</div>
                          <p className="text-sm font-normal text-muted-foreground">
                            {subscription?.subscription_type === "monthly" ? "اشتراك شهري" : "اشتراك سنوي"} - {Number(subscription?.value).toLocaleString()} ج.م
                          </p>
                        </div>
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 mt-2">
                      {payments.map((payment: any) => (
                        <div
                          key={payment.id}
                          className={`p-4 rounded-xl border transition-all ${
                            payment.status === "paid"
                              ? "bg-green-50/50 border-green-200 dark:bg-green-950/20 dark:border-green-800/30"
                              : payment.status === "overdue"
                              ? "bg-red-50/50 border-red-200 dark:bg-red-950/20 dark:border-red-800/30"
                              : "bg-muted/30 border-border"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold">القسط {payment.installment_number}</span>
                              <Badge
                                variant={payment.status === "paid" ? "default" : payment.status === "overdue" ? "destructive" : "secondary"}
                                className="text-[10px] h-5"
                              >
                                {paymentStatusLabels[payment.status]?.icon}
                                <span className="mr-1">{paymentStatusLabels[payment.status]?.label}</span>
                              </Badge>
                            </div>
                            <span className="font-bold text-sm">{Number(payment.amount).toLocaleString()} ج.م</span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>الاستحقاق: {format(new Date(payment.due_date), "dd MMM yyyy", { locale: ar })}</span>
                            {payment.paid_date && (
                              <span>تم الدفع: {format(new Date(payment.paid_date), "dd MMM yyyy", { locale: ar })}</span>
                            )}
                          </div>
                          {payment.status !== "paid" && (
                            <Button
                              size="sm"
                              className="w-full mt-3 gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-md"
                              onClick={(e) => {
                                e.stopPropagation();
                                toast({ title: "الدفع الإلكتروني", description: "سيتم تفعيل الدفع الإلكتروني قريباً" });
                              }}
                            >
                              <Wallet className="h-4 w-4" />
                              ادفع الآن
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </DialogContent>
          </Dialog>

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
