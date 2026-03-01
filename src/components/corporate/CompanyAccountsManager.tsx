import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompanyAuth } from "@/contexts/CompanyAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { UserPlus, Mail, User, Phone, Shield, ShieldCheck, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const AVAILABLE_PERMISSIONS = [
  { key: "view_lines", label: "عرض الخطوط" },
  { key: "view_invoices", label: "عرض الفواتير" },
  { key: "approve_invoices", label: "اعتماد الفواتير" },
  { key: "view_drivers", label: "عرض السائقين" },
  { key: "view_tracking", label: "التتبع المباشر" },
  { key: "view_employees", label: "عرض الموظفين" },
  { key: "manage_accounts", label: "إدارة الحسابات" },
  { key: "view_chat", label: "المحادثات" },
];

interface CompanyAccountItem {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: string;
  permissions: string[];
  is_active: boolean;
  created_at: string;
}

export function CompanyAccountsManager({ accounts }: { accounts: CompanyAccountItem[] }) {
  const { account, token } = useCompanyAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newAccount, setNewAccount] = useState({
    email: "",
    password: "",
    full_name: "",
    phone: "",
    permissions: [] as string[],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("company-portal-data", {
        body: {
          action: "create-account",
          data: {
            ...newAccount,
            role: "employee",
          },
        },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-portal", "get-accounts"] });
      toast.success("تم إنشاء الحساب بنجاح");
      setDialogOpen(false);
      setNewAccount({ email: "", password: "", full_name: "", phone: "", permissions: [] });
    },
    onError: (err: any) => toast.error(err.message || "حدث خطأ"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ account_id, is_active }: { account_id: string; is_active: boolean }) => {
      const { data, error } = await supabase.functions.invoke("company-portal-data", {
        body: { action: "toggle-account", data: { account_id, is_active } },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-portal", "get-accounts"] });
      toast.success("تم التحديث");
    },
    onError: (err: any) => toast.error(err.message || "حدث خطأ"),
  });

  const togglePermission = (key: string) => {
    setNewAccount((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter((p) => p !== key)
        : [...prev.permissions, key],
    }));
  };

  return (
    <div className="space-y-4">
      {/* Create Account Button */}
      {account?.role === "admin" && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" />
              إنشاء حساب جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>إنشاء حساب جديد</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>الاسم الكامل *</Label>
                <Input
                  value={newAccount.full_name}
                  onChange={(e) => setNewAccount({ ...newAccount, full_name: e.target.value })}
                  placeholder="أدخل الاسم"
                />
              </div>
              <div className="space-y-2">
                <Label>البريد الإلكتروني *</Label>
                <Input
                  type="email"
                  value={newAccount.email}
                  onChange={(e) => setNewAccount({ ...newAccount, email: e.target.value })}
                  placeholder="email@example.com"
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label>كلمة المرور *</Label>
                <Input
                  type="password"
                  value={newAccount.password}
                  onChange={(e) => setNewAccount({ ...newAccount, password: e.target.value })}
                  placeholder="6 أحرف على الأقل"
                />
              </div>
              <div className="space-y-2">
                <Label>رقم الهاتف</Label>
                <Input
                  value={newAccount.phone}
                  onChange={(e) => setNewAccount({ ...newAccount, phone: e.target.value })}
                  placeholder="01xxxxxxxxx"
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label>الصلاحيات</Label>
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_PERMISSIONS.map((perm) => (
                    <label key={perm.key} className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded-lg hover:bg-muted/50">
                      <Checkbox
                        checked={newAccount.permissions.includes(perm.key)}
                        onCheckedChange={() => togglePermission(perm.key)}
                      />
                      {perm.label}
                    </label>
                  ))}
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !newAccount.email || !newAccount.password || !newAccount.full_name}
              >
                {createMutation.isPending ? "جاري الإنشاء..." : "إنشاء الحساب"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Accounts List */}
      {accounts.length === 0 ? (
        <Card className="border-0 shadow-md">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
            <p className="font-medium mb-1">لا توجد حسابات</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {accounts.map((acc) => (
            <Card key={acc.id} className="border-0 shadow-md">
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-sm">{acc.full_name}</h4>
                    {acc.role === "admin" ? (
                      <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[10px]">
                        <ShieldCheck className="h-3 w-3 ml-0.5" />
                        مدير
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">موظف</Badge>
                    )}
                    {acc.is_active ? (
                      <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">نشط</Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[10px]">معطل</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {acc.email}
                    </span>
                    {acc.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {acc.phone}
                      </span>
                    )}
                  </div>
                  {acc.permissions && (acc.permissions as string[]).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(acc.permissions as string[]).map((p) => {
                        const perm = AVAILABLE_PERMISSIONS.find((ap) => ap.key === p);
                        return perm ? (
                          <Badge key={p} variant="outline" className="text-[10px] py-0">{perm.label}</Badge>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {acc.id !== account?.id && acc.role !== "admin" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => toggleMutation.mutate({ account_id: acc.id, is_active: !acc.is_active })}
                      disabled={toggleMutation.isPending}
                    >
                      {acc.is_active ? (
                        <ToggleRight className="h-5 w-5 text-green-600" />
                      ) : (
                        <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
