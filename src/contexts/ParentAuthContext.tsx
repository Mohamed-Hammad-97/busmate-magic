import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface ParentAccount {
  id: string;
  parent_name: string;
  father_phone: string;
  mother_phone: string | null;
  emergency_phone: string;
  city: string;
  national_id: string;
  job: string | null;
  pickup_latitude: number;
  pickup_longitude: number;
}

interface ParentAuthContextType {
  user: User | null;
  session: Session | null;
  parentAccount: ParentAccount | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  checkAuthMethod: (phone: string) => Promise<{ exists: boolean; has_password: boolean }>;
  sendOtp: (phone: string) => Promise<{ error: Error | null }>;
  verifyOtp: (phone: string, token: string) => Promise<{ error: Error | null }>;
  loginWithPassword: (phone: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const ParentAuthContext = createContext<ParentAuthContextType | undefined>(undefined);

export function ParentAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [parentAccount, setParentAccount] = useState<ParentAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchParentAccount = async (userId: string) => {
    try {
      const { data } = await supabase
        .from("parent_accounts")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      
      if (data) {
        setParentAccount(data as ParentAccount);
      }
    } catch (error) {
      console.error("Error fetching parent account:", error);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            fetchParentAccount(session.user.id);
          }, 0);
        } else {
          setParentAccount(null);
        }
        setIsLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchParentAccount(session.user.id);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const sendOtp = async (phone: string) => {
    try {
      // Clean phone number
      const cleanPhone = phone.replace(/\s/g, "").replace(/^0/, "");
      
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { phone: cleanPhone },
      });

      if (error) {
        console.error("Error sending OTP:", error);
        return { error: new Error(error.message || "فشل في إرسال رمز التحقق") };
      }

      if (data?.error) {
        return { error: new Error(data.error) };
      }

      return { error: null };
    } catch (error) {
      console.error("Error in sendOtp:", error);
      return { error: error as Error };
    }
  };

  const verifyOtp = async (phone: string, token: string) => {
    try {
      // Clean phone number
      const cleanPhone = phone.replace(/\s/g, "").replace(/^0/, "");
      
      const { data, error } = await supabase.functions.invoke("verify-otp", {
        body: { phone: cleanPhone, code: token },
      });

      if (error) {
        console.error("Error verifying OTP:", error);
        return { error: new Error(error.message || "فشل في التحقق من الرمز") };
      }

      if (data?.error) {
        return { error: new Error(data.error) };
      }

      if (data?.success && data?.session) {
        // Set the session using the tokens returned from verify-otp
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });

        if (sessionError) {
          console.error("Error setting session:", sessionError);
          return { error: new Error("فشل في تسجيل الدخول") };
        }

        if (sessionData.session) {
          setSession(sessionData.session);
          setUser(sessionData.session.user);
        }

        // Fetch parent account after successful verification
        if (data.user_id) {
          await fetchParentAccount(data.user_id);
        }
      }

      return { error: null };
    } catch (error) {
      console.error("Error in verifyOtp:", error);
      return { error: error as Error };
    }
  };

  const checkAuthMethod = async (phone: string) => {
    try {
      const cleanPhone = phone.replace(/\s/g, "").replace(/^0/, "");
      const { data, error } = await supabase.functions.invoke("check-parent-auth", {
        body: { phone: cleanPhone },
      });
      if (error || !data) return { exists: false, has_password: false };
      return { exists: data.exists ?? false, has_password: data.has_password ?? false };
    } catch {
      return { exists: false, has_password: false };
    }
  };

  const loginWithPassword = async (phone: string, password: string) => {
    try {
      const cleanPhone = phone.replace(/\s/g, "").replace(/^0/, "");
      const { data, error } = await supabase.functions.invoke("parent-password-login", {
        body: { phone: cleanPhone, password },
      });

      if (error) {
        return { error: new Error(error.message || "فشل في تسجيل الدخول") };
      }
      if (data?.error) {
        return { error: new Error(data.error) };
      }

      if (data?.success && data?.session) {
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });

        if (sessionError) {
          return { error: new Error("فشل في تسجيل الدخول") };
        }

        if (sessionData.session) {
          setSession(sessionData.session);
          setUser(sessionData.session.user);
        }

        if (data.user_id) {
          await fetchParentAccount(data.user_id);
        }
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setParentAccount(null);
  };

  const value: ParentAuthContextType = {
    user,
    session,
    parentAccount,
    isLoading,
    isAuthenticated: !!user && !!parentAccount,
    checkAuthMethod,
    sendOtp,
    verifyOtp,
    loginWithPassword,
    signOut,
  };

  return <ParentAuthContext.Provider value={value}>{children}</ParentAuthContext.Provider>;
}

export function useParentAuth() {
  const context = useContext(ParentAuthContext);
  if (context === undefined) {
    throw new Error("useParentAuth must be used within a ParentAuthProvider");
  }
  return context;
}
