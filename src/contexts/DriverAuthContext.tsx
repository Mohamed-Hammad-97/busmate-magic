import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface DriverAccount {
  id: string;
  phone: string;
  driver_id: string | null;
  supervisor_id: string | null;
  is_active: boolean;
  driver?: {
    id: string;
    full_name: string;
    phone: string;
  } | null;
  supervisor?: {
    id: string;
    full_name: string;
    phone: string;
  } | null;
}

interface DriverAuthContextType {
  user: User | null;
  session: Session | null;
  driverAccount: DriverAccount | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isDriver: boolean;
  isSupervisor: boolean;
  signIn: (phone: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const DriverAuthContext = createContext<DriverAuthContextType | undefined>(undefined);

export function DriverAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [driverAccount, setDriverAccount] = useState<DriverAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDriverAccount = async (userId: string) => {
    try {
      const { data } = await supabase
        .from("driver_accounts")
        .select(`
          *,
          driver:drivers(*),
          supervisor:supervisors(*)
        `)
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();
      
      if (data) {
        setDriverAccount(data as unknown as DriverAccount);
      } else {
        setDriverAccount(null);
      }
    } catch (error) {
      console.error("Error fetching driver account:", error);
      setDriverAccount(null);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            fetchDriverAccount(session.user.id);
          }, 0);
        } else {
          setDriverAccount(null);
        }
        setIsLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      let current = session;
      // Refresh on open so a stale token never silently breaks writes (e.g. starting a trip)
      if (current) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (refreshed?.session) current = refreshed.session;
      }
      setSession(current);
      setUser(current?.user ?? null);
      if (current?.user) {
        fetchDriverAccount(current.user.id);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (phone: string, password: string) => {
    const formattedPhone = phone.replace(/\D/g, "");

    // Resolve the real login address for this phone (it may differ from the
    // number stored on the staff record), then sign in with it.
    let email = `driver_${formattedPhone}@seater.app`;
    try {
      const { data, error } = await supabase.functions.invoke("driver-login-lookup", {
        body: { phone: formattedPhone },
      });

      if (error) {
        let code = "";
        try {
          const parsed = await (error as any).context?.json?.();
          code = parsed?.code || "";
        } catch {
          /* ignore parse errors */
        }
        if (code === "NOT_FOUND") {
          const notFound = new Error("لا يوجد حساب بهذا الرقم. تواصل مع إدارة التشغيل.") as Error & { code?: string };
          notFound.code = "NOT_FOUND";
          return { error: notFound };
        }
        if (code === "INACTIVE") {
          const inactive = new Error("هذا الحساب معطل. تواصل مع إدارة التشغيل.") as Error & { code?: string };
          inactive.code = "INACTIVE";
          return { error: inactive };
        }
      } else if (data?.email) {
        email = data.email;
      }
    } catch {
      /* fall back to the derived address */
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const raw = (error.message || "").toLowerCase();
      const status = (error as any).status as number | undefined;

      let message = "تعذر تسجيل الدخول. حاول مرة أخرى.";
      let code = "SIGNIN_FAILED";

      if (raw.includes("invalid login credentials")) {
        message = "كلمة المرور غير صحيحة.";
        code = "WRONG_PASSWORD";
      } else if (raw.includes("email not confirmed") || raw.includes("not confirmed")) {
        message = "الحساب غير مفعل. تواصل مع إدارة التشغيل.";
        code = "NOT_CONFIRMED";
      } else if (status === 429 || raw.includes("rate limit") || raw.includes("too many")) {
        message = "محاولات كثيرة. انتظر قليلاً ثم حاول مرة أخرى.";
        code = "RATE_LIMITED";
      } else if (raw.includes("failed to fetch") || raw.includes("network")) {
        message = "تعذر الاتصال بالإنترنت. تأكد من الشبكة وحاول مرة أخرى.";
        code = "NETWORK";
      } else if (raw.includes("banned") || raw.includes("disabled")) {
        message = "هذا الحساب معطل. تواصل مع إدارة التشغيل.";
        code = "INACTIVE";
      }

      const failure = new Error(message) as Error & { code?: string };
      failure.code = code;
      return { error: failure };
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setDriverAccount(null);
  };

  const value: DriverAuthContextType = {
    user,
    session,
    driverAccount,
    isLoading,
    isAuthenticated: !!user && !!driverAccount,
    isDriver: !!driverAccount?.driver_id,
    isSupervisor: !!driverAccount?.supervisor_id,
    signIn,
    signOut,
  };

  return <DriverAuthContext.Provider value={value}>{children}</DriverAuthContext.Provider>;
}

export function useDriverAuth() {
  const context = useContext(DriverAuthContext);
  if (context === undefined) {
    throw new Error("useDriverAuth must be used within a DriverAuthProvider");
  }
  return context;
}
