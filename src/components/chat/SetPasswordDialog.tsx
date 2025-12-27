import { useState } from "react";
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
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock, Eye, EyeOff, CheckCircle } from "lucide-react";
import { z } from "zod";

const passwordSchema = z.string()
  .min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل")
  .regex(/[A-Za-z]/, "يجب أن تحتوي على حرف واحد على الأقل")
  .regex(/[0-9]/, "يجب أن تحتوي على رقم واحد على الأقل");

interface SetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function SetPasswordDialog({ open, onOpenChange, onSuccess }: SetPasswordDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    // Validate password
    const result = passwordSchema.safeParse(password);
    if (!result.success) {
      setErrors(result.error.errors.map((e) => e.message));
      return;
    }

    if (password !== confirmPassword) {
      setErrors(["كلمتا المرور غير متطابقتين"]);
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      
      if (error) throw error;

      // Update has_password flag
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("parent_accounts")
          .update({ has_password: true })
          .eq("user_id", user.id);
      }

      toast({
        title: "تم تعيين كلمة المرور",
        description: "يمكنك الآن تسجيل الدخول باستخدام رقم هاتفك وكلمة المرور",
      });
      
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: error.message || "حدث خطأ أثناء تعيين كلمة المرور",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            تعيين كلمة المرور
          </DialogTitle>
          <DialogDescription>
            قم بتعيين كلمة مرور لحسابك حتى تتمكن من تسجيل الدخول بسهولة في المرات القادمة
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">كلمة المرور الجديدة</Label>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10 pl-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">تأكيد كلمة المرور</Label>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pr-10"
                placeholder="••••••••"
              />
            </div>
          </div>

          {/* Password requirements */}
          <div className="text-sm space-y-1">
            <p className="text-muted-foreground">متطلبات كلمة المرور:</p>
            <div className="flex items-center gap-2">
              <CheckCircle className={`h-4 w-4 ${password.length >= 8 ? "text-green-500" : "text-muted-foreground"}`} />
              <span className={password.length >= 8 ? "text-green-600" : "text-muted-foreground"}>
                8 أحرف على الأقل
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className={`h-4 w-4 ${/[A-Za-z]/.test(password) ? "text-green-500" : "text-muted-foreground"}`} />
              <span className={/[A-Za-z]/.test(password) ? "text-green-600" : "text-muted-foreground"}>
                حرف واحد على الأقل
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className={`h-4 w-4 ${/[0-9]/.test(password) ? "text-green-500" : "text-muted-foreground"}`} />
              <span className={/[0-9]/.test(password) ? "text-green-600" : "text-muted-foreground"}>
                رقم واحد على الأقل
              </span>
            </div>
          </div>

          {errors.length > 0 && (
            <div className="text-sm text-destructive space-y-1">
              {errors.map((error, i) => (
                <p key={i}>{error}</p>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              لاحقاً
            </Button>
            <Button type="submit" className="flex-1" disabled={isLoading}>
              {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              تعيين كلمة المرور
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
