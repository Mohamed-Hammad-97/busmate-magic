import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { driverPortalClient } from "@/lib/driverPortalClient";

const backendUrl = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function fetchAuthenticatedRows<T>(path: string, accessToken: string): Promise<T[]> {
  const response = await fetch(`${backendUrl}/rest/v1/${path}`, {
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`account request failed (${response.status})`);
  }

  return await response.json() as T[];
}

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

// Keep a single context instance across hot-module reloads so the provider and
// consumers never end up bound to two different context objects in dev.
const globalScope = globalThis as unknown as {
  __driverAuthContext?: React.Context<DriverAuthContextType | undefined>;
};
const DriverAuthContext =
  globalScope.__driverAuthContext ??
  (globalScope.__driverAuthContext = createContext<DriverAuthContextType | undefined>(undefined));

export function DriverAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [driverAccount, setDriverAccount] = useState<DriverAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accountLoadError, setAccountLoadError] = useState(false);
  const sessionResolutionRef = useRef(0);
  const activeSessionRef = useRef<Session | null>(null);
  const driverAccountRef = useRef<DriverAccount | null>(null);
  const refreshTimerRef = useRef<number | undefined>(undefined);
  const refreshInFlightRef = useRef<Promise<boolean> | null>(null);

  // Seconds left on a stored session. Uses expires_at when it looks sane, so a
  // tab opened long after login does not restart a full-lifetime countdown.
  const secondsRemaining = (target: Session): number => {
    const lifetime = Math.max(target.expires_in ?? 3600, 120);
    if (!target.expires_at) return lifetime;
    const remaining = target.expires_at - Math.floor(Date.now() / 1000);
    // Guard against inaccurate device clocks: never trust a value bigger than
    // the issued lifetime, and treat a wildly negative value as "renew now".
    if (remaining > lifetime) return lifetime;
    return remaining;
  };

  const refreshNow = async () => {
    if (refreshInFlightRef.current) return refreshInFlightRef.current;
    const run = (async () => {
      // Another tab may already have renewed this login. Reuse the stored one
      // instead of spending our refresh token on a parallel renewal.
      const { data: stored } = await driverPortalClient.auth.getSession();
      const current = activeSessionRef.current;
      if (
        stored.session &&
        stored.session.access_token !== current?.access_token &&
        secondsRemaining(stored.session) > 120
      ) {
        await applySession(stored.session);
        return true;
      }

      const token = stored.session?.refresh_token ?? current?.refresh_token;
      if (!token) return false;
      const { data, error } = await driverPortalClient.auth.refreshSession({ refresh_token: token });
      if (error || !data.session) return false;
      await applySession(data.session);
      return true;
    })();
    refreshInFlightRef.current = run;
    try {
      return await run;
    } finally {
      refreshInFlightRef.current = null;
    }
  };

  const scheduleSessionRefresh = (nextSession: Session | null) => {
    if (refreshTimerRef.current !== undefined) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = undefined;
    }
    if (!nextSession) return;

    // Refresh one minute before the real remaining time runs out.
    const refreshDelay = Math.max((secondsRemaining(nextSession) - 60) * 1000, 1_000);
    refreshTimerRef.current = window.setTimeout(() => {
      void refreshNow();
    }, refreshDelay);
  };

  const updateDriverAccount = (account: DriverAccount | null) => {
    driverAccountRef.current = account;
    setDriverAccount(account);
  };

  const loadAccountDetails = async (account: DriverAccount, accessToken: string) => {
    try {
      if (account.driver_id) {
        const rows = await fetchAuthenticatedRows<NonNullable<DriverAccount["driver"]>>(
          `drivers?select=id,full_name,phone&id=eq.${encodeURIComponent(account.driver_id)}&limit=1`,
          accessToken,
        );
        const data = rows[0];
        if (data && driverAccountRef.current?.id === account.id) {
          updateDriverAccount({ ...driverAccountRef.current, driver: data });
        }
      } else if (account.supervisor_id) {
        const rows = await fetchAuthenticatedRows<NonNullable<DriverAccount["supervisor"]>>(
          `supervisors?select=id,full_name,phone&id=eq.${encodeURIComponent(account.supervisor_id)}&limit=1`,
          accessToken,
        );
        const data = rows[0];
        if (data && driverAccountRef.current?.id === account.id) {
          updateDriverAccount({ ...driverAccountRef.current, supervisor: data });
        }
      }
    } catch (error) {
      console.warn("Account details will load later:", error);
    }
  };

  const fetchDriverAccount = async (userId: string, accessToken: string) => {
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
        const accountRequest = fetchAuthenticatedRows<DriverAccount>(
          `driver_accounts?select=id,phone,driver_id,supervisor_id,is_active&user_id=eq.${encodeURIComponent(userId)}&is_active=eq.true&limit=1`,
          accessToken,
        );
        const rows = await withTimeout(accountRequest, "account lookup");
        const data = rows[0];
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
    scheduleSessionRefresh(nextSession);
    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    if (!nextSession?.user) {
      updateDriverAccount(null);
      setAccountLoadError(false);
      setIsLoading(false);
      return null;
    }

    try {
      const account = await fetchDriverAccount(nextSession.user.id, nextSession.access_token);
      if (resolutionId !== sessionResolutionRef.current) return null;
      const existingAccount = driverAccountRef.current;
      const accountToKeep = account ?? (
        existingAccount && activeSessionRef.current?.user.id === nextSession.user.id
          ? existingAccount
          : null
      );
      updateDriverAccount(accountToKeep);
      setAccountLoadError(!accountToKeep);
      setIsLoading(false);
      if (account) void loadAccountDetails(account, nextSession.access_token);
      return accountToKeep;
    } catch {
      if (resolutionId !== sessionResolutionRef.current) return null;
      // Keep the accepted session. The user can retry this account request
      // without entering the password again.
      const existingAccount = driverAccountRef.current;
      const canKeepAccount = existingAccount && activeSessionRef.current?.user.id === nextSession.user.id;
      if (!canKeepAccount) updateDriverAccount(null);
      setAccountLoadError(!canKeepAccount);
      setIsLoading(false);
      return canKeepAccount ? existingAccount : null;
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

    const { data: { subscription } } = driverPortalClient.auth.onAuthStateChange(
      (event, session) => {
        if (event !== "INITIAL_SESSION" || session) sawAuthEvent = true;
        // Defer so we never run supabase queries inside the auth callback.
        setTimeout(() => {
          if (!mounted) return;
          // On some ColorOS/MIUI browsers INITIAL_SESSION can arrive after
          // signInWithPassword has already returned a valid session. That
          // delayed null startup snapshot is stale, not a real logout.
          if (event === "INITIAL_SESSION" && !session && activeSessionRef.current) return;
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

    driverPortalClient.auth.getSession().then(({ data: { session } }) => {
      // A late, empty initial read must never override a live sign-in.
      if (!session && (sawAuthEvent || activeSessionRef.current)) {
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
      if (refreshTimerRef.current !== undefined) window.clearTimeout(refreshTimerRef.current);
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
      const lookup = driverPortalClient.functions.invoke("driver-login-lookup", {
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
        driverPortalClient.auth.signInWithPassword({ email, password }),
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
    await driverPortalClient.auth.signOut();
    updateDriverAccount(null);
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
