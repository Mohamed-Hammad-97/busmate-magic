import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CompanyAuthContext } from '@/contexts/CompanyAuthContext';
import CompanyDashboard from './CompanyDashboard';
import { Eye } from 'lucide-react';

// Silent, read-only view of a company's portal for Seater super admins.
export default function CompanyAdminView() {
  const { companyId } = useParams<{ companyId: string }>();
  const { isSuperAdmin, isLoading } = useAuth();
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAccessToken(data.session?.access_token ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setAccessToken(session?.access_token ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const { data: company } = useQuery({
    queryKey: ['admin-view-company', companyId],
    enabled: !!companyId && isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('id, name, city, logo_url').eq('id', companyId!).single();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return null;
  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;
  if (!company || !accessToken) return <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>;

  const account = {
    id: 'admin-view', email: '', full_name: 'Seater Admin', phone: null, role: 'viewer', permissions: [],
    company_id: company.id, company_name: company.name, company_city: company.city, company_logo_url: company.logo_url,
  };

  return (
    <CompanyAuthContext.Provider value={{
      account, token: `admin:${company.id}|${accessToken}`, isLoading: false, isAuthenticated: true, readOnly: true,
      login: async () => ({ error: new Error('read-only') }), signOut: () => window.close(),
    }}>
      <div className="sticky top-0 z-[60] flex items-center justify-center gap-2 bg-warning text-warning-foreground py-2 text-sm font-semibold" dir="rtl">
        <Eye className="h-4 w-4" /> عرض الإدارة - للقراءة فقط (الشركة لا ترى هذا)
      </div>
      <CompanyDashboard />
    </CompanyAuthContext.Provider>
  );
}
