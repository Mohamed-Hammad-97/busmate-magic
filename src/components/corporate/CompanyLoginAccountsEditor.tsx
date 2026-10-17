import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { KeyRound, Plus, X } from 'lucide-react';

interface Props {
  companyId: string;
  defaultName: string;
  defaultPhone: string;
}

export function CompanyLoginAccountsEditor({ companyId, defaultName, defaultPhone }: Props) {
  const queryClient = useQueryClient();
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [adding, setAdding] = useState(false);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['company-login-accounts', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_accounts')
        .select('id, email, full_name, is_active')
        .eq('company_id', companyId)
        .order('created_at');
      if (error) throw error;
      return data || [];
    },
  });

  const changePassword = async (accountId: string) => {
    const pw = passwords[accountId] || '';
    if (pw.length < 6) { toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
    setSavingId(accountId);
    const { data, error } = await supabase.functions.invoke('create-company-account', {
      body: { action: 'reset-password', account_id: accountId, company_id: companyId, password: pw },
    });
    setSavingId(null);
    if (error || data?.error) { toast.error('فشل تغيير كلمة المرور: ' + (data?.error || error?.message)); return; }
    toast.success('تم تغيير كلمة المرور');
    setPasswords((p) => ({ ...p, [accountId]: '' }));
  };

  const addAccount = async () => {
    if (!newEmail || newPassword.length < 6) { toast.error('أدخل البريد وكلمة مرور 6 أحرف على الأقل'); return; }
    setAdding(true);
    const { data, error } = await supabase.functions.invoke('create-company-account', {
      body: { company_id: companyId, email: newEmail, password: newPassword, full_name: defaultName || newEmail, phone: defaultPhone },
    });
    setAdding(false);
    if (error || data?.error) { toast.error('فشل إنشاء الحساب: ' + (data?.error || error?.message)); return; }
    toast.success('تم إنشاء الحساب');
    setNewEmail(''); setNewPassword(''); setShowAdd(false);
    queryClient.invalidateQueries({ queryKey: ['company-login-accounts', companyId] });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-primary">حسابات دخول الشركة</p>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">جاري التحميل...</p>
      ) : accounts.length === 0 ? (
        <p className="text-xs text-muted-foreground">لا توجد حسابات بعد</p>
      ) : (
        accounts.map((acc: any) => (
          <div key={acc.id} className="rounded-xl border border-border/50 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Input value={acc.email} readOnly disabled dir="ltr" className="bg-muted/50" />
              {!acc.is_active && <Badge variant="destructive" className="text-[10px] shrink-0">معطل</Badge>}
            </div>
            <div className="flex gap-2">
              <Input
                type="password"
                autoComplete="new-password"
                name={`new-pw-${acc.id}`}
                placeholder="كلمة مرور جديدة"
                value={passwords[acc.id] || ''}
                onChange={(e) => setPasswords((p) => ({ ...p, [acc.id]: e.target.value }))}
              />
              <Button type="button" size="sm" variant="outline" className="gap-1 shrink-0"
                disabled={savingId === acc.id || !passwords[acc.id]}
                onClick={() => changePassword(acc.id)}>
                <KeyRound className="h-4 w-4" />
                {savingId === acc.id ? '...' : 'تغيير'}
              </Button>
            </div>
          </div>
        ))
      )}

      {showAdd ? (
        <div className="rounded-xl border border-primary/30 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">حساب جديد</p>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(false)}><X className="h-4 w-4" /></Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>البريد الإلكتروني</Label>
              <Input type="email" autoComplete="off" name="new-company-email" dir="ltr" placeholder="user@company.com"
                value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>كلمة المرور</Label>
              <Input type="password" autoComplete="new-password" name="new-company-password" placeholder="••••••••"
                value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
          </div>
          <Button type="button" className="w-full" disabled={adding} onClick={addAccount}>
            {adding ? 'جاري الإنشاء...' : 'إنشاء الحساب'}
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" /> إضافة حساب آخر
        </Button>
      )}
    </div>
  );
}
