import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, UserPlus, User, Phone, Key, Eye, EyeOff, Shield, ShieldCheck, MapPin, Building2, Car, Users, Power, PowerOff, Search } from "lucide-react";
import { z } from "zod";
import { useCity } from "@/contexts/CityContext";
import { useAuth } from "@/contexts/AuthContext";

const phoneSchema = z.string().regex(/^01[0125]\d{8}$/, "رقم الهاتف غير صالح");

const cityMapping: Record<string, string[]> = {
  cairo: ['cairo', 'القاهرة', 'قاهرة', 'Cairo'],
  giza: ['giza', 'الجيزة', 'جيزة', 'Giza'],
  alexandria: ['alexandria', 'الإسكندرية', 'اسكندرية', 'إسكندرية', 'Alexandria'],
};

interface DriverAccountsManagementProps {
  cityFilter?: string;
  staffContext?: "school" | "corporate";
}

type ServiceType = "school" | "corporate" | "daily_lines";

const SERVICE_LABELS: Record<ServiceType, string> = {
  school: "مدارس",
  corporate: "شركات",
  daily_lines: "خطوط يومية",
};

export function DriverAccountsManagement({ cityFilter, staffContext = "school" }: DriverAccountsManagementProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedCity } = useCity();
  const { isSuperAdmin, hasDepartment } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [accountType, setAccountType] = useState<"driver" | "supervisor">("driver");
  const [selectedPersonId, setSelectedPersonId] = useState<string>("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const allowedServices = useMemo<ServiceType[]>(() => {
    if (isSuperAdmin) return ["school", "corporate", "daily_lines"];
    const list: ServiceType[] = [];
    if (hasDepartment("operations")) list.push("school");
    if (hasDepartment("operation_companies")) list.push("corporate");
    if (hasDepartment("operation_daily_lines")) list.push("daily_lines");
    if (list.length === 0) list.push(staffContext === "corporate" ? "corporate" : "school");
    return list;
  }, [isSuperAdmin, hasDepartment, staffContext]);

  const defaultService: ServiceType =
    allowedServices.includes(staffContext as ServiceType)
      ? (staffContext as ServiceType)
      : allowedServices[0];

  const [selectedService, setSelectedService] = useState<ServiceType>(defaultService);

  useEffect(() => {
    if (!allowedServices.includes(selectedService)) {
      setSelectedService(allowedServices[0]);
    }
  }, [allowedServices, selectedService]);

  const legacyBelongsTo =
    selectedService === "corporate" ? ["corporate", "both"] : ["school", "both"];

  // Match on the categories array; fall back to legacy belongs_to for rows without categories
  const matchesContext = (person: any) => {
    const cats: string[] = Array.isArray(person?.categories) ? person.categories : [];
    if (cats.length > 0) return cats.includes(selectedService);
    return legacyBelongsTo.includes(person?.belongs_to);
  };


  const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: ["driver-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_accounts")
        .select(`
          *,
          driver:drivers(*),
          supervisor:supervisors(*)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filteredAccounts = useMemo(() => {
    const activeCityKey = (cityFilter || selectedCity || "").toLowerCase();
    const cityNames = cityMapping[activeCityKey] || [];

    return accounts.filter((acc: any) => {
      const person = acc.driver || acc.supervisor;
      if (!person) return false;
      if (!matchesContext(person)) return false;
      if (cityNames.length > 0) {
        const personCity = (person.city || "").toLowerCase();
        if (!cityNames.some((name) => personCity.includes(name.toLowerCase()))) return false;
      }
      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const nameMatch = (person.full_name || "").toLowerCase().includes(term);
        const phoneMatch = (acc.phone || "").includes(term);
        if (!nameMatch && !phoneMatch) return false;
      }
      return true;
    });
  }, [accounts, selectedCity, cityFilter, selectedService, searchTerm]);

  const takenDriverIds = useMemo(
    () => accounts.filter((a: any) => a.driver_id).map((a: any) => a.driver_id),
    [accounts]
  );
  const takenSupervisorIds = useMemo(
    () => accounts.filter((a: any) => a.supervisor_id).map((a: any) => a.supervisor_id),
    [accounts]
  );

  const filterByCity = (rows: any[]) => {
    const activeCityKey = (cityFilter || selectedCity || "").toLowerCase();
    const cityNames = cityMapping[activeCityKey] || [];
    if (cityNames.length === 0) return rows;
    return rows.filter((r: any) => {
      const c = (r.city || "").toLowerCase();
      return cityNames.some((name) => c.includes(name.toLowerCase()));
    });
  };

  const { data: availableDrivers = [] } = useQuery({
    queryKey: ["available-drivers", selectedCity, cityFilter, staffContext, takenDriverIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drivers")
        .select("*")
        .eq("is_active", true);
      if (error) throw error;

      const rows = (data || []).filter(
        (d: any) => matchesContext(d) && !takenDriverIds.includes(d.id)
      );
      return filterByCity(rows);
    },
  });

  const { data: availableSupervisors = [] } = useQuery({
    queryKey: ["available-supervisors", selectedCity, cityFilter, staffContext, takenSupervisorIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supervisors")
        .select("*")
        .eq("is_active", true);
      if (error) throw error;

      const rows = (data || []).filter(
        (s: any) => matchesContext(s) && !takenSupervisorIds.includes(s.id)
      );
      return filterByCity(rows);
    },
  });

  const createAccount = async () => {
    if (!selectedPersonId) {
      toast({ variant: "destructive", title: "اختر سائق أو مشرف" });
      return;
    }
    const phoneResult = phoneSchema.safeParse(phone);
    if (!phoneResult.success) {
      toast({ variant: "destructive", title: "رقم الهاتف غير صالح" });
      return;
    }
    if (password.length < 6) {
      toast({ variant: "destructive", title: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" });
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-driver-account', {
        body: { phone, password, accountType, personId: selectedPersonId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "تم إنشاء الحساب", description: "يمكن للسائق/المشرف الآن تسجيل الدخول" });
      queryClient.invalidateQueries({ queryKey: ["driver-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["available-drivers"] });
      queryClient.invalidateQueries({ queryKey: ["available-supervisors"] });
      setDialogOpen(false);
      resetForm();
    } catch (error: any) {
      console.error("Error creating account:", error);
      toast({ variant: "destructive", title: "خطأ", description: error.message || "حدث خطأ أثناء إنشاء الحساب" });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAccountStatus = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("driver_accounts")
        .update({ is_active: !isActive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["driver-accounts"] });
      toast({ title: "تم تحديث حالة الحساب" });
    },
  });

  const resetForm = () => {
    setAccountType("driver");
    setSelectedPersonId("");
    setPhone("");
    setPassword("");
  };

  const availablePersons = accountType === "driver" ? availableDrivers : availableSupervisors;

  const driverAccounts = filteredAccounts.filter((a: any) => a.driver_id);
  const supervisorAccounts = filteredAccounts.filter((a: any) => a.supervisor_id);
  const activeCount = filteredAccounts.filter((a: any) => a.is_active).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
          <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <Shield className="h-4 w-4 text-primary" />
              </div>
            </div>
            <p className="text-3xl font-bold tracking-tight text-foreground">{filteredAccounts.length}</p>
            <p className="text-xs text-muted-foreground mt-1">إجمالي الحسابات</p>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
          <div className="absolute top-0 right-0 w-20 h-20 bg-success/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-success/10">
                <ShieldCheck className="h-4 w-4 text-success" />
              </div>
            </div>
            <p className="text-3xl font-bold tracking-tight text-foreground">{activeCount}</p>
            <p className="text-xs text-muted-foreground mt-1">حسابات نشطة</p>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
          <div className="absolute top-0 right-0 w-20 h-20 bg-info/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-info/10">
                <Car className="h-4 w-4 text-info" />
              </div>
            </div>
            <p className="text-3xl font-bold tracking-tight text-foreground">{driverAccounts.length}</p>
            <p className="text-xs text-muted-foreground mt-1">حسابات سائقين</p>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
          <div className="absolute top-0 right-0 w-20 h-20 bg-warning/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-warning/10">
                <Users className="h-4 w-4 text-warning" />
              </div>
            </div>
            <p className="text-3xl font-bold tracking-tight text-foreground">{supervisorAccounts.length}</p>
            <p className="text-xs text-muted-foreground mt-1">حسابات مشرفين</p>
          </div>
        </div>
      </div>

      {/* Search & Create Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو الهاتف..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-11 bg-card border-border/50 focus:border-primary/50 rounded-xl transition-all"
          />
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2 rounded-xl shadow-md hover:shadow-lg transition-all">
              <Plus className="h-4 w-4" />
              إنشاء حساب جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl border-border/50">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <div className="p-2 rounded-xl bg-primary/10">
                  <UserPlus className="h-5 w-5 text-primary" />
                </div>
                إنشاء حساب جديد
              </DialogTitle>
              <DialogDescription>
                قم بإنشاء حساب دخول للسائق أو المشرف
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 mt-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">نوع الحساب</Label>
                <Select
                  value={accountType}
                  onValueChange={(v) => {
                    setAccountType(v as "driver" | "supervisor");
                    setSelectedPersonId("");
                  }}
                >
                  <SelectTrigger className="h-11 rounded-xl border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="driver">
                      <span className="flex items-center gap-2"><Car className="h-4 w-4" /> سائق</span>
                    </SelectItem>
                    <SelectItem value="supervisor">
                      <span className="flex items-center gap-2"><Users className="h-4 w-4" /> مشرف</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">اختر {accountType === "driver" ? "السائق" : "المشرف"}</Label>
                <Select value={selectedPersonId} onValueChange={setSelectedPersonId}>
                  <SelectTrigger className="h-11 rounded-xl border-border/50">
                    <SelectValue placeholder="اختر..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePersons.map((person: any) => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.full_name} - {person.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {availablePersons.length === 0 && (
                  <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                    لا يوجد {accountType === "driver" ? "سائقين" : "مشرفين"} بدون حسابات
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">رقم الهاتف للدخول</Label>
                <div className="relative">
                  <Phone className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="tel"
                    placeholder="01012345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pr-10 h-11 rounded-xl border-border/50"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">كلمة المرور</Label>
                <div className="relative">
                  <Key className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="كلمة المرور"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10 pl-10 h-11 rounded-xl border-border/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                className="w-full h-11 rounded-xl shadow-md hover:shadow-lg transition-all gap-2"
                onClick={createAccount}
                disabled={isLoading || !selectedPersonId}
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                <ShieldCheck className="h-4 w-4" />
                إنشاء الحساب
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Accounts List - Card-Based */}
      {loadingAccounts ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="p-4 rounded-full bg-primary/10 mb-4 animate-pulse">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground">جاري التحميل...</p>
        </div>
      ) : filteredAccounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed border-border/50 bg-card/50">
          <div className="p-5 rounded-2xl bg-muted/50 mb-4">
            <UserPlus className="h-10 w-10 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">لا توجد حسابات بعد</p>
          <p className="text-xs text-muted-foreground">ابدأ بإنشاء حساب جديد للسائقين أو المشرفين</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredAccounts.map((account: any) => {
            const person = account.driver || account.supervisor;
            const isDriver = !!account.driver_id;
            const initial = (person?.full_name || "?")[0].toUpperCase();

            return (
              <div
                key={account.id}
                className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card hover:shadow-lg transition-all duration-300"
              >
                {/* Decorative accent */}
                <div className={`absolute top-0 left-0 w-1 h-full ${account.is_active ? 'bg-success' : 'bg-muted-foreground/30'}`} />

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5 ps-7">
                  {/* Avatar */}
                  <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-base font-bold ${
                    isDriver 
                      ? 'bg-primary/10 text-primary' 
                      : 'bg-info/10 text-info'
                  }`}>
                    {initial}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground truncate">
                        {person?.full_name}
                      </span>
                      <Badge 
                        variant="outline" 
                        className={`text-[10px] px-2 py-0 h-5 rounded-md font-medium ${
                          isDriver 
                            ? 'border-primary/30 text-primary bg-primary/5' 
                            : 'border-info/30 text-info bg-info/5'
                        }`}
                      >
                        {isDriver ? (
                          <><Car className="h-3 w-3 me-1" /> سائق</>
                        ) : (
                          <><Users className="h-3 w-3 me-1" /> مشرف</>
                        )}
                      </Badge>
                      <Badge
                        className={`text-[10px] px-2 py-0 h-5 rounded-md font-medium border-0 ${
                          account.is_active 
                            ? 'bg-success/10 text-success' 
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {account.is_active ? "نشط" : "معطل"}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        <span dir="ltr">{account.phone}</span>
                      </span>
                      {person?.city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {person.city}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {person?.belongs_to === "school" ? "مدارس" : person?.belongs_to === "corporate" ? "شركات" : "الكل"}
                      </span>
                    </div>
                  </div>

                  {/* Action */}
                  <Button
                    variant={account.is_active ? "outline" : "default"}
                    size="sm"
                    className={`rounded-xl gap-1.5 text-xs shrink-0 transition-all ${
                      account.is_active 
                        ? 'border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/50' 
                        : 'bg-success hover:bg-success/90 text-success-foreground'
                    }`}
                    onClick={() => toggleAccountStatus.mutate({
                      id: account.id,
                      isActive: account.is_active,
                    })}
                  >
                    {account.is_active ? (
                      <><PowerOff className="h-3.5 w-3.5" /> تعطيل</>
                    ) : (
                      <><Power className="h-3.5 w-3.5" /> تفعيل</>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
