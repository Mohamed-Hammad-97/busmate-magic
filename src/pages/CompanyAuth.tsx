import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useCompanyAuth } from "@/contexts/CompanyAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, Lock, Eye, EyeOff, Building2, Shield, FileText } from "lucide-react";
import seaterLogo from "@/assets/seater-logo.jpg";

export default function CompanyAuth() {
  const { isAuthenticated, isLoading: authLoading, login } = useCompanyAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

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

    if (error) {
      setError(error.message);
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

      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-primary to-primary/80 items-center justify-center p-12">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIi8+PC9zdmc+')] opacity-50" />
        <div className="relative text-center text-primary-foreground space-y-8 max-w-md">
          <div className="flex justify-center">
            <img src={seaterLogo} alt="Seater" className="h-24 w-auto rounded-2xl shadow-2xl" />
          </div>
          <div>
            <h1 className="text-4xl font-bold mb-4">Seater</h1>
            <p className="text-lg text-primary-foreground/80">بوابة الشركات</p>
          </div>
          <div className="space-y-4 pt-8">
            <div className="flex items-center gap-4 p-4 bg-primary-foreground/10 rounded-xl backdrop-blur-sm text-right">
              <div className="flex-shrink-0 w-12 h-12 bg-primary-foreground/20 rounded-full flex items-center justify-center">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <div className="font-medium">إدارة خطوط النقل</div>
                <div className="text-sm text-primary-foreground/70">تابع جميع خطوط شركتك ومواعيد الشفتات</div>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-primary-foreground/10 rounded-xl backdrop-blur-sm text-right">
              <div className="flex-shrink-0 w-12 h-12 bg-primary-foreground/20 rounded-full flex items-center justify-center">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <div className="font-medium">الفواتير والمراجعة</div>
                <div className="text-sm text-primary-foreground/70">راجع واعتمد فواتير شركتك</div>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-primary-foreground/10 rounded-xl backdrop-blur-sm text-right">
              <div className="flex-shrink-0 w-12 h-12 bg-primary-foreground/20 rounded-full flex items-center justify-center">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <div className="font-medium">تتبع مباشر</div>
                <div className="text-sm text-primary-foreground/70">تابع حافلات شركتك على الخريطة</div>
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
            <p className="text-sm text-muted-foreground">بوابة الشركات</p>
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold">تسجيل الدخول</h2>
            <p className="text-muted-foreground">أدخل بيانات حساب شركتك للدخول</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">البريد الإلكتروني</Label>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="company@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pr-10 h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">كلمة المرور</Label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10 pl-10 h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-medium shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-all"
              disabled={isLoading || !email.trim() || !password.trim()}
            >
              {isLoading ? <Loader2 className="ml-2 h-5 w-5 animate-spin" /> : "تسجيل الدخول"}
            </Button>
          </form>

          <div className="text-center pt-4">
            <Link to="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              ← العودة للموقع الرئيسي
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
