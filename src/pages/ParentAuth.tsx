import { useState, useEffect, useRef } from "react";
import { Navigate } from "react-router-dom";
import { useParentAuth } from "@/contexts/ParentAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Phone, ArrowLeft, RefreshCw } from "lucide-react";
import { z } from "zod";

const phoneSchema = z.string().regex(/^01[0125]\d{8}$/, "رقم الهاتف غير صالح");
const RESEND_COOLDOWN = 120; // 2 minutes in seconds

export default function ParentAuth() {
  const { user, parentAccount, isLoading: authLoading, sendOtp, verifyOtp } = useParentAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Start countdown timer
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

  // Redirect if already logged in
  if (!authLoading && user && parentAccount) {
    return <Navigate to="/parent" replace />;
  }

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const result = phoneSchema.safeParse(phone);
    if (!result.success) {
      setError("يرجى إدخال رقم هاتف صحيح (مثال: 01012345678)");
      return;
    }

    setIsLoading(true);
    const { error } = await sendOtp(phone);
    setIsLoading(false);

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
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      setError("يرجى إدخال رمز التحقق كاملاً");
      return;
    }

    setIsLoading(true);
    const { error } = await verifyOtp(phone, otp);
    setIsLoading(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "رمز التحقق غير صحيح",
        description: "يرجى التأكد من الرمز والمحاولة مرة أخرى",
      });
      setOtp("");
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary/10 to-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary/10 to-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex flex-col items-center mb-4">
            <img src="/src/assets/seater-logo.jpg" alt="Seater" className="h-16 w-auto mb-2" />
            <span className="text-xl font-semibold text-muted-foreground">Parent Login</span>
          </div>
          <CardTitle>
            {step === "phone" ? "تسجيل الدخول" : "التحقق من الرقم"}
          </CardTitle>
          <CardDescription>
            {step === "phone" 
              ? "أدخل رقم الهاتف المسجل للدخول إلى حسابك"
              : `أدخل رمز التحقق المرسل إلى ${phone}`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "phone" ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">رقم الهاتف</Label>
                <div className="relative">
                  <Phone className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="01012345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pr-10"
                    dir="ltr"
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                إرسال رمز التحقق
              </Button>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col items-center gap-4">
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={(value) => setOtp(value)}
                  onComplete={handleVerifyOtp}
                >
                  <InputOTPGroup dir="ltr">
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
              </div>
              <div className="space-y-2">
                <Button 
                  className="w-full" 
                  onClick={handleVerifyOtp}
                  disabled={isLoading || otp.length !== 6}
                >
                  {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  تأكيد
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={async () => {
                    setIsLoading(true);
                    const { error } = await sendOtp(phone);
                    setIsLoading(false);
                    if (error) {
                      toast({
                        variant: "destructive",
                        title: "خطأ",
                        description: error.message,
                      });
                    } else {
                      startResendTimer();
                      toast({
                        title: "تم إعادة إرسال الرمز",
                        description: `تم إرسال رمز جديد إلى ${phone}`,
                      });
                      setOtp("");
                    }
                  }}
                  disabled={isLoading || resendTimer > 0}
                >
                  <RefreshCw className="ml-2 h-4 w-4" />
                  {resendTimer > 0 
                    ? `إعادة الإرسال بعد ${Math.floor(resendTimer / 60)}:${(resendTimer % 60).toString().padStart(2, '0')}`
                    : "إعادة إرسال الرمز"
                  }
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full"
                  onClick={() => {
                    setStep("phone");
                    setOtp("");
                    setError("");
                    setResendTimer(0);
                    if (timerRef.current) clearInterval(timerRef.current);
                  }}
                >
                  <ArrowLeft className="ml-2 h-4 w-4" />
                  تغيير الرقم
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
