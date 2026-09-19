import React, { createContext, useContext, useEffect, useRef, useState } from "react";
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
  const sessionResolutionRef = useRef(0);

  const fetchDriverAccount = async (userId: string) => {
    const ACCOUNT_TIMEOUT_MS = 8000;

    // Mobile connections can occasionally leave the account query pending even
    // after password authentication succeeds. Keep this query small, abort it
    // if it stalls, then retry once before allowing the auth gate to finish.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let timer: number | undefined;

      try {
        const accountQuery = supabase
          .from("driver_accounts")
          .select(`
            id,
            phone,
            driver_id,
            supervisor_id,
            is_active,
            driver:drivers(id, full_name, phone),
            supervisor:supervisors(id, full_name, phone)
          `)
          .eq("user_id", userId)
          .eq("is_active", true)
          .maybeSingle();
        const timeout = new Promise<never>((_, reject) => {
          timer = window.setTimeout(() => reject(new Error("account lookup timeout")), ACCOUNT_TIMEOUT_MS);
        });
        const { data, error } = await Promise.race([accountQuery, timeout]);

        if (error) throw error;
        return data ? data as unknown as DriverAccount : null;
      } catch (error) {
        if (attempt === 1) {
          console.error("Error fetching driver account:", error);
        }
      } finally {
        if (timer !== undefined) window.clearTimeout(timer);
      }
    }

    return null;
  };

  useEffect(() => {
    // The auth gate (DriverProtectedRoute) must stay in "loading" until BOTH the
    // session and the driver/supervisor account record are resolved. Otherwise a
    // fresh tab (e.g. opening a trip in a new tab) briefly thinks the user is
    // logged out and bounces to /driver/login, then back to /driver.
    let mounted = true;
    // On slow mobile networks the initial getSession() can settle AFTER a fresh
    // sign-in event. Its (stale) empty result used to wipe the brand new
    // session, throwing the person straight back to the login page.
    let sawAuthEvent = false;

    const resolveSession = async (nextSession: Session | null) => {
      const resolutionId = ++sessionResolutionRef.current;
      const account = nextSession?.user
        ? await fetchDriverAccount(nextSession.user.id)
        : null;

      if (!mounted || resolutionId !== sessionResolutionRef.current) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setDriverAccount(account);
      setIsLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event !== "INITIAL_SESSION" || session) sawAuthEvent = true;
        // Defer so we never run supabase queries inside the auth callback.
        setTimeout(() => {
          resolveSession(session);
        }, 0);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      // A late, empty initial read must never override a live sign-in.
      if (!session && sawAuthEvent) {
        if (mounted) setIsLoading(false);
        return;
      }
      resolveSession(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (phone: string, password: string) => {
    const formattedPhone = phone.replace(/\D/g, "");

    // Resolve the real login address for this phone (it may differ from the
    // number stored on the staff record), then sign in with it.
    let email = `driver_${formattedPhone}@seater.app`;
    try {
      // Hard time limit: on flaky mobile networks this lookup can hang forever,
      // which used to leave the login button spinning with no feedback.
      const LOOKUP_TIMEOUT_MS = 8000;
      const lookup = supabase.functions.invoke("driver-login-lookup", {
        body: { phone: formattedPhone },
      });
      const timeout = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), LOOKUP_TIMEOUT_MS)
      );
      const result = await Promise.race([lookup, timeout]);
      const { data, error } = (result ?? { data: null, error: null }) as {
        data: { email?: string } | null;
        error: unknown;
      };


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

    let error: { message?: string; status?: number } | null = null;
    try {
      const signInResult = await Promise.race([
        supabase.auth.signInWithPassword({ email, password }),
        new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 20000)),
      ]);
      if (signInResult === "timeout") {
        error = { message: "network timeout" };
      } else {
        error = signInResult.error;
      }
    } catch (e) {
      error = { message: (e as Error)?.message || "network" };
    }

    if (error) {
      const raw = (error.message || "").toLowerCase();
      const status = error.status;


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
