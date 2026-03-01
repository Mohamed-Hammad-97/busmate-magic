import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompanyAuth } from "@/contexts/CompanyAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Building2, LogOut, Truck, FileText, Users, MapPin, Clock,
  CheckCircle, XCircle, User, Copy, Link2, Bus, Navigation,
  Shield, MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import seaterLogo from "@/assets/seater-logo.jpg";
import { useIsMobile } from "@/hooks/use-mobile";
import { GoogleMapsProvider } from "@/components/maps/GoogleMapsProvider";
import { CompanyLiveTracking } from "@/components/corporate/CompanyLiveTracking";
import { CompanyDriversView } from "@/components/corporate/CompanyDriversView";
import { CompanyAccountsManager } from "@/components/corporate/CompanyAccountsManager";
import { CompanyNotificationBell } from "@/components/corporate/CompanyNotificationBell";
import { CompanyChatView } from "@/components/corporate/CompanyChatView";

function useCompanyPortalData(action: string, token: string | null, options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: ["company-portal", action],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("company-portal-data", {
        body: { action },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    enabled: !!token,
    refetchInterval: options?.refetchInterval,
  });
}

export default function CompanyDashboard() {
  const { account, token, signOut } = useCompanyAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [comment, setComment] = useState("");

  const { data: linesData } = useCompanyPortalData("get-lines", token);
  const { data: invoicesData } = useCompanyPortalData("get-invoices", token);
  const { data: employeesData } = useCompanyPortalData("get-employees", token);
  const { data: trackingData } = useCompanyPortalData("get-live-trips", token, { refetchInterval: 5000 });
  const { data: driversData } = useCompanyPortalData("get-drivers", token);
  const { data: accountsData } = useCompanyPortalData("get-accounts", token);

  const lines = linesData?.lines || [];
  const invoices = invoicesData?.invoices || [];
  const employees = employeesData?.employees || [];
  const activeTrips = trackingData?.trips || [];
  const staff = driversData?.staff || [];
  const accounts = accountsData?.accounts || [];

  const updateInvoiceMutation = useMutation({
    mutationFn: async ({ id, status, comment }: { id: string; status: string; comment: string }) => {
      const { data, error } = await supabase.functions.invoke("company-portal-data", {
        body: { action: "update-invoice-approval", data: { invoice_id: id, status, comment } },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-portal", "get-invoices"] });
      toast.success("تم تحديث حالة الفاتورة");
      setInvoiceDialogOpen(false);
      setSelectedInvoice(null);
      setComment("");
    },
    onError: () => toast.error("حدث خطأ"),
  });

  const activeLines = lines.filter((l: any) => l.is_active).length;
  const pendingInvoices = invoices.filter((i: any) => i.company_approval_status === "pending").length;
  const formLink = `${window.location.origin}/company/register/${account?.company_id}`;

  const copyFormLink = () => {
    navigator.clipboard.writeText(formLink);
    toast.success("تم نسخ رابط التسجيل");
  };

  const getApprovalBadge = (status: string) => {
    switch (status) {
      case "approved": return <Badge className="bg-green-100 text-green-700 border-green-200">معتمدة</Badge>;
      case "rejected": return <Badge className="bg-red-100 text-red-700 border-red-200">مرفوضة</Badge>;
      default: return <Badge className="bg-amber-100 text-amber-700 border-amber-200">في الانتظار</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <img src={seaterLogo} alt="Seater" className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl shadow-md" />
            <div>
              <h1 className="text-base sm:text-lg font-bold text-foreground">Seater</h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground">بوابة الشركات</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <CompanyNotificationBell />
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium truncate max-w-[150px]">{account?.company_name}</p>
              <p className="text-xs text-muted-foreground">{account?.full_name}</p>
            </div>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive h-8 px-2 sm:px-3" onClick={signOut}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline mr-1">خروج</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 max-w-5xl">
        {/* Welcome Card */}
        <Card className="overflow-hidden border-0 shadow-xl rounded-2xl">
          <div className="h-20 sm:h-28 bg-gradient-to-r from-primary via-primary/80 to-primary/60 rounded-t-2xl" />
          <CardContent className="relative -mt-7 sm:-mt-9 pb-4 sm:pb-5 px-4 sm:px-5">
            <div className="flex items-end gap-3 sm:gap-4">
              <div className="h-14 w-14 sm:h-[72px] sm:w-[72px] rounded-2xl bg-background border-4 border-background shadow-xl flex items-center justify-center shrink-0">
                <Building2 className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
              </div>
              <div className="pb-0.5 min-w-0">
                <h2 className="text-lg sm:text-xl font-bold truncate">{account?.company_name}</h2>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs sm:text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-primary" />{account?.full_name}</span>
                  <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-primary" />{account?.company_city}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          <Card className="border-0 shadow-md bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="pt-3 sm:pt-4 pb-2 sm:pb-3 px-2 sm:px-4 text-center">
              <Truck className="h-4 w-4 sm:h-5 sm:w-5 mx-auto text-primary mb-1" />
              <div className="text-xl sm:text-2xl font-bold text-primary">{lines.length}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">خطوط</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/20">
            <CardContent className="pt-3 sm:pt-4 pb-2 sm:pb-3 px-2 sm:px-4 text-center">
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 mx-auto text-green-600 mb-1" />
              <div className="text-xl sm:text-2xl font-bold text-green-600">{activeLines}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">نشطة</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20">
            <CardContent className="pt-3 sm:pt-4 pb-2 sm:pb-3 px-2 sm:px-4 text-center">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5 mx-auto text-amber-600 mb-1" />
              <div className="text-xl sm:text-2xl font-bold text-amber-600">{pendingInvoices}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">فواتير معلقة</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20">
            <CardContent className="pt-3 sm:pt-4 pb-2 sm:pb-3 px-2 sm:px-4 text-center">
              <Bus className="h-4 w-4 sm:h-5 sm:w-5 mx-auto text-blue-600 mb-1" />
              <div className="text-xl sm:text-2xl font-bold text-blue-600">{activeTrips.length}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">رحلات نشطة</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="lines" className="space-y-4">
          <div className="overflow-x-auto -mx-3 px-3">
            <TabsList className="inline-flex h-11 sm:h-12 bg-muted/50 p-1 rounded-xl gap-1 min-w-max">
              <TabsTrigger value="lines" className="rounded-lg gap-1 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md px-3">
                <Truck className="h-4 w-4" /><span className="hidden sm:inline">الخطوط</span>
              </TabsTrigger>
              <TabsTrigger value="tracking" className="rounded-lg gap-1 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md px-3">
                <Navigation className="h-4 w-4" /><span className="hidden sm:inline">التتبع</span>
              </TabsTrigger>
              <TabsTrigger value="drivers" className="rounded-lg gap-1 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md px-3">
                <User className="h-4 w-4" /><span className="hidden sm:inline">الطاقم</span>
              </TabsTrigger>
              <TabsTrigger value="invoices" className="rounded-lg gap-1 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md px-3">
                <FileText className="h-4 w-4" /><span className="hidden sm:inline">الفواتير</span>
              </TabsTrigger>
              <TabsTrigger value="employees" className="rounded-lg gap-1 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md px-3">
                <Users className="h-4 w-4" /><span className="hidden sm:inline">الموظفون</span>
              </TabsTrigger>
              <TabsTrigger value="chat" className="rounded-lg gap-1 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md px-3">
                <MessageCircle className="h-4 w-4" /><span className="hidden sm:inline">المحادثات</span>
              </TabsTrigger>
              {account?.role === "admin" && (
                <TabsTrigger value="accounts" className="rounded-lg gap-1 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md px-3">
                  <Shield className="h-4 w-4" /><span className="hidden sm:inline">الحسابات</span>
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          {/* Lines Tab */}
          <TabsContent value="lines" className="space-y-4">
            {lines.length === 0 ? (
              <Card className="border-0 shadow-md">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Truck className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                  <p>لا توجد خطوط مسجلة</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {lines.map((line: any) => (
                  <Card key={line.id} className="border-0 shadow-md overflow-hidden">
                    <div className={`h-1 ${line.is_active ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-muted'}`} />
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <h3 className="font-bold text-base">{line.name}</h3>
                        {line.is_active ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">نشط</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">غير نشط</Badge>
                        )}
                      </div>
                      {line.route_details && <p className="text-sm text-muted-foreground">{line.route_details}</p>}
                      <div className="space-y-1.5 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{line.number_of_shifts} شفتات</span>
                          {line.shift_times && Array.isArray(line.shift_times) && line.shift_times.length > 0 && (
                            <span className="text-xs">({(line.shift_times as string[]).join(", ")})</span>
                          )}
                        </div>
                        {line.drivers && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="h-3.5 w-3.5" />
                            <span>السائق: {line.drivers.full_name}</span>
                          </div>
                        )}
                        {line.supervisors && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="h-3.5 w-3.5" />
                            <span>المشرف: {line.supervisors.full_name}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tracking Tab */}
          <TabsContent value="tracking" className="space-y-4">
            <GoogleMapsProvider>
              <CompanyLiveTracking trips={activeTrips} />
            </GoogleMapsProvider>
          </TabsContent>

          {/* Drivers Tab */}
          <TabsContent value="drivers" className="space-y-4">
            <CompanyDriversView staff={staff} />
          </TabsContent>

          {/* Invoices Tab */}
          <TabsContent value="invoices" className="space-y-4">
            {invoices.length === 0 ? (
              <Card className="border-0 shadow-md">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                  <p>لا توجد فواتير</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {invoices.map((inv: any) => (
                  <Card key={inv.id} className="border-0 shadow-md cursor-pointer hover:shadow-lg transition-shadow" onClick={() => { setSelectedInvoice(inv); setComment(inv.company_comment || ""); setInvoiceDialogOpen(true); }}>
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-sm">{inv.invoice_number}</h4>
                          {getApprovalBadge(inv.company_approval_status)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          الفترة: {format(new Date(inv.period_start), "dd/MM/yyyy")} - {format(new Date(inv.period_end), "dd/MM/yyyy")}
                        </p>
                      </div>
                      <div className="text-left shrink-0">
                        <div className="font-bold text-base text-primary">{Number(inv.total_amount).toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">ج.م</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Employees Tab */}
          <TabsContent value="employees" className="space-y-4">
            <Card className="border-0 shadow-md bg-gradient-to-r from-primary/5 to-primary/10">
              <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <Link2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm">رابط تسجيل الموظفين</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[250px]">{formLink}</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="gap-2 shrink-0" onClick={copyFormLink}>
                  <Copy className="h-4 w-4" />
                  نسخ الرابط
                </Button>
              </CardContent>
            </Card>
            {employees.length === 0 ? (
              <Card className="border-0 shadow-md">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                  <p className="font-medium mb-1">لا يوجد موظفون مسجلون</p>
                  <p className="text-sm">شارك رابط التسجيل مع موظفيك</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {employees.map((emp: any) => (
                  <Card key={emp.id} className="border-0 shadow-md">
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-sm">{emp.full_name}</h4>
                          {emp.is_active ? (
                            <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">نشط</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">غير نشط</Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          <span>{emp.phone}</span>
                          {emp.department && <span>• {emp.department}</span>}
                          {emp.company_lines?.name && <span>• {emp.company_lines.name}</span>}
                        </div>
                        {emp.pickup_address && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <MapPin className="h-3 w-3" />{emp.pickup_address}
                          </p>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground shrink-0">{format(new Date(emp.created_at), "dd/MM")}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent value="chat">
            <CompanyChatView />
          </TabsContent>

          {/* Accounts Tab */}
          {account?.role === "admin" && (
            <TabsContent value="accounts" className="space-y-4">
              <CompanyAccountsManager accounts={accounts} />
            </TabsContent>
          )}
        </Tabs>
      </main>

      {/* Invoice Review Dialog */}
      <Dialog open={invoiceDialogOpen} onOpenChange={(open) => { setInvoiceDialogOpen(open); if (!open) { setSelectedInvoice(null); setComment(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>مراجعة الفاتورة - {selectedInvoice?.invoice_number}</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">الفترة</p>
                  <p className="font-medium">{format(new Date(selectedInvoice.period_start), "dd/MM/yyyy")} - {format(new Date(selectedInvoice.period_end), "dd/MM/yyyy")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">المبلغ الإجمالي</p>
                  <p className="font-bold text-primary text-lg">{Number(selectedInvoice.total_amount).toLocaleString()} ج.م</p>
                </div>
                <div>
                  <p className="text-muted-foreground">حالة المراجعة</p>
                  {getApprovalBadge(selectedInvoice.company_approval_status)}
                </div>
                <div>
                  <p className="text-muted-foreground">حالة الدفع</p>
                  <Badge variant={selectedInvoice.status === "paid" ? "default" : "secondary"}>
                    {selectedInvoice.status === "paid" ? "مدفوعة" : selectedInvoice.status === "issued" ? "صادرة" : "مسودة"}
                  </Badge>
                </div>
              </div>

              {selectedInvoice.line_items && Array.isArray(selectedInvoice.line_items) && (selectedInvoice.line_items as any[]).length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">بنود الفاتورة</p>
                  <div className="border rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50"><tr><th className="text-right p-2">البند</th><th className="text-right p-2">المبلغ</th></tr></thead>
                      <tbody>
                        {(selectedInvoice.line_items as any[]).map((item: any, i: number) => (
                          <tr key={i} className="border-t">
                            <td className="p-2">{item.name || item.line_name || `بند ${i + 1}`}</td>
                            <td className="p-2 font-medium">{Number(item.amount || item.total || 0).toLocaleString()} ج.م</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">تعليق / ملاحظات</label>
                <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="أضف تعليقك على الفاتورة..." rows={3} />
              </div>

              {selectedInvoice.company_approval_status === "pending" && (
                <div className="flex gap-3">
                  <Button className="flex-1 gap-2 bg-green-600 hover:bg-green-700" onClick={() => updateInvoiceMutation.mutate({ id: selectedInvoice.id, status: "approved", comment })} disabled={updateInvoiceMutation.isPending}>
                    <CheckCircle className="h-4 w-4" />اعتماد الفاتورة
                  </Button>
                  <Button variant="destructive" className="flex-1 gap-2" onClick={() => updateInvoiceMutation.mutate({ id: selectedInvoice.id, status: "rejected", comment })} disabled={updateInvoiceMutation.isPending}>
                    <XCircle className="h-4 w-4" />رفض
                  </Button>
                </div>
              )}

              {selectedInvoice.company_approval_status !== "pending" && (
                <Button variant="outline" className="w-full" onClick={() => updateInvoiceMutation.mutate({ id: selectedInvoice.id, status: "pending", comment })} disabled={updateInvoiceMutation.isPending}>
                  إعادة فتح المراجعة
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
