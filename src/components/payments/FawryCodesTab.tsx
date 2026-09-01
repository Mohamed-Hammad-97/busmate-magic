import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCity } from '@/contexts/CityContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Search, Phone, User, CheckCircle2, Hash, Route, FileSpreadsheet } from 'lucide-react';
import { format, isBefore, parseISO, startOfDay, addDays } from 'date-fns';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

const cityMapping: Record<string, string[]> = {
  cairo: ['cairo', 'القاهرة'],
  giza: ['giza', 'الجيزة'],
  alexandria: ['alexandria', 'الإسكندرية', 'الاسكندرية'],
};

export const FawryCodesTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { selectedCity } = useCity();
  const { isSuperAdmin, hasDepartment, employee } = useAuth();
  const canSetReference = isSuperAdmin || hasDepartment('finance');
  const canSetNote = isSuperAdmin || hasDepartment('finance') || hasDepartment('customer_support');
  const canClear = isSuperAdmin || hasDepartment('finance');

  const [search, setSearch] = useState('');
  const [phoneFilter, setPhoneFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'insurance' | 'installments'>('all');
  const [installmentNumber, setInstallmentNumber] = useState<string>('all');
  const [lineFilter, setLineFilter] = useState<string>('all');
  const [subscriptionTypeFilter, setSubscriptionTypeFilter] = useState<'all' | 'yearly' | 'monthly'>('all');
  const [drafts, setDrafts] = useState<Record<string, { code: string; note: string; hours: string }>>({});
  const [, setTick] = useState(0);

  // Re-render every minute so expired codes clear themselves without a refresh
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['fawry-codes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          subscriptions (
            id,
            subscription_type,
            registration_id,
            registrations (
              id,
              student_name,
              status,
              schools (name),
              parent_accounts (parent_name, city, father_phone, payment_phone)
            )
          )
        `)
        .in('status', ['pending', 'overdue'])
        .eq('fawry_cleared', false)
        .order('due_date', { ascending: true });
      if (error) throw error;

      const today = startOfDay(new Date());
      const upcomingLimit = addDays(today, 7);
      return (data || []).filter((p: any) => {
        const registration = p.subscriptions?.registrations;
        if (!registration || registration.status === 'archived' || registration.status === 'cancelled') return false;
        if (!p.due_date) return false;
        const due = parseISO(p.due_date);
        return isBefore(due, today) || due.getTime() <= upcomingLimit.getTime();
      });
    },
  });

  const registrationIds = useMemo(() => {
    const ids = new Set<string>();
    (rows as any[]).forEach((p) => {
      const regId = p.subscriptions?.registration_id;
      if (regId) ids.add(regId);
    });
    return Array.from(ids);
  }, [rows]);

  const { data: routeAssignments = [] } = useQuery({
    queryKey: ['fawry-route-assignments', registrationIds],
    queryFn: async () => {
      if (registrationIds.length === 0) return [];
      const { data, error } = await supabase
        .from('route_assignments')
        .select('registration_id, routes (id, name, route_number)')
        .in('registration_id', registrationIds);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: registrationIds.length > 0,
  });

  const routeMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string; route_number?: number }>();
    routeAssignments.forEach((ra: any) => {
      const regId = ra.registration_id;
      const route = ra.routes;
      if (regId && route && !map.has(regId)) {
        map.set(regId, route);
      }
    });
    return map;
  }, [routeAssignments]);

  const lineOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; route_number?: number }>();
    (rows as any[]).forEach((p) => {
      const regId = p.subscriptions?.registration_id;
      const route = regId ? routeMap.get(regId) : undefined;
      if (route) map.set(route.id, route);
    });
    return Array.from(map.values()).sort((a, b) => (a.route_number ?? 0) - (b.route_number ?? 0));
  }, [rows, routeMap]);

  const codeIsValid = (p: any) =>
    !!p.fawry_reference_code &&
    (!p.fawry_code_expires_at || new Date(p.fawry_code_expires_at).getTime() > Date.now());

  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      (rows as any[]).forEach((r) => {
        if (!next[r.id]) {
          next[r.id] = {
            code: codeIsValid(r) ? r.fawry_reference_code : '',
            note: r.fawry_note || '',
            hours: '24',
          };
        }
      });
      return next;
    });
  }, [rows]);

  const filtered = useMemo(() => {
    return (rows as any[]).filter((p) => {
      const reg = p.subscriptions?.registrations;
      const parent = reg?.parent_accounts;
      const regId = p.subscriptions?.registration_id;
      const route = regId ? routeMap.get(regId) : undefined;
      if (selectedCity !== 'all') {
        const variants = cityMapping[selectedCity] || [selectedCity];
        const c = (parent?.city || '').toLowerCase();
        if (!variants.some((v) => c === v.toLowerCase())) return false;
      }
      const s = search.trim().toLowerCase();
      if (s) {
        const hay = `${reg?.student_name || ''} ${parent?.parent_name || ''} ${reg?.schools?.name || ''} ${p.fawry_reference_code || ''} ${route?.name || ''}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      if (nameFilter.trim()) {
        const n = nameFilter.trim().toLowerCase();
        if (!`${reg?.student_name || ''} ${parent?.parent_name || ''}`.toLowerCase().includes(n)) return false;
      }
      if (phoneFilter.trim()) {
        const ph = phoneFilter.replace(/\D/g, '');
        const phones = `${parent?.payment_phone || ''}${parent?.father_phone || ''}`.replace(/\D/g, '');
        if (!phones.includes(ph)) return false;
      }
      if (typeFilter !== 'all') {
        const isInsurance = Number(p.installment_number) === 0;
        if (typeFilter === 'insurance' && !isInsurance) return false;
        if (typeFilter === 'installments' && isInsurance) return false;
      }
      if (typeFilter === 'installments' && installmentNumber !== 'all') {
        if (Number(p.installment_number) !== Number(installmentNumber)) return false;
      }
      if (lineFilter !== 'all') {
        if (!route || route.id !== lineFilter) return false;
      }
      if (subscriptionTypeFilter !== 'all') {
        const subType = p.subscriptions?.subscription_type;
        if (subType !== subscriptionTypeFilter) return false;
      }
      return true;
    });
  }, [rows, selectedCity, search, nameFilter, phoneFilter, typeFilter, installmentNumber, lineFilter, routeMap, subscriptionTypeFilter]);

  const installmentOptions = useMemo(() => {
    const set = new Set<number>();
    (rows as any[]).forEach((p) => {
      const n = Number(p.installment_number);
      if (n > 0) set.add(n);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [rows]);

  useEffect(() => {
    if (typeFilter !== 'installments') setInstallmentNumber('all');
  }, [typeFilter]);

  const totalDue = filtered.reduce((sum, p: any) => sum + Number(p.amount || 0), 0);

  const exportExcel = () => {
    const headers = [
      'الطالب', 'ولي الأمر', 'المدرسة', 'الخط', 'نوع الاشتراك',
      'رقم الدفع والتجديد', 'رقم القسط', 'المبلغ (EGP)', 'تاريخ الاستحقاق',
      'كود فورى', 'صلاحية الكود', 'ملاحظات',
    ];
    const data = filtered.map((p: any) => {
      const reg = p.subscriptions?.registrations;
      const parent = reg?.parent_accounts;
      const regId = p.subscriptions?.registration_id;
      const route = regId ? routeMap.get(regId) : undefined;
      const subType = p.subscriptions?.subscription_type;
      const valid = codeIsValid(p);
      const n = Number(p.installment_number);
      return [
        reg?.student_name || '',
        parent?.parent_name || '',
        reg?.schools?.name || '',
        route ? `${route.route_number ? `#${route.route_number} ` : ''}${route.name}` : '',
        subType === 'yearly' ? 'سنوي' : subType === 'monthly' ? 'شهري' : '',
        parent?.payment_phone || parent?.father_phone || '',
        n === 0 ? 'التأمين' : `القسط ${n}`,
        Number(p.amount || 0),
        p.due_date ? format(new Date(p.due_date), 'yyyy-MM-dd') : '',
        valid ? p.fawry_reference_code || '' : '',
        valid && p.fawry_code_expires_at ? format(new Date(p.fawry_code_expires_at), 'yyyy-MM-dd HH:mm') : '',
        p.fawry_note || '',
      ];
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    ws['!cols'] = [{ wch: 22 }, { wch: 22 }, { wch: 24 }, { wch: 20 }, { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 28 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'اكواد فورى');
    XLSX.writeFile(wb, `fawry-codes-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success(`تم تصدير ${filtered.length} سجل`);
  };

  const saveField = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, any> }) => {
      const { error } = await supabase.from('payments').update(patch as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fawry-codes'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const clearRow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('payments')
        .update({
          fawry_cleared: true,
          fawry_cleared_at: new Date().toISOString(),
          fawry_cleared_by: employee?.id ?? null,
          fawry_reference_code: null,
          fawry_code_expires_at: null,
        } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم — تمت إزالة السجل من اكواد فورى');
      queryClient.invalidateQueries({ queryKey: ['fawry-codes'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-11 bg-card border-border/50 rounded-xl" />
        </div>
        <div className="relative w-full sm:w-[200px]">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Filter by phone..." dir="ltr" value={phoneFilter} onChange={(e) => setPhoneFilter(e.target.value)} className="pl-10 h-11 bg-card border-border/50 rounded-xl" />
        </div>
        <div className="relative w-full sm:w-[200px]">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Filter by name..." value={nameFilter} onChange={(e) => setNameFilter(e.target.value)} className="pl-10 h-11 bg-card border-border/50 rounded-xl" />
        </div>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
          <SelectTrigger className="w-full sm:w-[190px] h-11 bg-card border-border/50 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل (القسط والتأمين)</SelectItem>
            <SelectItem value="installments">الأقساط</SelectItem>
            <SelectItem value="insurance">التأمين</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={installmentNumber}
          onValueChange={setInstallmentNumber}
          disabled={typeFilter !== 'installments'}
        >
          <SelectTrigger className="w-full sm:w-[170px] h-11 bg-card border-border/50 rounded-xl">
            <SelectValue placeholder="رقم القسط" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأقساط</SelectItem>
            {installmentOptions.map((n) => (
              <SelectItem key={n} value={String(n)}>القسط {n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={lineFilter} onValueChange={setLineFilter}>
          <SelectTrigger className="w-full sm:w-[190px] h-11 bg-card border-border/50 rounded-xl">
            <SelectValue placeholder="الخط" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الخطوط</SelectItem>
            {lineOptions.map((route) => (
              <SelectItem key={route.id} value={route.id}>
                {route.route_number ? `#${route.route_number} ` : ''}{route.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={subscriptionTypeFilter} onValueChange={(v) => setSubscriptionTypeFilter(v as typeof subscriptionTypeFilter)}>
          <SelectTrigger className="w-full sm:w-[180px] h-11 bg-card border-border/50 rounded-xl">
            <SelectValue placeholder="نوع الاشتراك" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الاشتراكات</SelectItem>
            <SelectItem value="yearly">سنوي</SelectItem>
            <SelectItem value="monthly">شهري</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-2xl border border-warning/20 bg-warning/5 p-4 flex items-center justify-between">
        <span className="text-sm font-medium text-warning">إجمالي المستحق</span>
        <span className="font-bold text-warning">{totalDue.toLocaleString()} EGP ({filtered.length} أقساط)</span>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">لا توجد سجلات مستحقة.</p>
      ) : (
        <div className="rounded-xl border border-border/50 overflow-x-auto max-h-[65vh] overflow-y-auto">
          <Table className="min-w-[1300px]">
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-xs">الطالب</TableHead>
                <TableHead className="text-xs">ولي الأمر</TableHead>
                <TableHead className="text-xs">المدرسة</TableHead>
                <TableHead className="text-xs">الخط</TableHead>
                <TableHead className="text-xs">نوع الاشتراك</TableHead>
                <TableHead className="text-xs">رقم الدفع والتجديد</TableHead>
                <TableHead className="text-xs">رقم القسط</TableHead>
                <TableHead className="text-xs">المبلغ</TableHead>
                <TableHead className="text-xs">تاريخ الاستحقاق</TableHead>
                <TableHead className="text-xs">كود فورى</TableHead>
                <TableHead className="text-xs">صلاحية الكود</TableHead>
                <TableHead className="text-xs">ملاحظات</TableHead>
                <TableHead className="text-xs text-center">تم</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p: any) => {
                const reg = p.subscriptions?.registrations;
                const parent = reg?.parent_accounts;
                const regId = p.subscriptions?.registration_id;
                const route = regId ? routeMap.get(regId) : undefined;
                const subType = p.subscriptions?.subscription_type;
                const draft = drafts[p.id] || { code: '', note: '', hours: '24' };
                const valid = codeIsValid(p);
                const expiresAt = valid && p.fawry_code_expires_at ? new Date(p.fawry_code_expires_at) : null;
                const expiredCode = !!p.fawry_reference_code && !valid;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm font-medium">{reg?.student_name || '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{parent?.parent_name || '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{reg?.schools?.name || '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {route ? (
                        <span className="inline-flex items-center gap-1">
                          <Route className="h-3 w-3 text-muted-foreground" />
                          {route.route_number ? `#${route.route_number} ` : ''}{route.name}
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {subType === 'yearly' ? (
                        <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">سنوي</Badge>
                      ) : subType === 'monthly' ? (
                        <Badge variant="outline" className="text-[10px] border-info/30 text-info">شهري</Badge>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground" dir="ltr">{parent?.payment_phone || parent?.father_phone || '-'}</TableCell>
                    <TableCell className="text-sm">
                      {Number(p.installment_number) === 0 ? (
                        <Badge variant="secondary" className="text-[10px]">التأمين</Badge>
                      ) : (
                        <span className="inline-flex items-center gap-1"><Hash className="h-3 w-3 text-muted-foreground" />القسط {p.installment_number}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-semibold">{Number(p.amount).toLocaleString()} EGP</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.due_date ? format(new Date(p.due_date), 'dd MMM yyyy') : '-'}</TableCell>
                    <TableCell>
                      <Input
                        value={draft.code}
                        dir="ltr"
                        disabled={!canSetReference}
                        placeholder="كود فورى"
                        onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: { ...draft, code: e.target.value } }))}
                        onBlur={() => {
                          const currentCode = valid ? p.fawry_reference_code : '';
                          if (currentCode !== draft.code) {
                            const hours = Number(draft.hours);
                            const expires =
                              draft.code && hours > 0
                                ? new Date(Date.now() + hours * 3600_000).toISOString()
                                : null;
                            saveField.mutate({
                              id: p.id,
                              patch: {
                                fawry_reference_code: draft.code || null,
                                fawry_code_expires_at: draft.code ? expires : null,
                              },
                            });
                          }
                        }}
                        className="h-9 w-[150px] rounded-lg"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Input
                          type="number"
                          min={1}
                          dir="ltr"
                          disabled={!canSetReference}
                          placeholder="ساعات"
                          value={draft.hours}
                          onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: { ...draft, hours: e.target.value } }))}
                          className="h-9 w-[100px] rounded-lg"
                        />
                        {expiresAt ? (
                          <span className="text-[10px] text-muted-foreground">
                            ينتهي {format(expiresAt, 'dd MMM HH:mm')}
                          </span>
                        ) : expiredCode ? (
                          <span className="text-[10px] text-destructive">انتهت الصلاحية</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={draft.note}
                        disabled={!canSetNote}
                        placeholder="ملاحظات"
                        onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: { ...draft, note: e.target.value } }))}
                        onBlur={() => {
                          if ((p.fawry_note || '') !== draft.note) {
                            saveField.mutate({ id: p.id, patch: { fawry_note: draft.note || null } });
                          }
                        }}
                        className="h-9 w-[180px] rounded-lg"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      {canClear ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-success hover:bg-success/10">
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>تأكيد الدفع</AlertDialogTitle>
                              <AlertDialogDescription>
                                سيتم إزالة هذا القسط من تبويب اكواد فورى.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction onClick={() => clearRow.mutate(p.id)}>تأكيد</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default FawryCodesTab;
