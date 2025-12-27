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

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchDriverAccount(session.user.id);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (phone: string, password: string) => {
    // Format phone as email for Supabase auth
    const formattedPhone = phone.replace(/\D/g, "");
    const email = `driver_${formattedPhone}@seater.app`;
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    return { error: error as Error | null };
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
