import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParentAuth } from "@/contexts/ParentAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bus, LogOut, User, CreditCard, MapPin, School, Phone, Bell, CheckCircle, Clock, AlertCircle, Navigation, MessageCircle, Lock, CalendarOff, Wallet } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { ParentLiveTracking } from "@/components/tracking/ParentLiveTracking";
import { ParentChat } from "@/components/chat/ParentChat";
import { SetPasswordDialog } from "@/components/chat/SetPasswordDialog";
import { AbsenceRegistration } from "@/components/parent/AbsenceRegistration";
import { useToast } from "@/hooks/use-toast";

export default function ParentDashboard() {
  const { parentAccount, signOut, user } = useParentAuth();
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const { toast } = useToast();

  // Check if parent needs to set password (after subscription is verified)
  useEffect(() => {
    const checkPasswordStatus = async () => {
      if (!parentAccount?.id) return;
      
      // Check if parent has active subscription and no password
      const { data: account } = await supabase
        .from("parent_accounts")
        .select("has_password")
        .eq("id", parentAccount.id)
        .single();

      const { data: registrations } = await supabase
        .from("registrations")
        .select("status")
        .eq("parent_id", parentAccount.id);

      // Show password dialog if has active registration but no password
      if (account && !account.has_password && registrations && registrations.length > 0) {
        setShowPasswordDialog(true);
      }
    };

    checkPasswordStatus();
  }, [parentAccount?.id]);

  // Fetch registrations for this parent
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
            id,
            subscription_type,
            value,
            number_of_installments,
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

  // Fetch routes for this parent's registrations
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
          routes (
            name,
            car_type,
            drivers (full_name, phone),
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
    active: { label: "نشط", variant: "default" },
    cancelled: { label: "ملغي", variant: "destructive" },
    completed: { label: "مكتمل", variant: "outline" },
  };

  const paymentStatusLabels: Record<string, { label: string; icon: React.ReactNode }> = {
    paid: { label: "مدفوع", icon: <CheckCircle className="h-4 w-4 text-green-500" /> },
    pending: { label: "في الانتظار", icon: <Clock className="h-4 w-4 text-yellow-500" /> },
    overdue: { label: "متأخر", icon: <AlertCircle className="h-4 w-4 text-red-500" /> },
  };

  // Calculate payment summary
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground shadow-lg">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bus className="h-8 w-8" />
            <span className="text-xl font-bold">بوابة ولي الأمر</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/20">
              <Bell className="h-5 w-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-primary-foreground hover:bg-primary-foreground/20"
              onClick={signOut}
            >
              <LogOut className="h-4 w-4 ml-2" />
              خروج
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Welcome Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-8 w-8 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">مرحباً، {parentAccount?.parent_name}</CardTitle>
                <CardDescription className="flex items-center gap-4 mt-1">
                  <span className="flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    {parentAccount?.father_phone}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {parentAccount?.city}
                  </span>
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">عدد الطلاب</CardTitle>
              <School className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{registrations.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">المبلغ المدفوع</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{paymentSummary.paid.toLocaleString()} ج.م</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">المبلغ المتبقي</CardTitle>
              <CreditCard className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{paymentSummary.pending.toLocaleString()} ج.م</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="tracking" className="space-y-4">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="tracking" className="gap-1 text-xs sm:text-sm">
              <Navigation className="h-4 w-4" />
              <span className="hidden sm:inline">التتبع</span>
            </TabsTrigger>
            <TabsTrigger value="children" className="text-xs sm:text-sm">أبنائي</TabsTrigger>
            <TabsTrigger value="routes" className="text-xs sm:text-sm">المسارات</TabsTrigger>
            <TabsTrigger value="payments" className="text-xs sm:text-sm">المدفوعات</TabsTrigger>
            <TabsTrigger value="absences" className="gap-1 text-xs sm:text-sm">
              <CalendarOff className="h-4 w-4" />
              <span className="hidden sm:inline">الغياب</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="gap-1 text-xs sm:text-sm">
              <MessageCircle className="h-4 w-4" />
              <span className="hidden sm:inline">الدعم</span>
            </TabsTrigger>
          </TabsList>

          {/* Live Tracking Tab */}
          <TabsContent value="tracking">
            <ParentLiveTracking />
          </TabsContent>

          {/* Children Tab */}
          <TabsContent value="children" className="space-y-4">
            {registrations.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  لا يوجد طلاب مسجلين
                </CardContent>
              </Card>
            ) : (
              registrations.map((reg: any) => (
                <Card key={reg.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{reg.student_name}</CardTitle>
                        <CardDescription>
                          {reg.schools?.name} - {reg.grade}
                        </CardDescription>
                      </div>
                      <Badge variant={statusLabels[reg.status]?.variant || "secondary"}>
                        {statusLabels[reg.status]?.label || reg.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">نوع السيارة:</span>
                        <span className="mr-2">{reg.car_type === "ac" ? "مكيف" : "بدون تكييف"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">قسم التعليم:</span>
                        <span className="mr-2">
                          {reg.education_department === "national" ? "وطني" : reg.education_department === "ig" ? "IG" : "أمريكي"}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Routes Tab */}
          <TabsContent value="routes" className="space-y-4">
            {routeAssignments.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  لم يتم تعيين مسار بعد
                </CardContent>
              </Card>
            ) : (
              routeAssignments.map((assignment: any) => (
                <Card key={assignment.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bus className="h-5 w-5 text-primary" />
                      {assignment.routes?.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {assignment.routes?.drivers && (
                        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{assignment.routes.drivers.full_name}</p>
                            <p className="text-sm text-muted-foreground">السائق</p>
                            <a href={`tel:${assignment.routes.drivers.phone}`} className="text-sm text-primary">
                              {assignment.routes.drivers.phone}
                            </a>
                          </div>
                        </div>
                      )}
                      {assignment.routes?.supervisors && (
                        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{assignment.routes.supervisors.full_name}</p>
                            <p className="text-sm text-muted-foreground">المشرفة</p>
                            <a href={`tel:${assignment.routes.supervisors.phone}`} className="text-sm text-primary">
                              {assignment.routes.supervisors.phone}
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="text-sm">
                      <Badge variant="outline">
                        {assignment.routes?.car_type === "ac" ? "سيارة مكيفة" : "بدون تكييف"}
                      </Badge>
                    </div>
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
                <Card key={reg.id}>
                  <CardHeader>
                    <CardTitle>{reg.student_name}</CardTitle>
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
                          <TableHead className="text-right">تاريخ الاستحقاق</TableHead>
                          <TableHead className="text-right">تاريخ الدفع</TableHead>
                          <TableHead className="text-right">الحالة</TableHead>
                          <TableHead className="text-right">دفع</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {subscription.payments
                          .sort((a: any, b: any) => a.installment_number - b.installment_number)
                          .map((payment: any) => (
                          <TableRow key={payment.id}>
                            <TableCell>{payment.installment_number}</TableCell>
                            <TableCell>{Number(payment.amount).toLocaleString()} ج.م</TableCell>
                            <TableCell>
                              {format(new Date(payment.due_date), "dd MMM yyyy", { locale: ar })}
                            </TableCell>
                            <TableCell>
                              {payment.paid_date 
                                ? format(new Date(payment.paid_date), "dd MMM yyyy", { locale: ar })
                                : "-"
                              }
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {paymentStatusLabels[payment.status]?.icon}
                                <span>{paymentStatusLabels[payment.status]?.label || payment.status}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {payment.status !== "paid" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1"
                                  onClick={() => {
                                    toast({
                                      title: "الدفع الإلكتروني",
                                      description: "سيتم تفعيل الدفع الإلكتروني قريباً",
                                    });
                                  }}
                                >
                                  <Wallet className="h-3 w-3" />
                                  ادفع الآن
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

          {/* Absences Tab */}
          <TabsContent value="absences">
            <AbsenceRegistration />
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent value="chat">
            <ParentChat />
          </TabsContent>
        </Tabs>
      </main>

      {/* Set Password Dialog */}
      <SetPasswordDialog
        open={showPasswordDialog}
        onOpenChange={setShowPasswordDialog}
        onSuccess={() => setShowPasswordDialog(false)}
      />
    </div>
  );
}
