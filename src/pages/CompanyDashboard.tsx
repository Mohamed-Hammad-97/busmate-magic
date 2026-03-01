import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompanyAuth } from "@/contexts/CompanyAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Building2, Truck, FileText, Users, MapPin, Clock,
  CheckCircle, XCircle, User, Copy, Link2, Bus, Navigation,
  Menu,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { GoogleMapsProvider } from "@/components/maps/GoogleMapsProvider";
import { CompanyLiveTracking } from "@/components/corporate/CompanyLiveTracking";
import { CompanyDriversView } from "@/components/corporate/CompanyDriversView";
import { CompanyAccountsManager } from "@/components/corporate/CompanyAccountsManager";
import { CompanyNotificationBell } from "@/components/corporate/CompanyNotificationBell";
import { CompanyChatView } from "@/components/corporate/CompanyChatView";
import { CompanyPortalSidebar } from "@/components/corporate/CompanyPortalSidebar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import seaterLogo from "@/assets/seater-logo.jpg";

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
  const { account, token } = useCompanyAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
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
      toast.success("Invoice status updated");
      setInvoiceDialogOpen(false);
      setSelectedInvoice(null);
      setComment("");
    },
    onError: () => toast.error("An error occurred"),
  });

  const activeLines = lines.filter((l: any) => l.is_active).length;
  const pendingInvoices = invoices.filter((i: any) => i.company_approval_status === "pending").length;
  const formLink = `${window.location.origin}/company/register/${account?.company_id}`;

  const copyFormLink = () => {
    navigator.clipboard.writeText(formLink);
    toast.success("Registration link copied");
  };

  const getApprovalBadge = (status: string) => {
    switch (status) {
      case "approved": return <Badge className="bg-green-100 text-green-700 border-green-200">Approved</Badge>;
      case "rejected": return <Badge className="bg-red-100 text-red-700 border-red-200">Rejected</Badge>;
      default: return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Pending</Badge>;
    }
  };

  // Sidebar width for main content offset
  const sidebarOffset = isMobile ? "" : "pl-64";

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return (
          <div className="space-y-6">
            {/* Welcome Card - gradient with stats inside */}
            <Card className="overflow-hidden border-0 shadow-xl rounded-2xl bg-gradient-to-r from-primary via-primary/90 to-primary/70 text-primary-foreground">
              <CardContent className="p-5 sm:p-7">
                <div className="flex items-start gap-3 mb-5">
                  <div className="h-11 w-11 rounded-xl bg-primary-foreground/20 flex items-center justify-center shrink-0">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl sm:text-2xl font-bold truncate">Welcome, {account?.full_name}</h2>
                    <p className="text-sm text-primary-foreground/70 mt-0.5">Here's an overview of your transportation system</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  <div className="flex items-center gap-2 bg-primary-foreground/15 backdrop-blur-sm rounded-full px-4 py-2">
                    <Truck className="h-4 w-4" />
                    <span className="font-bold text-sm">{lines.length}</span>
                    <span className="text-xs text-primary-foreground/80">Lines</span>
                  </div>
                  <div className="flex items-center gap-2 bg-primary-foreground/15 backdrop-blur-sm rounded-full px-4 py-2">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-bold text-sm">{activeLines}</span>
                    <span className="text-xs text-primary-foreground/80">Active</span>
                  </div>
                  <div className="flex items-center gap-2 bg-primary-foreground/15 backdrop-blur-sm rounded-full px-4 py-2">
                    <FileText className="h-4 w-4" />
                    <span className="font-bold text-sm">{pendingInvoices}</span>
                    <span className="text-xs text-primary-foreground/80">Invoices</span>
                  </div>
                  <div className="flex items-center gap-2 bg-primary-foreground/15 backdrop-blur-sm rounded-full px-4 py-2">
                    <Bus className="h-4 w-4" />
                    <span className="font-bold text-sm">{activeTrips.length}</span>
                    <span className="text-xs text-primary-foreground/80">Trips</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case "lines":
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Transport Lines</h2>
            {lines.length === 0 ? (
              <Card className="border-0 shadow-md">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Truck className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                  <p>No lines registered</p>
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
                          <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">Active</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Inactive</Badge>
                        )}
                      </div>
                      {line.route_details && <p className="text-sm text-muted-foreground">{line.route_details}</p>}
                      <div className="space-y-1.5 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{line.number_of_shifts} shifts</span>
                          {line.shift_times && Array.isArray(line.shift_times) && line.shift_times.length > 0 && (
                            <span className="text-xs">({(line.shift_times as string[]).join(", ")})</span>
                          )}
                        </div>
                        {line.drivers && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="h-3.5 w-3.5" />
                            <span>Driver: {line.drivers.full_name}</span>
                          </div>
                        )}
                        {line.supervisors && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="h-3.5 w-3.5" />
                            <span>Supervisor: {line.supervisors.full_name}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        );

      case "tracking":
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Live Tracking</h2>
            <GoogleMapsProvider>
              <CompanyLiveTracking trips={activeTrips} />
            </GoogleMapsProvider>
          </div>
        );

      case "drivers":
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Drivers & Staff</h2>
            <CompanyDriversView staff={staff} />
          </div>
        );

      case "invoices":
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Invoices</h2>
            {invoices.length === 0 ? (
              <Card className="border-0 shadow-md">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                  <p>No invoices</p>
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
                          Period: {format(new Date(inv.period_start), "dd/MM/yyyy")} - {format(new Date(inv.period_end), "dd/MM/yyyy")}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-base text-primary">{Number(inv.total_amount).toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">EGP</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        );

      case "employees":
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Employees</h2>
            <Card className="border-0 shadow-md bg-gradient-to-r from-primary/5 to-primary/10">
              <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <Link2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm">Employee Registration Link</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[250px]">{formLink}</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="gap-2 shrink-0" onClick={copyFormLink}>
                  <Copy className="h-4 w-4" />
                  Copy Link
                </Button>
              </CardContent>
            </Card>
            {employees.length === 0 ? (
              <Card className="border-0 shadow-md">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                  <p className="font-medium mb-1">No registered employees</p>
                  <p className="text-sm">Share the registration link with your employees</p>
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
                            <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">Active</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
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
          </div>
        );

      case "chat":
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Chat</h2>
            <CompanyChatView />
          </div>
        );

      case "accounts":
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Accounts Management</h2>
            <CompanyAccountsManager accounts={accounts} />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background relative">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/[0.03] rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-primary/[0.03] rounded-full translate-y-1/3 -translate-x-1/4 blur-3xl" />
      </div>

      {/* Desktop Sidebar */}
      {!isMobile && <CompanyPortalSidebar activeTab={activeTab} onTabChange={setActiveTab} />}

      {/* Mobile Header */}
      {isMobile && (
        <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-[280px] border-0">
                  <CompanyPortalSidebar activeTab={activeTab} onTabChange={setActiveTab} onMobileNavigate={() => setMobileOpen(false)} />
                </SheetContent>
              </Sheet>
              <div className="flex items-center gap-2">
                <img src={seaterLogo} alt="Seater" className="h-8 w-8 rounded-lg object-cover" />
                <span className="font-bold text-foreground">Seater</span>
              </div>
            </div>
            <CompanyNotificationBell />
          </div>
        </header>
      )}

      <main className={cn("relative z-10 transition-all duration-300", isMobile ? "" : "pl-64")}>
        <div className={isMobile ? "p-4" : "p-8"}>
          {/* Desktop header bar */}
          {!isMobile && (
            <div className="flex items-center justify-end mb-6">
              <CompanyNotificationBell />
            </div>
          )}
          {renderContent()}
        </div>
      </main>

      {/* Invoice Review Dialog */}
      <Dialog open={invoiceDialogOpen} onOpenChange={(open) => { setInvoiceDialogOpen(open); if (!open) { setSelectedInvoice(null); setComment(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Invoice - {selectedInvoice?.invoice_number}</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Period</p>
                  <p className="font-medium">{format(new Date(selectedInvoice.period_start), "dd/MM/yyyy")} - {format(new Date(selectedInvoice.period_end), "dd/MM/yyyy")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Amount</p>
                  <p className="font-bold text-primary text-lg">{Number(selectedInvoice.total_amount).toLocaleString()} EGP</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Review Status</p>
                  {getApprovalBadge(selectedInvoice.company_approval_status)}
                </div>
                <div>
                  <p className="text-muted-foreground">Payment Status</p>
                  <Badge variant={selectedInvoice.status === "paid" ? "default" : "secondary"}>
                    {selectedInvoice.status === "paid" ? "Paid" : selectedInvoice.status === "issued" ? "Issued" : "Draft"}
                  </Badge>
                </div>
              </div>

              {selectedInvoice.line_items && Array.isArray(selectedInvoice.line_items) && (selectedInvoice.line_items as any[]).length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Invoice Items</p>
                  <div className="border rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50"><tr><th className="text-left p-2">Item</th><th className="text-left p-2">Amount</th></tr></thead>
                      <tbody>
                        {(selectedInvoice.line_items as any[]).map((item: any, i: number) => (
                          <tr key={i} className="border-t">
                            <td className="p-2">{item.name || item.line_name || `Item ${i + 1}`}</td>
                            <td className="p-2 font-medium">{Number(item.amount || item.total || 0).toLocaleString()} EGP</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Comment / Notes</label>
                <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add your comment on the invoice..." rows={3} />
              </div>

              {selectedInvoice.company_approval_status === "pending" && (
                <div className="flex gap-3">
                  <Button className="flex-1 gap-2 bg-green-600 hover:bg-green-700" onClick={() => updateInvoiceMutation.mutate({ id: selectedInvoice.id, status: "approved", comment })} disabled={updateInvoiceMutation.isPending}>
                    <CheckCircle className="h-4 w-4" />Approve
                  </Button>
                  <Button variant="destructive" className="flex-1 gap-2" onClick={() => updateInvoiceMutation.mutate({ id: selectedInvoice.id, status: "rejected", comment })} disabled={updateInvoiceMutation.isPending}>
                    <XCircle className="h-4 w-4" />Reject
                  </Button>
                </div>
              )}

              {selectedInvoice.company_approval_status !== "pending" && (
                <Button variant="outline" className="w-full" onClick={() => updateInvoiceMutation.mutate({ id: selectedInvoice.id, status: "pending", comment })} disabled={updateInvoiceMutation.isPending}>
                  Reopen Review
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
