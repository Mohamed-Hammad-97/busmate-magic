import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCompanyAuth } from "@/contexts/CompanyAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Mail, Lock, Eye, EyeOff, Building2, Shield, FileText, Globe } from "lucide-react";
import { toast } from "sonner";
import seaterLogo from "@/assets/seater-logo.jpg";

export default function CompanyAuth() {
  const { t, i18n } = useTranslation();
  const { isAuthenticated, isLoading: authLoading, login } = useCompanyAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  const isAr = i18n.language === "ar";

  const toggleLang = () => {
    const newLang = isAr ? "en" : "ar";
    i18n.changeLanguage(newLang);
    document.documentElement.dir = newLang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = newLang;
  };

  if (!authLoading && isAuthenticated) {
    return <Navigate to="/company" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setIsLoading(true);
    setError("");
    const { error } = await login(email, password);
    setIsLoading(false);
    if (error) setError(error.message);
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("company-portal-data", {
        body: { action: "forgot-password-request", data: { email: forgotEmail } },
      });
      if (error) throw error;
      toast.success(isAr ? "تم إرسال الطلب، سيتواصل معك فريق Seater" : "Request sent. Seater team will contact you to reset your password.");
      setForgotOpen(false);
      setForgotEmail("");
    } catch {
      toast.error(isAr ? "حدث خطأ، حاول مرة أخرى" : "An error occurred. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/5" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />

      {/* Language Toggle - Fixed */}
      <button
        onClick={toggleLang}
        className="fixed top-4 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/80 backdrop-blur border border-border/50 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors shadow-sm"
        style={{ [isAr ? "left" : "right"]: "1rem" }}
      >
        <Globe className="h-4 w-4" />
        {isAr ? "English" : "العربية"}
      </button>

      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-primary to-primary/80 items-center justify-center p-12">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIi8+PC9zdmc+')] opacity-50" />
        <div className="relative text-center text-primary-foreground space-y-8 max-w-md">
          <div className="flex justify-center">
            <img src={seaterLogo} alt="Seater" className="h-24 w-auto rounded-2xl shadow-2xl" />
          </div>
          <div>
            <h1 className="text-4xl font-bold mb-4">Seater</h1>
            <p className="text-lg text-primary-foreground/80">
              {isAr ? "بوابة الشركات" : "Company Portal"}
            </p>
          </div>
          <div className="space-y-4 pt-8">
            <div className={`flex items-center gap-4 p-4 bg-primary-foreground/10 rounded-xl backdrop-blur-sm ${isAr ? "text-right" : "text-left"}`}>
              <div className="flex-shrink-0 w-12 h-12 bg-primary-foreground/20 rounded-full flex items-center justify-center">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <div className="font-medium">{isAr ? "إدارة خطوط النقل" : "Manage Transport Lines"}</div>
                <div className="text-sm text-primary-foreground/70">{isAr ? "تابع جميع خطوط شركتك ومواعيد الشفتات" : "Track all your company lines and shift schedules"}</div>
              </div>
            </div>
            <div className={`flex items-center gap-4 p-4 bg-primary-foreground/10 rounded-xl backdrop-blur-sm ${isAr ? "text-right" : "text-left"}`}>
              <div className="flex-shrink-0 w-12 h-12 bg-primary-foreground/20 rounded-full flex items-center justify-center">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <div className="font-medium">{isAr ? "الفواتير والمراجعة" : "Invoices & Review"}</div>
                <div className="text-sm text-primary-foreground/70">{isAr ? "راجع واعتمد فواتير شركتك" : "Review and approve your company invoices"}</div>
              </div>
            </div>
            <div className={`flex items-center gap-4 p-4 bg-primary-foreground/10 rounded-xl backdrop-blur-sm ${isAr ? "text-right" : "text-left"}`}>
              <div className="flex-shrink-0 w-12 h-12 bg-primary-foreground/20 rounded-full flex items-center justify-center">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <div className="font-medium">{isAr ? "تتبع مباشر" : "Live Tracking"}</div>
                <div className="text-sm text-primary-foreground/70">{isAr ? "تابع حافلات شركتك على الخريطة" : "Track your company buses on the map"}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 relative">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="flex justify-center mb-4">
              <img src={seaterLogo} alt="Seater" className="h-16 w-auto rounded-xl shadow-lg" />
            </div>
            <h2 className="text-xl font-bold">Seater</h2>
            <p className="text-sm text-muted-foreground">{isAr ? "بوابة الشركات" : "Company Portal"}</p>
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold">{isAr ? "تسجيل الدخول" : "Sign In"}</h2>
            <p className="text-muted-foreground">{isAr ? "أدخل بيانات حساب شركتك للدخول" : "Enter your company account credentials"}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">{isAr ? "البريد الإلكتروني" : "Email"}</Label>
              <div className="relative">
                <Mail className={`absolute top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground ${isAr ? "right-3" : "left-3"}`} />
                <Input
                  id="email"
                  type="email"
                  placeholder="company@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors ${isAr ? "pr-10" : "pl-10"}`}
                  dir="ltr"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">{isAr ? "كلمة المرور" : "Password"}</Label>
              <div className="relative">
                <Lock className={`absolute top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground ${isAr ? "right-3" : "left-3"}`} />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors ${isAr ? "pr-10 pl-10" : "pl-10 pr-10"}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground ${isAr ? "left-3" : "right-3"}`}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => { setForgotOpen(true); setForgotEmail(email); }}
                className="text-sm text-primary hover:underline"
              >
                {isAr ? "نسيت كلمة المرور؟" : "Forgot password?"}
              </button>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-medium shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-all"
              disabled={isLoading || !email.trim() || !password.trim()}
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (isAr ? "تسجيل الدخول" : "Sign In")}
            </Button>
          </form>

          <div className="text-center pt-4">
            <Link to="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              {isAr ? "← العودة للموقع الرئيسي" : "← Back to main website"}
            </Link>
          </div>
        </div>
      </div>

      {/* Forgot Password Dialog */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{isAr ? "نسيت كلمة المرور" : "Forgot Password"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {isAr
              ? "أدخل بريدك الإلكتروني وسيتم إرسال طلب لفريق Seater لإعادة تعيين كلمة المرور."
              : "Enter your email and a request will be sent to the Seater team to reset your password."}
          </p>
          <div className="space-y-4 pt-2">
            <Input
              type="email"
              placeholder="company@example.com"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              dir="ltr"
            />
            <Button onClick={handleForgotPassword} disabled={forgotLoading || !forgotEmail.trim()} className="w-full gap-2">
              {forgotLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isAr ? "إرسال الطلب" : "Send Request"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
