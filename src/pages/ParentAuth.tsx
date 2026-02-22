import { useState, useEffect, useRef } from "react";
import { Navigate, Link } from "react-router-dom";
import { useParentAuth } from "@/contexts/ParentAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Phone, ArrowLeft, RefreshCw, ArrowRight, Shield, Lock, Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import seaterLogo from '@/assets/seater-logo.jpg';
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";

const phoneSchema = z.string().regex(/^01[0125]\d{8}$/, "رقم الهاتف غير صالح");
const RESEND_COOLDOWN = 120;

export default function ParentAuth() {
  const { user, parentAccount, isLoading: authLoading, checkAuthMethod, sendOtp, verifyOtp, loginWithPassword } = useParentAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<"phone" | "password" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const sendingRef = useRef(false);
  const verifyingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startResendTimer = () => {
    setResendTimer(RESEND_COOLDOWN);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  if (!authLoading && user && parentAccount) {
    return <Navigate to="/parent" replace />;
  }

  // Step 1: Enter phone and check auth method
  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sendingRef.current) return;
    setError("");

    const result = phoneSchema.safeParse(phone);
    if (!result.success) {
      setError("يرجى إدخال رقم هاتف صحيح (مثال: 01012345678)");
      return;
    }

    sendingRef.current = true;
    setIsLoading(true);

    // Check if parent has password set
    const authInfo = await checkAuthMethod(phone);

    if (authInfo.has_password) {
      // Parent has password - show password login
      setStep("password");
      setIsLoading(false);
      sendingRef.current = false;
    } else {
      // No password - send OTP
      const { error } = await sendOtp(phone);
      setIsLoading(false);
      sendingRef.current = false;

      if (error) {
        toast({
          variant: "destructive",
          title: "خطأ",
          description: error.message,
        });
      } else {
        setStep("otp");
        startResendTimer();
        toast({
          title: "تم إرسال رمز التحقق",
          description: `تم إرسال رمز التحقق إلى ${phone}`,
        });
      }
    }
  };

  // Password login
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setIsLoading(true);
    setError("");
    const { error } = await loginWithPassword(phone, password);
    setIsLoading(false);

    if (error) {
      setError(error.message);
      toast({
        variant: "destructive",
        title: "خطأ في تسجيل الدخول",
        description: error.message,
      });
    }
  };

  // Switch to OTP from password screen
  const handleSwitchToOtp = async () => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setIsLoading(true);
    const { error } = await sendOtp(phone);
    setIsLoading(false);
    sendingRef.current = false;

    if (error) {
      toast({ variant: "destructive", title: "خطأ", description: error.message });
    } else {
      setStep("otp");
      startResendTimer();
      toast({ title: "تم إرسال رمز التحقق", description: `تم إرسال رمز التحقق إلى ${phone}` });
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6 || verifyingRef.current) return;

    verifyingRef.current = true;
    setIsLoading(true);
    const { error } = await verifyOtp(phone, otp);
    setIsLoading(false);
    verifyingRef.current = false;

    if (error) {
      toast({
        variant: "destructive",
        title: "رمز التحقق غير صحيح",
        description: "يرجى التأكد من الرمز والمحاولة مرة أخرى",
      });
      setOtp("");
    }
  };

  const resetToPhone = () => {
    setStep("phone");
    setOtp("");
    setPassword("");
    setError("");
    setResendTimer(0);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const getStepTitle = () => {
    switch (step) {
      case "phone": return "تسجيل الدخول";
      case "password": return "كلمة المرور";
      case "otp": return "التحقق من الرقم";
    }
  };

  const getStepDescription = () => {
    switch (step) {
      case "phone": return "أدخل رقم الهاتف المسجل للدخول إلى حسابك";
      case "password": return `أدخل كلمة المرور للدخول بالرقم ${phone}`;
      case "otp": return `أدخل رمز التحقق المرسل إلى ${phone}`;
    }
  };

  return (
    <div className="min-h-screen flex bg-background relative overflow-hidden">
      {/* Background Decorations */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/5"></div>
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl"></div>

      {/* Language Switcher */}
      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>

      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-primary to-primary/80 items-center justify-center p-12">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIi8+PC9zdmc+')] opacity-50"></div>
        <div className="relative text-center text-primary-foreground space-y-8 max-w-md">
          <div className="flex justify-center">
            <img src={seaterLogo} alt="Seater" className="h-24 w-auto rounded-2xl shadow-2xl" />
          </div>
          <div>
            <h1 className="text-4xl font-bold mb-4">Seater</h1>
            <p className="text-lg text-primary-foreground/80">بوابة أولياء الأمور</p>
          </div>
          <div className="space-y-4 pt-8">
            <div className="flex items-center gap-4 p-4 bg-primary-foreground/10 rounded-xl backdrop-blur-sm text-right">
              <div className="flex-shrink-0 w-12 h-12 bg-primary-foreground/20 rounded-full flex items-center justify-center">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <div className="font-medium">تتبع مباشر</div>
                <div className="text-sm text-primary-foreground/70">تابع موقع الباص في الوقت الفعلي</div>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-primary-foreground/10 rounded-xl backdrop-blur-sm text-right">
              <div className="flex-shrink-0 w-12 h-12 bg-primary-foreground/20 rounded-full flex items-center justify-center">
                <Phone className="h-6 w-6" />
              </div>
              <div>
                <div className="font-medium">إشعارات فورية</div>
                <div className="text-sm text-primary-foreground/70">احصل على تنبيهات عند وصول الباص</div>
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
            <p className="text-sm text-muted-foreground">بوابة أولياء الأمور</p>
          </div>

          {/* Form Header */}
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold">{getStepTitle()}</h2>
            <p className="text-muted-foreground">{getStepDescription()}</p>
          </div>

          {/* Phone Step */}
          {step === "phone" && (
            <form onSubmit={handlePhoneSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium">رقم الهاتف</Label>
                <div className="relative">
                  <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="01012345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pr-10 h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors text-left"
                    dir="ltr"
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
              <Button 
                type="submit" 
                className="w-full h-12 text-base font-medium shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-all" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                ) : (
                  <>
                    متابعة
                    <ArrowRight className="mr-2 h-5 w-5 rotate-180" />
                  </>
                )}
              </Button>
            </form>
          )}

          {/* Password Step */}
          {step === "password" && (
            <form onSubmit={handlePasswordLogin} className="space-y-6">
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
                    autoFocus
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

              <div className="space-y-3">
                <Button 
                  type="submit" 
                  className="w-full h-12 text-base font-medium shadow-lg shadow-primary/30" 
                  disabled={isLoading || !password.trim()}
                >
                  {isLoading ? <Loader2 className="ml-2 h-5 w-5 animate-spin" /> : "تسجيل الدخول"}
                </Button>
                
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12"
                  onClick={handleSwitchToOtp}
                  disabled={isLoading}
                >
                  <Phone className="ml-2 h-5 w-5" />
                  الدخول برمز التحقق بدلاً من ذلك
                </Button>

                <Button variant="ghost" className="w-full h-12" onClick={resetToPhone}>
                  <ArrowLeft className="ml-2 h-5 w-5" />
                  تغيير الرقم
                </Button>
              </div>
            </form>
          )}

          {/* OTP Step */}
          {step === "otp" && (
            <div className="space-y-6">
              <div className="flex flex-col items-center gap-6">
                <div className="bg-muted/50 p-6 rounded-2xl">
                  <InputOTP
                    maxLength={6}
                    value={otp}
                    onChange={(value) => setOtp(value)}
                    onComplete={handleVerifyOtp}
                  >
                    <InputOTPGroup dir="ltr" className="gap-2">
                      <InputOTPSlot index={0} className="w-12 h-14 text-lg rounded-xl" />
                      <InputOTPSlot index={1} className="w-12 h-14 text-lg rounded-xl" />
                      <InputOTPSlot index={2} className="w-12 h-14 text-lg rounded-xl" />
                      <InputOTPSlot index={3} className="w-12 h-14 text-lg rounded-xl" />
                      <InputOTPSlot index={4} className="w-12 h-14 text-lg rounded-xl" />
                      <InputOTPSlot index={5} className="w-12 h-14 text-lg rounded-xl" />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>
              <div className="space-y-3">
                <Button 
                  className="w-full h-12 text-base font-medium shadow-lg shadow-primary/30" 
                  onClick={handleVerifyOtp}
                  disabled={isLoading || otp.length !== 6}
                >
                  {isLoading && <Loader2 className="ml-2 h-5 w-5 animate-spin" />}
                  تأكيد
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full h-12"
                  onClick={async () => {
                    if (sendingRef.current) return;
                    sendingRef.current = true;
                    setIsLoading(true);
                    const { error } = await sendOtp(phone);
                    setIsLoading(false);
                    sendingRef.current = false;
                    if (error) {
                      toast({ variant: "destructive", title: "خطأ", description: error.message });
                    } else {
                      startResendTimer();
                      toast({ title: "تم إعادة إرسال الرمز", description: `تم إرسال رمز جديد إلى ${phone}` });
                      setOtp("");
                    }
                  }}
                  disabled={isLoading || resendTimer > 0}
                >
                  <RefreshCw className="ml-2 h-5 w-5" />
                  {resendTimer > 0 
                    ? `إعادة الإرسال بعد ${Math.floor(resendTimer / 60)}:${(resendTimer % 60).toString().padStart(2, '0')}`
                    : "إعادة إرسال الرمز"
                  }
                </Button>
                <Button variant="ghost" className="w-full h-12" onClick={resetToPhone}>
                  <ArrowLeft className="ml-2 h-5 w-5" />
                  تغيير الرقم
                </Button>
              </div>
            </div>
          )}

          {/* Back to Website */}
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
