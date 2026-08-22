import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParentAuth } from "@/contexts/ParentAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Bus, LogOut, User, CreditCard, MapPin, School, Phone, Bell,
  CheckCircle, Clock, AlertCircle, Navigation, MessageCircle,
  CalendarOff, Wallet, Shield, Route, UserCircle, Car,
  ChevronLeft, Receipt, CircleDollarSign, LayoutDashboard, Settings2,
  TrendingUp, Camera, Loader2, Eye,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { ParentLiveTracking } from "@/components/tracking/ParentLiveTracking";
import { GoogleMapsProvider } from "@/components/maps/GoogleMapsProvider";
import { ParentChat } from "@/components/chat/ParentChat";
import { SetPasswordDialog } from "@/components/chat/SetPasswordDialog";
import { AbsenceRegistration } from "@/components/parent/AbsenceRegistration";
import { ContractsTab } from "@/components/parent/ContractsTab";
import { ContractDialog } from "@/components/parent/ContractDialog";
import { useParentContracts, buildContractData } from "@/hooks/useParentContracts";
import { FileSignature } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import seaterLogo from "@/assets/seater-logo.jpg";

export default function ParentDashboard() {
  const { t } = useTranslation();
  const { parentAccount, signOut, user } = useParentAuth();
  const queryClient = useQueryClient();
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [selectedPaymentReg, setSelectedPaymentReg] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [uploadingPhotoId, setUploadingPhotoId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const uploadPhotoMutation = useMutation({
    mutationFn: async ({ regId, file }: { regId: string; file: File }) => {
      setUploadingPhotoId(regId);
      const ext = file.name.split('.').pop();
      const filePath = `${parentAccount?.id}/${regId}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('student-photos')
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      // Store the storage path (not a public URL) since bucket is private
      const { error: updateError } = await supabase
        .from('registrations')
        .update({ student_photo_url: filePath } as any)
        .eq('id', regId);
      if (updateError) throw updateError;
      return filePath;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parent-registrations"] });
      toast({ title: "Photo uploaded", description: "Student photo has been updated" });
      setUploadingPhotoId(null);
    },
    onError: () => {
      toast({ title: "Upload failed", description: "Could not upload photo", variant: "destructive" });
      setUploadingPhotoId(null);
    },
  });

  const handlePhotoUpload = (regId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) uploadPhotoMutation.mutate({ regId, file });
    };
    input.click();
  };

  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  // Helper to get signed/legacy URL for a storage path

  const getPhotoUrl = (storagePath: string | null) => {
    if (!storagePath) return null;
    if (storagePath.startsWith('http')) return storagePath;
    return signedUrls[storagePath] || null;
  };

  const StudentAvatar = ({ reg, size = "md" }: { reg: any; size?: "sm" | "md" | "lg" }) => {
    const sizeClasses = size === "lg" ? "h-14 w-14" : size === "md" ? "h-11 w-11" : "h-9 w-9";
    const iconSize = size === "lg" ? "h-7 w-7" : size === "md" ? "h-5 w-5" : "h-4 w-4";
    const photoUrl = getPhotoUrl(reg.student_photo_url);
    if (photoUrl) {
      return (
        <img
          src={photoUrl}
          alt={reg.student_name}
          className={`${sizeClasses} rounded-xl object-cover border-2 border-background shadow shrink-0`}
        />
      );
    }
    return (
      <div className={`${sizeClasses} rounded-xl bg-primary/10 flex items-center justify-center shrink-0`}>
        <User className={`${iconSize} text-primary`} />
      </div>
    );
  };

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

  // Supabase may return the embedded subscription as an object (one-to-one) or an array
  const getSub = (reg: any) => (Array.isArray(reg?.subscriptions) ? reg.subscriptions[0] : reg?.subscriptions) || null;

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
            payments (*, payment_extra_fees (*))
          )

        `)
        .eq("parent_id", parentAccount.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Pre-generate signed URLs for all photos
      for (const reg of (data || [])) {
        if (reg.student_photo_url && !reg.student_photo_url.startsWith('http')) {
          supabase.storage.from('student-photos').createSignedUrl(reg.student_photo_url, 3600)
            .then(({ data: urlData }) => {
              if (urlData?.signedUrl) {
                setSignedUrls(prev => ({ ...prev, [reg.student_photo_url!]: urlData.signedUrl }));
              }
            });
        }
      }
      return data;
    },
    enabled: !!parentAccount?.id,
  });

  // Live updates when finance edits installments (fawry code, status, receipts)
  useEffect(() => {
    if (!parentAccount?.id) return;
    const channel = supabase
      .channel('parent-payments-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
        queryClient.invalidateQueries({ queryKey: ["parent-registrations", parentAccount.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [parentAccount?.id, queryClient]);


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
    pending_fees: { label: t('parentPortal.pendingFees'), variant: "secondary" },
    complete: { label: t('parentPortal.complete'), variant: "default" },
    cancelled: { label: t('parentPortal.cancelled'), variant: "destructive" },
  };

  const paymentStatusLabels: Record<string, { label: string; icon: React.ReactNode }> = {
    paid: { label: t('parentPortal.paid'), icon: <CheckCircle className="h-4 w-4 text-green-500" /> },
    pending: { label: t('parentPortal.pending'), icon: <Clock className="h-4 w-4 text-yellow-500" /> },
    overdue: { label: t('parentPortal.overdue'), icon: <AlertCircle className="h-4 w-4 text-red-500" /> },
  };

  // Installment helpers (mirrors the finance payment profile)
  const installmentLabel = (n: number) => {
    if (Number(n) === 0) return 'التأمين';
    const ordinals = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
    return `القسط ${ordinals[Number(n)] || Number(n)}`;
  };
  const effectiveStatus = (p: any) => {
    if (p.status === 'paid') return 'paid';
    if (p.status === 'archived') return 'archived';
    const due = new Date(p.due_date);
    due.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today ? 'overdue' : 'pending';
  };
  const extraFeesTotal = (p: any) =>
    (p.payment_extra_fees || []).reduce((s: number, f: any) => s + Number(f.amount || 0), 0);

  const activePaymentRegs = registrations.filter(
    (r: any) => r.status !== 'cancelled' && r.status !== 'archived'
  );


  const paymentSummary = registrations.reduce(
    (acc, reg) => {
      const subscription = getSub(reg);
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

  const navItems = [
    { key: "dashboard", label: t('parentPortal.dashboard'), icon: LayoutDashboard },
    { key: "tracking", label: t('parentPortal.tracking'), icon: Navigation },
    { key: "payments", label: t('parentPortal.payments'), icon: Wallet },
    { key: "children", label: t('parentPortal.myKids'), icon: School },
    { key: "routes", label: t('parentPortal.routes'), icon: Route },
    { key: "absences", label: t('parentPortal.absences'), icon: CalendarOff },
    { key: "contracts", label: "العقود", icon: FileSignature },
    { key: "chat", label: t('parentPortal.messages'), icon: MessageCircle },
  ];

  const { pending: pendingContracts, signMutation } = useParentContracts(
    registrations as any[],
    parentAccount?.id
  );
  const [contractIndex, setContractIndex] = useState(0);
  const currentPendingContract = pendingContracts[contractIndex] ?? pendingContracts[0] ?? null;


  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return (
          <div className="space-y-4 sm:space-y-5">
            {/* Welcome Card - gradient with stats */}
            <Card className="overflow-hidden border-0 shadow-xl rounded-2xl bg-gradient-to-r from-primary via-primary/90 to-primary/70 text-primary-foreground">
              <CardContent className="p-5 sm:p-7">
                <div className="flex items-start gap-3 mb-5">
                  <div className="h-11 w-11 rounded-xl bg-primary-foreground/20 flex items-center justify-center shrink-0">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl sm:text-2xl font-bold truncate">{t('parentPortal.welcome')}, {parentAccount?.parent_name}</h2>
                    <p className="text-sm text-primary-foreground/70 mt-0.5">{t('parentPortal.accountOverview')}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  <div className="flex items-center gap-2 bg-primary-foreground/15 backdrop-blur-sm rounded-full px-4 py-2">
                    <School className="h-4 w-4" />
                    <span className="font-bold text-sm">{registrations.length}</span>
                    <span className="text-xs text-primary-foreground/80">{t('parentPortal.students')}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-primary-foreground/15 backdrop-blur-sm rounded-full px-4 py-2">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-bold text-sm">{paymentSummary.paid.toLocaleString()}</span>
                    <span className="text-xs text-primary-foreground/80">{t('parentPortal.paid')}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-primary-foreground/15 backdrop-blur-sm rounded-full px-4 py-2">
                    <CreditCard className="h-4 w-4" />
                    <span className="font-bold text-sm">{paymentSummary.pending.toLocaleString()}</span>
                    <span className="text-xs text-primary-foreground/80">{t('parentPortal.remaining')}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Current Route Status */}
            {routeAssignments.length > 0 && routeAssignments[0]?.routes && (
              <Card className="border-0 shadow-md overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-green-500 to-emerald-500" />
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs font-semibold text-green-600 uppercase tracking-wider">{t('parentPortal.currentRouteStatus')}</span>
                  </div>
                  <h3 className="font-bold text-base sm:text-lg">
                    {routeAssignments[0].routes?.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('parentPortal.student')}: {routeAssignments[0].registrations?.student_name}
                    {routeAssignments[0].routes?.drivers && ` • ${t('parentPortal.driverLabel')}: ${routeAssignments[0].routes.drivers.full_name}`}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Next Payment Due */}
            {(() => {
              const nextPayment = registrations
                .flatMap((r: any) => getSub(r)?.payments || [])
                .filter((p: any) => p.status !== "paid")
                .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];
              if (!nextPayment) return null;
              return (
                <Card className="border-0 shadow-md overflow-hidden">
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Receipt className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-semibold text-sm sm:text-base">{t('parentPortal.nextPaymentDue')}</h4>
                        <p className="text-xs text-muted-foreground truncate">
                          {Number(nextPayment.amount).toLocaleString()} EGP • Due {format(new Date(nextPayment.due_date), "dd MMM")}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="shrink-0 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-md text-xs sm:text-sm"
                      onClick={() => toast({ title: t('parentPortal.onlinePayment'), description: t('parentPortal.onlinePaymentSoon') })}
                    >
                      <Wallet className="h-3.5 w-3.5 mr-1" />
                      {t('parentPortal.payNow')}
                    </Button>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Registered Children */}
            <div>
              <h3 className="font-bold text-base mb-3 flex items-center gap-2">
                <School className="h-4 w-4 text-primary" />
                {t('parentPortal.registeredChildren')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {registrations.map((reg: any) => (
                  <Card key={reg.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4 flex items-center gap-3">
                      <StudentAvatar reg={reg} />
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-sm truncate">{reg.student_name}</h4>
                        <p className="text-xs text-muted-foreground truncate">{reg.schools?.name} - {reg.grade}</p>
                      </div>
                      <Badge variant={statusLabels[reg.status]?.variant || "secondary"} className="text-[10px] shrink-0">
                        {statusLabels[reg.status]?.label || reg.status}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        );

      case "tracking":
        return (
          <GoogleMapsProvider>
            <ParentLiveTracking />
          </GoogleMapsProvider>
        );

      case "children":
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">{t('parentPortal.myKidsTitle')}</h2>
            {registrations.length === 0 ? (
              <Card className="border-0 shadow-md">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <School className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                  <p>{t('parentPortal.noStudents')}</p>
                </CardContent>
              </Card>
            ) : (
              registrations.map((reg: any) => (
                <Card key={reg.id} className="border-0 shadow-md overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-primary to-primary/50" />
                  <CardHeader className="pb-2 px-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {/* Photo with upload overlay */}
                        <div className="relative group cursor-pointer" onClick={() => handlePhotoUpload(reg.id)}>
                          <StudentAvatar reg={reg} size="md" />
                          <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            {uploadingPhotoId === reg.id ? (
                              <Loader2 className="h-4 w-4 text-white animate-spin" />
                            ) : (
                              <Camera className="h-4 w-4 text-white" />
                            )}
                          </div>
                        </div>
                        <div>
                          <CardTitle className="text-sm sm:text-base">{reg.student_name}</CardTitle>
                          <CardDescription className="text-xs sm:text-sm">{reg.schools?.name} - {reg.grade}</CardDescription>
                        </div>
                      </div>
                      <Badge variant={statusLabels[reg.status]?.variant || "secondary"}>
                        {statusLabels[reg.status]?.label || reg.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 sm:px-6">
                    <div className="grid grid-cols-2 gap-2 sm:gap-3 text-sm">
                      <div className="p-2 sm:p-2.5 bg-muted/50 rounded-lg">
                        <span className="text-muted-foreground text-[10px] sm:text-xs block">{t('parentPortal.carType')}</span>
                        <span className="font-medium text-xs sm:text-sm">{reg.car_type === "ac" ? t('parentPortal.ac') : t('parentPortal.nonAc')}</span>
                      </div>
                      <div className="p-2 sm:p-2.5 bg-muted/50 rounded-lg">
                        <span className="text-muted-foreground text-[10px] sm:text-xs block">{t('parentPortal.department')}</span>
                        <span className="font-medium text-xs sm:text-sm">
                          {reg.education_department === "national" ? t('parentPortal.national') : reg.education_department === "ig" ? t('parentPortal.ig') : t('parentPortal.american')}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        );

      case "routes":
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">{t('parentPortal.routesTitle')}</h2>
            {routeAssignments.length === 0 ? (
              <Card className="border-0 shadow-md">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Route className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                  <h3 className="font-semibold text-lg mb-1">{t('parentPortal.noRouteAssigned')}</h3>
                  <p className="text-sm">{t('parentPortal.routeDetailsAppear')}</p>
                </CardContent>
              </Card>
            ) : (
              routeAssignments.map((assignment: any) => (
                <Card key={assignment.id} className="border-0 shadow-md overflow-hidden">
                  <div className="bg-gradient-to-r from-primary to-primary/80 p-3 sm:p-4 text-primary-foreground">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
                        <Bus className="h-5 w-5 sm:h-6 sm:w-6" />
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-bold">{assignment.routes?.name}</h3>
                        <p className="text-xs sm:text-sm text-primary-foreground/80">
                          {t('parentPortal.student')}: {assignment.registrations?.student_name}
                        </p>
                      </div>
                    </div>
                  </div>

                  <CardContent className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="gap-1 px-2 sm:px-3 py-1 text-xs">
                        <Car className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        {assignment.routes?.car_type === "ac" ? t('parentPortal.acCar') : t('parentPortal.nonAc')}
                      </Badge>
                      {assignment.pickup_order && (
                        <Badge variant="secondary" className="gap-1 px-2 sm:px-3 py-1 text-xs">
                          Order: {assignment.pickup_order}
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {assignment.routes?.drivers && (
                        <div className="border rounded-xl p-3 sm:p-4 bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-950/20">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                                <User className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div>
                                <p className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wider">{t('parentPortal.driver')}</p>
                                <p className="font-semibold text-sm">{assignment.routes.drivers.full_name}</p>
                              </div>
                            </div>
                            <a
                              href={`tel:${assignment.routes.drivers.phone}`}
                              className="h-9 w-9 flex items-center justify-center rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
                            >
                              <Phone className="h-4 w-4 text-primary" />
                            </a>
                          </div>
                        </div>
                      )}

                      {assignment.routes?.supervisors && (
                        <div className="border rounded-xl p-3 sm:p-4 bg-gradient-to-br from-purple-50/50 to-transparent dark:from-purple-950/20">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
                                <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400" />
                              </div>
                              <div>
                                <p className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wider">{t('parentPortal.supervisor')}</p>
                                <p className="font-semibold text-sm">{assignment.routes.supervisors.full_name}</p>
                              </div>
                            </div>
                            <a
                              href={`tel:${assignment.routes.supervisors.phone}`}
                              className="h-9 w-9 flex items-center justify-center rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
                            >
                              <Phone className="h-4 w-4 text-primary" />
                            </a>
                          </div>
                        </div>
                      )}
                    </div>

                    {!assignment.routes?.drivers && !assignment.routes?.supervisors && (
                      <div className="p-4 bg-muted/50 rounded-xl text-center text-sm text-muted-foreground">
                        <AlertCircle className="h-5 w-5 mx-auto mb-2" />
                        {t('parentPortal.noStaffAssigned')}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        );

      case "payments":
        return (
          <div className="space-y-5">
            {/* Header */}
            <div>
              <h2 className="text-xl sm:text-2xl font-bold">{t('parentPortal.subscriptionPayments')}</h2>
              <p className="text-sm text-muted-foreground mt-1">{t('parentPortal.subscriptionDesc')}</p>
            </div>

            {/* Active Child Subscriptions */}
            <div>
              <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
                <School className="h-4 w-4 text-primary" />
                {t('parentPortal.activeChildSubscriptions')}
              </h3>
              {activePaymentRegs.length === 0 ? (
                <Card className="border-0 shadow-md">
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Wallet className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                    <p className="font-medium">{t('parentPortal.noSubscriptions')}</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activePaymentRegs.map((reg: any) => {
                    const subscription = getSub(reg);
                    const payments = (subscription?.payments || []).filter((p: any) => p.status !== 'archived');
                    const paidCount = payments.filter((p: any) => p.status === "paid").length;
                    const total = payments.reduce((s: number, p: any) => s + Number(p.amount || 0) + extraFeesTotal(p), 0);
                    const paidAmount = payments
                      .filter((p: any) => p.status === 'paid')
                      .reduce((s: number, p: any) => s + Number(p.amount || 0) + extraFeesTotal(p), 0);
                    const routeAssignment = routeAssignments.find((ra: any) => ra.registration_id === reg.id);

                    return (
                      <Card
                        key={reg.id}
                        className={`border-0 shadow-md transition-all overflow-hidden ${payments.length ? 'hover:shadow-lg cursor-pointer' : ''}`}
                        onClick={() => payments.length ? setSelectedPaymentReg(reg) : null}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3 mb-3">
                            <StudentAvatar reg={reg} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-sm truncate">{reg.student_name}</h4>
                                <Badge variant={subscription ? "default" : "secondary"} className="text-[10px] shrink-0">
                                  {subscription?.subscription_type === "monthly" ? t('parentPortal.monthly') : subscription?.subscription_type === "yearly" ? t('parentPortal.yearly') : t('parentPortal.active')}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                {routeAssignment?.routes?.name || reg.schools?.name || "—"}
                              </p>
                            </div>
                          </div>
                          {payments.length > 0 ? (
                            <>
                              <div className="grid grid-cols-3 gap-2 text-xs">
                                <div>
                                  <span className="text-muted-foreground">الإجمالي</span>
                                  <p className="font-semibold">{total.toLocaleString()} EGP</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">المدفوع</span>
                                  <p className="font-semibold text-green-600">{paidAmount.toLocaleString()} EGP</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">المتبقي</span>
                                  <p className="font-semibold text-amber-600">{(total - paidAmount).toLocaleString()} EGP</p>
                                </div>
                              </div>
                              <div className="mt-3">
                                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                  <div
                                    className="h-full bg-green-500 rounded-full transition-all"
                                    style={{ width: `${total > 0 ? Math.round((paidAmount / total) * 100) : 0}%` }}
                                  />
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-1">
                                  {paidCount}/{payments.length} {t('parentPortal.paidOf')}
                                </p>
                              </div>
                            </>
                          ) : (
                            <p className="text-xs text-muted-foreground">لم يتم تفعيل خطة الدفع بعد</p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

            </div>

            {/* Recent Transactions */}
            {(() => {
              const allPayments = registrations.flatMap((reg: any) => {
                const subscription = getSub(reg);
                return (subscription?.payments || []).map((p: any) => ({ ...p, studentName: reg.student_name }));
              }).sort((a: any, b: any) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime());

              if (allPayments.length === 0) return null;

              return (
                <div>
                  <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-primary" />
                    {t('parentPortal.recentTransactions')}
                  </h3>
                  <Card className="border-0 shadow-md overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/30">
                            <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">{t('parentPortal.date')}</th>
                            <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">{t('parentPortal.description')}</th>
                            <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">{t('parentPortal.amount')}</th>
                            <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">{t('parentPortal.status')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {allPayments.slice(0, 5).map((payment: any) => (
                            <tr key={payment.id} className="hover:bg-muted/20 transition-colors">
                              <td className="p-3 text-xs text-muted-foreground">{format(new Date(payment.due_date), "MMM dd, yyyy")}</td>
                              <td className="p-3 text-xs font-medium">{payment.studentName} - {t('parentPortal.installment')} {payment.installment_number}</td>
                              <td className="p-3 text-xs font-semibold">{Number(payment.amount).toLocaleString()} EGP</td>
                              <td className="p-3">
                                <Badge
                                  variant={payment.status === "paid" ? "default" : payment.status === "overdue" ? "destructive" : "secondary"}
                                  className="text-[10px]"
                                >
                                  {paymentStatusLabels[payment.status]?.label || payment.status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>
              );
            })()}

            {/* Make a Payment */}
            {(() => {
              const nextPayment = registrations
                .flatMap((r: any) => getSub(r)?.payments || [])
                .filter((p: any) => p.status !== "paid")
                .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];
              if (!nextPayment) return null;
              return (
                <Card className="border-0 shadow-md">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-base">{t('parentPortal.makePayment')}</h3>
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                        <Shield className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="mb-4">
                      <p className="text-xs text-muted-foreground">{t('parentPortal.upcomingTotal')}</p>
                      <p className="text-2xl sm:text-3xl font-bold">{Number(nextPayment.amount).toLocaleString()} EGP</p>
                      <p className="text-xs text-muted-foreground mt-1">{t('parentPortal.dueBy')} {format(new Date(nextPayment.due_date), "MMMM dd, yyyy")}</p>
                    </div>
                    <Button
                      className="w-full gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-md"
                      onClick={() => toast({ title: t('parentPortal.onlinePayment'), description: t('parentPortal.onlinePaymentSoon') })}
                    >
                      <Wallet className="h-4 w-4" />
                      {t('parentPortal.payNow')}
                    </Button>
                  </CardContent>
                </Card>
              );
            })()}
          </div>
        );

      case "absences":
        return <AbsenceRegistration />;

      case "contracts":
        return (
          <ContractsTab
            registrations={registrations as any[]}
            parentId={parentAccount?.id}
            parentName={parentAccount?.parent_name}
          />
        );


      case "chat":
        return <ParentChat />;

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Top Navbar - BusTrack style */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <img src={seaterLogo} alt="Seater" className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl shadow-md" />
            <div>
              <h1 className="text-base sm:text-lg font-bold text-foreground">Seater</h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground">{t('parentPortal.portalName')}</p>
            </div>
          </div>

          {/* Desktop nav tabs */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === item.key
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium truncate max-w-[120px]">{parentAccount?.parent_name}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive h-8 px-2 sm:px-3"
              onClick={signOut}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Mobile bottom-style nav inside header for scrollable tabs */}
        <div className="md:hidden border-t overflow-x-auto">
          <div className="flex items-center gap-0.5 px-2 py-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  onClick={() => setActiveTab(item.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
                    activeTab === item.key
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
        {renderContent()}
      </main>

      {/* Mandatory contract signing */}
      <ContractDialog
        key={currentPendingContract?.id}
        open={!!currentPendingContract && !showPasswordDialog}
        onOpenChange={() => {}}
        allowLater={false}
        contract={currentPendingContract ? buildContractData(currentPendingContract) : null}
        parentName={parentAccount?.parent_name}
        index={contractIndex}
        total={pendingContracts.length}
        isSaving={signMutation.isPending}
        onSign={(signatureName) =>
          signMutation.mutate(
            { reg: currentPendingContract, signatureName },
            {
              onSuccess: () => {
                toast({ title: "تم التوقيع", description: "تم حفظ موافقتك على العقد بنجاح" });
                setContractIndex(0);
              },
              onError: () => toast({ title: "تعذر حفظ التوقيع", variant: "destructive" }),
            }
          )
        }
      />



      {/* Payment Detail Dialog */}
      <Dialog open={!!selectedPaymentReg} onOpenChange={() => setSelectedPaymentReg(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto mx-2 sm:mx-auto">
          {selectedPaymentReg && (() => {
            const subscription = getSub(selectedPaymentReg);
            const payments = [...(subscription?.payments || [])]
              .filter((p: any) => p.status !== 'archived')
              .sort((a: any, b: any) => a.installment_number - b.installment_number);
            const total = payments.reduce((s: number, p: any) => s + Number(p.amount || 0) + extraFeesTotal(p), 0);
            const paidAmount = payments
              .filter((p: any) => p.status === 'paid')
              .reduce((s: number, p: any) => s + Number(p.amount || 0) + extraFeesTotal(p), 0);
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
                        {subscription?.subscription_type === "monthly" ? "Monthly" : "Yearly"} - {Number(subscription?.value).toLocaleString()} EGP
                      </p>
                    </div>
                  </DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                  <div className="rounded-xl border bg-muted/30 p-2">
                    <p className="text-[10px] text-muted-foreground">الإجمالي</p>
                    <p className="text-sm font-bold">{total.toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl border bg-green-50/50 dark:bg-green-950/20 p-2">
                    <p className="text-[10px] text-muted-foreground">المدفوع</p>
                    <p className="text-sm font-bold text-green-600">{paidAmount.toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl border bg-amber-50/50 dark:bg-amber-950/20 p-2">
                    <p className="text-[10px] text-muted-foreground">المتبقي</p>
                    <p className="text-sm font-bold text-amber-600">{(total - paidAmount).toLocaleString()}</p>
                  </div>
                </div>
                <div className="space-y-3 mt-2">
                  {payments.map((payment: any) => {
                    const st = effectiveStatus(payment);
                    const fees = extraFeesTotal(payment);
                    return (
                    <div
                      key={payment.id}
                      className={`p-3 sm:p-4 rounded-xl border transition-all ${
                        st === "paid"
                          ? "bg-green-50/50 border-green-200 dark:bg-green-950/20 dark:border-green-800/30"
                          : st === "overdue"
                          ? "bg-red-50/50 border-red-200 dark:bg-red-950/20 dark:border-red-800/30"
                          : "bg-muted/30 border-border"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm font-semibold">{installmentLabel(payment.installment_number)}</span>
                          <Badge
                            variant={st === "paid" ? "default" : st === "overdue" ? "destructive" : "secondary"}
                            className="text-[10px] h-5"
                          >
                            {paymentStatusLabels[st]?.icon}
                            <span className="ml-1">{paymentStatusLabels[st]?.label}</span>
                          </Badge>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-xs sm:text-sm">{Number(payment.amount).toLocaleString()} EGP</span>
                          {fees > 0 && (
                            <p className="text-[10px] text-amber-600">+ رسوم إضافية {fees.toLocaleString()} EGP</p>
                          )}
                        </div>
                      </div>
                      {payment.fawry_reference_code && (
                        <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1.5">
                          <div className="min-w-0">
                            <p className="text-[10px] text-muted-foreground">كود فوري</p>
                            <p className="text-xs font-bold font-mono truncate" dir="ltr">{payment.fawry_reference_code}</p>
                            {payment.fawry_note && (
                              <p className="text-[10px] text-muted-foreground truncate">{payment.fawry_note}</p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[10px] shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(payment.fawry_reference_code);
                              toast({ title: 'تم نسخ الكود' });
                            }}
                          >
                            نسخ
                          </Button>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground">
                        <span>{t('parentPortal.due')}: {format(new Date(payment.due_date), "dd MMM yyyy")}</span>
                        <div className="flex items-center gap-2">
                          {payment.paid_date && (
                            <span>{t('parentPortal.paid')}: {format(new Date(payment.paid_date), "dd MMM yyyy")}</span>
                          )}
                          {payment.receipt_url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[10px] gap-1 hover:bg-info/10 hover:text-info"
                              onClick={async (e) => {
                                e.stopPropagation();
                                const { data } = await supabase.storage
                                  .from('payment-receipts')
                                  .createSignedUrl(payment.receipt_url, 3600);
                                if (data?.signedUrl) {
                                  window.open(data.signedUrl, '_blank');
                                }
                              }}
                            >
                              <Eye className="h-3 w-3" />
                              إيصال
                            </Button>
                          )}
                        </div>
                      </div>
                      {payment.status !== "paid" && (
                        <Button
                          size="sm"
                          className="w-full mt-3 gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-md text-xs sm:text-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            toast({ title: t('parentPortal.onlinePayment'), description: t('parentPortal.onlinePaymentSoon') });
                          }}
                        >
                          <Wallet className="h-4 w-4" />
                          {t('parentPortal.payNow')}
                        </Button>
                      )}
                    </div>
                  );})}

                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <SetPasswordDialog
        open={showPasswordDialog}
        onOpenChange={setShowPasswordDialog}
        onSuccess={() => setShowPasswordDialog(false)}
      />
    </div>
  );
}