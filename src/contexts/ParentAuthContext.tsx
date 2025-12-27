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
  sendOtp: (phone: string) => Promise<{ error: Error | null }>;
  verifyOtp: (phone: string, token: string) => Promise<{ error: Error | null }>;
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
    // Format phone for Egypt (+2)
    const formattedPhone = phone.startsWith("+") ? phone : `+2${phone}`;
    
    const { error } = await supabase.auth.signInWithOtp({
      phone: formattedPhone,
    });
    return { error: error as Error | null };
  };

  const verifyOtp = async (phone: string, token: string) => {
    const formattedPhone = phone.startsWith("+") ? phone : `+2${phone}`;
    
    const { data, error } = await supabase.auth.verifyOtp({
      phone: formattedPhone,
      token,
      type: "sms",
    });

    if (!error && data.user) {
      // Link user to parent_account by phone
      const { data: existingParent } = await supabase
        .from("parent_accounts")
        .select("id, user_id")
        .eq("father_phone", phone)
        .maybeSingle();
      
      if (existingParent && !existingParent.user_id) {
        await supabase
          .from("parent_accounts")
          .update({ user_id: data.user.id })
          .eq("id", existingParent.id);
      }
    }

    return { error: error as Error | null };
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
    sendOtp,
    verifyOtp,
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
