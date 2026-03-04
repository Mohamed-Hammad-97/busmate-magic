import { useState, useMemo } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, UserPlus, User, Phone, Key, Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import { useCity } from "@/contexts/CityContext";

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

export function DriverAccountsManagement({ cityFilter, staffContext = "school" }: DriverAccountsManagementProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedCity } = useCity();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [accountType, setAccountType] = useState<"driver" | "supervisor">("driver");
  const [selectedPersonId, setSelectedPersonId] = useState<string>("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const belongsToValues = staffContext === "school" ? ["school", "both"] : ["corporate", "both"];

  // Fetch driver accounts with related driver/supervisor info
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

  // Filter accounts by city and belongs_to
  const filteredAccounts = useMemo(() => {
    const activeCityKey = (cityFilter || selectedCity || "").toLowerCase();
    const cityNames = cityMapping[activeCityKey] || [];

    return accounts.filter((acc: any) => {
      const person = acc.driver || acc.supervisor;
      if (!person) return false;

      // Filter by belongs_to
      if (!belongsToValues.includes(person.belongs_to)) return false;

      // Filter by city if applicable
      if (cityNames.length > 0) {
        const personCity = (person.city || "").toLowerCase();
        if (!cityNames.some((name) => personCity.includes(name.toLowerCase()))) return false;
      }

      return true;
    });
  }, [accounts, selectedCity, cityFilter, belongsToValues]);

  // Fetch drivers without accounts (filtered by city and belongs_to)
  const { data: availableDrivers = [] } = useQuery({
    queryKey: ["available-drivers", selectedCity, staffContext],
    queryFn: async () => {
      const existingDriverIds = accounts
        .filter((a) => a.driver_id)
        .map((a) => a.driver_id);

      let query = supabase
        .from("drivers")
        .select("*")
        .eq("is_active", true)
        .in("belongs_to", belongsToValues);

      if (existingDriverIds.length > 0) {
        query = query.not("id", "in", `(${existingDriverIds.join(",")})`);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Filter by city client-side
      const activeCityKey = (cityFilter || selectedCity || "").toLowerCase();
      const cityNames = cityMapping[activeCityKey] || [];
      if (cityNames.length > 0) {
        return (data || []).filter((d: any) => {
          const dCity = (d.city || "").toLowerCase();
          return cityNames.some((name) => dCity.includes(name.toLowerCase()));
        });
      }
      return data;
    },
    enabled: accounts !== undefined,
  });

  // Fetch supervisors without accounts (filtered by city and belongs_to)
  const { data: availableSupervisors = [] } = useQuery({
    queryKey: ["available-supervisors", selectedCity, staffContext],
    queryFn: async () => {
      const existingSupervisorIds = accounts
        .filter((a) => a.supervisor_id)
        .map((a) => a.supervisor_id);

      let query = supabase
        .from("supervisors")
        .select("*")
        .eq("is_active", true)
        .in("belongs_to", belongsToValues);

      if (existingSupervisorIds.length > 0) {
        query = query.not("id", "in", `(${existingSupervisorIds.join(",")})`);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Filter by city client-side
      const activeCityKey = (cityFilter || selectedCity || "").toLowerCase();
      const cityNames = cityMapping[activeCityKey] || [];
      if (cityNames.length > 0) {
        return (data || []).filter((s: any) => {
          const sCity = (s.city || "").toLowerCase();
          return cityNames.some((name) => sCity.includes(name.toLowerCase()));
        });
      }
      return data;
    },
    enabled: accounts !== undefined,
  });

  const createAccount = async () => {
    // Validate
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
      // Use server-side edge function for secure account creation
      const { data, error } = await supabase.functions.invoke('create-driver-account', {
        body: {
          phone,
          password,
          accountType,
          personId: selectedPersonId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "تم إنشاء الحساب",
        description: "يمكن للسائق/المشرف الآن تسجيل الدخول",
      });

      queryClient.invalidateQueries({ queryKey: ["driver-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["available-drivers"] });
      queryClient.invalidateQueries({ queryKey: ["available-supervisors"] });
      
      setDialogOpen(false);
      resetForm();
    } catch (error: any) {
      console.error("Error creating account:", error);
      toast({
        variant: "destructive",
        title: "خطأ",
        description: error.message || "حدث خطأ أثناء إنشاء الحساب",
      });
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            حسابات السائقين والمشرفين
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                إنشاء حساب
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>إنشاء حساب جديد</DialogTitle>
                <DialogDescription>
                  قم بإنشاء حساب دخول للسائق أو المشرف
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>نوع الحساب</Label>
                  <Select
                    value={accountType}
                    onValueChange={(v) => {
                      setAccountType(v as "driver" | "supervisor");
                      setSelectedPersonId("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="driver">سائق</SelectItem>
                      <SelectItem value="supervisor">مشرف</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>اختر {accountType === "driver" ? "السائق" : "المشرف"}</Label>
                  <Select value={selectedPersonId} onValueChange={setSelectedPersonId}>
                    <SelectTrigger>
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
                    <p className="text-sm text-muted-foreground">
                      لا يوجد {accountType === "driver" ? "سائقين" : "مشرفين"} بدون حسابات
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>رقم الهاتف للدخول</Label>
                  <div className="relative">
                    <Phone className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="tel"
                      placeholder="01012345678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="pr-10"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>كلمة المرور</Label>
                  <div className="relative">
                    <Key className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="كلمة المرور"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10 pl-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  className="w-full"
                  onClick={createAccount}
                  disabled={isLoading || !selectedPersonId}
                >
                  {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  إنشاء الحساب
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loadingAccounts ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <UserPlus className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>لا توجد حسابات بعد</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الاسم</TableHead>
                <TableHead className="text-right">النوع</TableHead>
                <TableHead className="text-right">المدينة</TableHead>
                <TableHead className="text-right">القسم</TableHead>
                <TableHead className="text-right">رقم الهاتف</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAccounts.map((account: any) => {
                const person = account.driver || account.supervisor;
                return (
                <TableRow key={account.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {person?.full_name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {account.driver_id ? "سائق" : "مشرف"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{person?.city || "-"}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {person?.belongs_to === "school" ? "مدارس" : person?.belongs_to === "corporate" ? "شركات" : "الكل"}
                    </Badge>
                  </TableCell>
                  <TableCell dir="ltr">{account.phone}</TableCell>
                  <TableCell>
                    <Badge variant={account.is_active ? "default" : "secondary"}>
                      {account.is_active ? "نشط" : "معطل"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleAccountStatus.mutate({
                        id: account.id,
                        isActive: account.is_active,
                      })}
                    >
                      {account.is_active ? "تعطيل" : "تفعيل"}
                    </Button>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
