import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CompanyAccount {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: string;
  permissions: string[];
  company_id: string;
  company_name: string;
  company_city: string;
  company_logo_url: string | null;
}

interface CompanyAuthContextType {
  account: CompanyAccount | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => void;
}

const CompanyAuthContext = createContext<CompanyAuthContextType | undefined>(undefined);

const STORAGE_KEY = "company_auth_token";
const ACCOUNT_KEY = "company_auth_account";

export function CompanyAuthProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<CompanyAccount | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Restore session from localStorage
    const savedToken = localStorage.getItem(STORAGE_KEY);
    const savedAccount = localStorage.getItem(ACCOUNT_KEY);
    if (savedToken && savedAccount) {
      try {
        const parsed = JSON.parse(savedAccount);
        // Check token expiry
        const parts = savedToken.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          if (payload.exp && payload.exp > Math.floor(Date.now() / 1000)) {
            setToken(savedToken);
            setAccount(parsed);
          } else {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(ACCOUNT_KEY);
          }
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(ACCOUNT_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("company-auth-login", {
        body: { email, password },
      });

      if (error) {
        return { error: new Error(error.message || "Login failed") };
      }

      if (data?.error) {
        return { error: new Error(data.error) };
      }

      if (data?.success && data?.token && data?.account) {
        setToken(data.token);
        setAccount(data.account);
        localStorage.setItem(STORAGE_KEY, data.token);
        localStorage.setItem(ACCOUNT_KEY, JSON.stringify(data.account));
        return { error: null };
      }

      return { error: new Error("Unexpected response") };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signOut = () => {
    setToken(null);
    setAccount(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ACCOUNT_KEY);
  };

  return (
    <CompanyAuthContext.Provider
      value={{
        account,
        token,
        isLoading,
        isAuthenticated: !!account && !!token,
        login,
        signOut,
      }}
    >
      {children}
    </CompanyAuthContext.Provider>
  );
}

export function useCompanyAuth() {
  const context = useContext(CompanyAuthContext);
  if (!context) {
    throw new Error("useCompanyAuth must be used within CompanyAuthProvider");
  }
  return context;
}
