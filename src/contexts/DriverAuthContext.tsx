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
  accountLoadError: boolean;
  signIn: (phone: string, password: string) => Promise<{ error: Error | null }>;
  retryAccount: () => Promise<boolean>;
  signOut: () => Promise<void>;
}

const DriverAuthContext = createContext<DriverAuthContextType | undefined>(undefined);

export function DriverAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [driverAccount, setDriverAccount] = useState<DriverAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accountLoadError, setAccountLoadError] = useState(false);
  const sessionResolutionRef = useRef(0);
  const activeSessionRef = useRef<Session | null>(null);

  const loadAccountDetails = async (account: DriverAccount) => {
    try {
      if (account.driver_id) {
        const { data, error } = await supabase
          .from("drivers")
          .select("id, full_name, phone")
          .eq("id", account.driver_id)
          .maybeSingle();
        if (!error && data) setDriverAccount((current) => current?.id === account.id ? { ...current, driver: data } : current);
      } else if (account.supervisor_id) {
        const { data, error } = await supabase
          .from("supervisors")
          .select("id, full_name, phone")
          .eq("id", account.supervisor_id)
          .maybeSingle();
        if (!error && data) setDriverAccount((current) => current?.id === account.id ? { ...current, supervisor: data } : current);
      }
    } catch (error) {
      console.warn("Account details will load later:", error);
    }
  };

  const fetchDriverAccount = async (userId: string) => {
    const ACCOUNT_TIMEOUT_MS = 8000;

    const withTimeout = async <T,>(request: PromiseLike<T>, label: string): Promise<T> => {
      let timer: number | undefined;
      try {
        const timeout = new Promise<never>((_, reject) => {
          timer = window.setTimeout(() => reject(new Error(`${label} timeout`)), ACCOUNT_TIMEOUT_MS);
        });
        return await Promise.race([Promise.resolve(request), timeout]);
      } finally {
        if (timer !== undefined) window.clearTimeout(timer);
      }
    };

    // Keep the required account lookup small. Embedded Android browsers can
    // struggle with a joined request immediately after writing a new session.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const accountQuery = supabase
          .from("driver_accounts")
          .select("id, phone, driver_id, supervisor_id, is_active")
          .eq("user_id", userId)
          .eq("is_active", true)
          .maybeSingle();
        const { data, error } = await withTimeout(accountQuery, "account lookup");

        if (error) throw error;
        if (!data) return null;

        return { ...data, driver: null, supervisor: null } as DriverAccount;
      } catch (error) {
        if (attempt === 1) {
          console.error("Error fetching driver account:", error);
          throw error;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 700));
      }
    }

    return null;
  };

  const applySession = async (nextSession: Session | null) => {
    const resolutionId = ++sessionResolutionRef.current;
    activeSessionRef.current = nextSession;
    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    if (!nextSession?.user) {
      setDriverAccount(null);
      setAccountLoadError(false);
      setIsLoading(false);
      return null;
    }

    try {
      const account = await fetchDriverAccount(nextSession.user.id);
      if (resolutionId !== sessionResolutionRef.current) return null;
      setDriverAccount(account);
      setAccountLoadError(!account);
      setIsLoading(false);
      if (account) void loadAccountDetails(account);
      return account;
    } catch {
      if (resolutionId !== sessionResolutionRef.current) return null;
      // Keep the accepted session. The user can retry this account request
      // without entering the password again.
      setDriverAccount(null);
      setAccountLoadError(true);
      setIsLoading(false);
      return null;
    }
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event !== "INITIAL_SESSION" || session) sawAuthEvent = true;
        // Defer so we never run supabase queries inside the auth callback.
        setTimeout(() => {
          if (!mounted) return;
          // signIn handles its returned session directly. Ignore the duplicate
          // event so it cannot supersede that in-flight account request.
          if (session?.access_token === activeSessionRef.current?.access_token) return;
          void applySession(session);
        }, 0);
      }
    );

    const startupWatchdog = window.setTimeout(() => {
      if (mounted) setIsLoading(false);
    }, 10000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      // A late, empty initial read must never override a live sign-in.
      if (!session && sawAuthEvent) {
        if (mounted) setIsLoading(false);
        return;
      }
      if (mounted) void applySession(session);
    }).catch(() => {
      if (mounted) setIsLoading(false);
    });

    return () => {
      mounted = false;
      window.clearTimeout(startupWatchdog);
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
    let authenticatedSession: Session | null = null;
    try {
      const signInResult = await Promise.race([
        supabase.auth.signInWithPassword({ email, password }),
        new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 20000)),
      ]);
      if (signInResult === "timeout") {
        error = { message: "network timeout" };
      } else {
        error = signInResult.error;
        authenticatedSession = signInResult.data.session;
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

    if (!authenticatedSession) {
      const failure = new Error("تعذر حفظ تسجيل الدخول على هذا الهاتف. افتح الصفحة في Google Chrome وحاول مرة أخرى.") as Error & { code?: string };
      failure.code = "SESSION_MISSING";
      return { error: failure };
    }

    // Complete the whole handoff before telling the form that login succeeded.
    // This avoids depending on auth-event timing in OPPO/Redmi browsers.
    const account = await applySession(authenticatedSession);
    if (!account) {
      const failure = new Error("تم قبول كلمة المرور، لكن تعذر تحميل بيانات الحساب. اضغط إعادة المحاولة دون إدخال كلمة المرور مرة أخرى.") as Error & { code?: string };
      failure.code = "ACCOUNT_LOAD_FAILED";
      return { error: failure };
    }

    return { error: null };
  };

  const retryAccount = async () => {
    const currentSession = activeSessionRef.current;
    if (!currentSession) return false;
    setIsLoading(true);
    setAccountLoadError(false);
    const account = await applySession(currentSession);
    return Boolean(account);
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
    accountLoadError,
    signIn,
    retryAccount,
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
