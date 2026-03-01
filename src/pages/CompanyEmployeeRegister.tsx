import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle, Building2, User, Phone, CreditCard, MapPin, FileText } from "lucide-react";
import seaterLogo from "@/assets/seater-logo.jpg";

interface CompanyLine {
  id: string;
  name: string;
  route_details: string | null;
}

export default function CompanyEmployeeRegister() {
  const { companyId } = useParams<{ companyId: string }>();
  const [companyName, setCompanyName] = useState("");
  const [lines, setLines] = useState<CompanyLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [invalidCompany, setInvalidCompany] = useState(false);

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    national_id: "",
    department: "",
    company_line_id: "",
    pickup_address: "",
    notes: "",
  });

  useEffect(() => {
    if (!companyId) return;
    loadCompanyData();
  }, [companyId]);

  const loadCompanyData = async () => {
    try {
      // Fetch company info and lines via edge function (public)
      const { data, error } = await supabase.functions.invoke("company-employee-register", {
        method: "POST",
        body: { company_id: companyId, full_name: "__check__", phone: "__check__" },
      });

      // We'll use a separate approach - fetch company name from the public registration endpoint
      // For now, let's just load lines via the portal data function
      // Actually, we need a public endpoint to get company name and lines
      // Let's use a dedicated action
      const res = await supabase.functions.invoke("company-portal-data", {
        body: { action: "get-public-company-info", data: { company_id: companyId } },
      });

      if (res.data?.error || !res.data?.company) {
        setInvalidCompany(true);
      } else {
        setCompanyName(res.data.company.name);
        setLines(res.data.lines || []);
      }
    } catch {
      setInvalidCompany(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.phone.trim()) {
      setError("الاسم ورقم الهاتف مطلوبان");
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      const { data, error: fnError } = await supabase.functions.invoke("company-employee-register", {
        body: {
          company_id: companyId,
          ...form,
          company_line_id: form.company_line_id || null,
        },
      });

      if (fnError) throw fnError;
      if (data?.error) {
        setError(data.error);
        return;
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "حدث خطأ");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (invalidCompany) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full border-0 shadow-xl">
          <CardContent className="py-12 text-center">
            <Building2 className="h-16 w-16 mx-auto text-muted-foreground/40 mb-4" />
            <h2 className="text-xl font-bold mb-2">رابط غير صالح</h2>
            <p className="text-muted-foreground">هذا الرابط غير صالح أو الشركة غير نشطة</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full border-0 shadow-xl">
          <CardContent className="py-12 text-center space-y-4">
            <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-900/30 mx-auto flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-xl font-bold">تم التسجيل بنجاح!</h2>
            <p className="text-muted-foreground">
              تم تسجيل بياناتك في {companyName}. سيتم التواصل معك قريباً.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-6 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <img src={seaterLogo} alt="Seater" className="h-14 w-14 mx-auto rounded-xl shadow-lg" />
          <div>
            <h1 className="text-2xl font-bold">تسجيل بيانات الموظف</h1>
            <p className="text-muted-foreground mt-1">
              <Building2 className="inline h-4 w-4 ml-1" />
              {companyName}
            </p>
          </div>
        </div>

        {/* Form */}
        <Card className="border-0 shadow-xl">
          <CardContent className="p-5 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Full Name */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <User className="h-4 w-4 text-primary" />
                  الاسم الكامل <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="أدخل اسمك الكامل"
                  className="h-11"
                  required
                />
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <Phone className="h-4 w-4 text-primary" />
                  رقم الهاتف <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="01xxxxxxxxx"
                  className="h-11"
                  dir="ltr"
                  required
                />
              </div>

              {/* National ID */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <CreditCard className="h-4 w-4 text-primary" />
                  الرقم القومي
                </Label>
                <Input
                  value={form.national_id}
                  onChange={(e) => setForm({ ...form, national_id: e.target.value })}
                  placeholder="أدخل الرقم القومي"
                  className="h-11"
                  dir="ltr"
                />
              </div>

              {/* Department */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <Building2 className="h-4 w-4 text-primary" />
                  القسم / الإدارة
                </Label>
                <Input
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  placeholder="مثال: الموارد البشرية"
                  className="h-11"
                />
              </div>

              {/* Line Selection */}
              {lines.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-sm font-medium">
                    <MapPin className="h-4 w-4 text-primary" />
                    خط النقل المفضل
                  </Label>
                  <Select
                    value={form.company_line_id}
                    onValueChange={(v) => setForm({ ...form, company_line_id: v })}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="اختر الخط" />
                    </SelectTrigger>
                    <SelectContent>
                      {lines.map((line) => (
                        <SelectItem key={line.id} value={line.id}>
                          {line.name} {line.route_details ? `- ${line.route_details}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Pickup Address */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <MapPin className="h-4 w-4 text-primary" />
                  عنوان الركوب
                </Label>
                <Input
                  value={form.pickup_address}
                  onChange={(e) => setForm({ ...form, pickup_address: e.target.value })}
                  placeholder="أدخل عنوانك التفصيلي"
                  className="h-11"
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <FileText className="h-4 w-4 text-primary" />
                  ملاحظات
                </Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="أي ملاحظات إضافية..."
                  rows={3}
                />
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">{error}</p>
              )}

              <Button type="submit" className="w-full h-12 text-base font-medium" disabled={submitting}>
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "تسجيل البيانات"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          مقدم من Seater — خدمات النقل الذكية
        </p>
      </div>
    </div>
  );
}
