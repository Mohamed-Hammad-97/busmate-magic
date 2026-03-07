import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useDriverAuth } from "@/contexts/DriverAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Phone, Lock, Eye, EyeOff, ArrowRight, Bus, MapPin } from "lucide-react";
import { z } from "zod";
import seaterLogo from '@/assets/seater-logo.jpg';
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";

const phoneSchema = z.string().regex(/^01[0125]\d{8}$/, "Invalid phone");

export default function DriverAuth() {
  const { t } = useTranslation();
  const { user, driverAccount, isLoading: authLoading, signIn } = useDriverAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  if (!authLoading && user && driverAccount) {
    return <Navigate to="/driver" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const phoneResult = phoneSchema.safeParse(phone);
    if (!phoneResult.success) {
      setError(t('driverPortal.phoneError'));
      return;
    }

    if (!password) {
      setError(t('driverPortal.passwordError'));
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(phone, password);
    setIsLoading(false);

    if (error) {
      toast({ variant: "destructive", title: t('driverPortal.loginError'), description: t('driverPortal.loginErrorDesc') });
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
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 via-background to-blue-600/5"></div>
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl"></div>

      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>

      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-blue-600 to-blue-700 items-center justify-center p-12">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIi8+PC9zdmc+')] opacity-50"></div>
        <div className="relative text-center text-white space-y-8 max-w-md">
          <div className="flex justify-center">
            <img src={seaterLogo} alt="Seater" className="h-24 w-auto rounded-2xl shadow-2xl" />
          </div>
          <div>
            <h1 className="text-4xl font-bold mb-4">Seater</h1>
            <p className="text-lg text-white/80">{t('driverPortal.portalName')}</p>
          </div>
          <div className="space-y-4 pt-8">
            <div className="flex items-center gap-4 p-4 bg-white/10 rounded-xl backdrop-blur-sm">
              <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <Bus className="h-6 w-6" />
              </div>
              <div>
                <div className="font-medium">{t('driverPortal.manageTrips')}</div>
                <div className="text-sm text-white/70">{t('driverPortal.manageTripsDesc')}</div>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-white/10 rounded-xl backdrop-blur-sm">
              <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <MapPin className="h-6 w-6" />
              </div>
              <div>
                <div className="font-medium">{t('driverPortal.gpsTracking')}</div>
                <div className="text-sm text-white/70">{t('driverPortal.gpsTrackingDesc')}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 relative">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden text-center mb-8">
            <div className="flex justify-center mb-4">
              <img src={seaterLogo} alt="Seater" className="h-16 w-auto rounded-xl shadow-lg" />
            </div>
            <h2 className="text-xl font-bold">Seater</h2>
            <p className="text-sm text-muted-foreground">{t('driverPortal.portalName')}</p>
          </div>

          <div className="text-center">
            <h2 className="text-3xl font-bold">{t('driverPortal.login')}</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium">{t('driverPortal.phoneLabel')}</Label>
              <div className="relative">
                <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input id="phone" type="tel" placeholder="01012345678" value={phone} onChange={(e) => setPhone(e.target.value)} className="pr-10 h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors text-left" dir="ltr" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">{t('driverPortal.passwordLabel')}</Label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10 pl-10 h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-destructive text-center">{error}</p>}

            <Button type="submit" className="w-full h-12 text-base font-medium bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/30 hover:shadow-xl hover:shadow-blue-600/40 transition-all" disabled={isLoading}>
              {isLoading ? <Loader2 className="ml-2 h-5 w-5 animate-spin" /> : (
                <>
                  {t('driverPortal.signIn')}
                  <ArrowRight className="mr-2 h-5 w-5 rotate-180" />
                </>
              )}
            </Button>
          </form>

          <div className="text-center space-y-2 pt-4">
            <p className="text-sm text-muted-foreground">{t('driverPortal.accountCreatedByAdmin')}</p>
            <p className="text-sm text-muted-foreground">{t('driverPortal.contactOps')}</p>
          </div>

          <div className="text-center pt-4">
            <Link to="/" className="text-sm text-muted-foreground hover:text-blue-600 transition-colors">
              {t('driverPortal.backToWebsite')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
