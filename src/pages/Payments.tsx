import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Search, CreditCard, CheckCircle, Clock, AlertCircle, Check, Eye, Hash, TrendingUp, DollarSign, UserCheck, Trash2, Archive, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { exportPaymentsExcel, exportPaymentsPDF } from '@/lib/exportPayments';
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
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { PaymentProfileDialog } from '@/components/payments/PaymentProfileDialog';
import { PaymentReminders } from '@/components/payments/PaymentReminders';
import { InvoiceGenerator } from '@/components/payments/InvoiceGenerator';
import { useCity } from '@/contexts/CityContext';
import { PageHero } from '@/components/layout/PageHero';

const Payments = () => {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'ar' ? ar : enUS;
  const queryClient = useQueryClient();
  const { selectedCity } = useCity();
  const { isSuperAdmin, hasDepartment } = useAuth();
  const canEdit = isSuperAdmin || hasDepartment('finance');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [installmentFilter, setInstallmentFilter] = useState<string>('');
  const [paymentTab, setPaymentTab] = useState<string>('all');
  const [mainTab, setMainTab] = useState<'active' | 'archive'>('active');
  const [archiveYear, setArchiveYear] = useState<string>('all');
  const [selectedRegistration, setSelectedRegistration] = useState<{
    registrationId: string;
    payments: any[];
    subscription: any;
    parentName: string;
    studentName: string;
  } | null>(null);

  const { data: allPayments = [], isLoading } = useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      let all: any[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('payments')
          .select(`
            *,
            payment_extra_fees (*),
            subscriptions (
              id,
              registration_id,
              subscription_type,
              value,
              number_of_installments,
              registrations (
                id,
                student_name,
                parent_accounts (parent_name, city, father_phone, mother_phone, emergency_phone, payment_phone)
              )
            )
          `)
          .order('due_date', { ascending: true })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      return all;
    },
  });

  const cityPayments = useMemo(() => {
    if (selectedCity === 'all') return allPayments;
    const cityMapping: Record<string, string[]> = {
      cairo: ['cairo', 'القاهرة', 'قاهرة'],
      giza: ['giza', 'الجيزة', 'جيزة'],
      alexandria: ['alexandria', 'الإسكندرية', 'اسكندرية', 'إسكندرية'],
    };
    const cityNames = cityMapping[selectedCity] || [];
    return allPayments.filter((p: any) => {
      const city = p.subscriptions?.registrations?.parent_accounts?.city;
      return cityNames.some((name) => city?.toLowerCase().includes(name.toLowerCase()));
    });
  }, [allPayments, selectedCity]);

  const archivedPayments = useMemo(
    () => cityPayments.filter((p: any) => p.status === 'archived'),
    [cityPayments]
  );

  const activePayments = useMemo(
    () => cityPayments.filter((p: any) => p.status !== 'archived'),
    [cityPayments]
  );

  const archiveYears = useMemo(() => {
    const counts: Record<string, number> = {};
    archivedPayments.forEach((p: any) => {
      const d = p.updated_at || p.created_at;
      if (!d) return;
      const year = String(new Date(d).getFullYear());
      counts[year] = (counts[year] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => Number(b[0]) - Number(a[0]));
  }, [archivedPayments]);

  const payments = useMemo(() => {
    if (mainTab === 'active') return activePayments;
    if (archiveYear === 'all') return archivedPayments;
    return archivedPayments.filter((p: any) => {
      const d = p.updated_at || p.created_at;
      return d && String(new Date(d).getFullYear()) === archiveYear;
    });
  }, [mainTab, archiveYear, activePayments, archivedPayments]);


  const deleteSubscriptionMutation = useMutation({
    mutationFn: async (subscriptionId: string) => {
      // Delete extra fees first, then payments, then subscription
      const { data: paymentsData } = await supabase
        .from('payments')
        .select('id')
        .eq('subscription_id', subscriptionId);
      if (paymentsData && paymentsData.length > 0) {
        const paymentIds = paymentsData.map(p => p.id);
        await supabase.from('payment_extra_fees').delete().in('payment_id', paymentIds);
        await supabase.from('payments').delete().eq('subscription_id', subscriptionId);
      }
      const { error } = await supabase.from('subscriptions').delete().eq('id', subscriptionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success(t('common.deleted') || 'Deleted successfully');
    },
    onError: (error) => {
      toast.error(t('common.error') || 'Error deleting');
      console.error(error);
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase
        .from('payments')
        .update({ status: 'paid', paid_date: new Date().toISOString().split('T')[0] })
        .eq('id', paymentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success(t('payments.paymentSuccess'));
    },
    onError: (error) => { toast.error(t('payments.paymentError')); console.error(error); },
  });

  const archiveSubscriptionMutation = useMutation({
    mutationFn: async (subscriptionId: string) => {
      const { error } = await supabase
        .from('payments')
        .update({ status: 'archived' })
        .eq('subscription_id', subscriptionId)
        .in('status', ['pending', 'overdue']);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success('Moved to archive');
    },
    onError: (error) => { toast.error('Failed to archive'); console.error(error); },
  });

  const paymentsByRegistration = useMemo(() => {
    const grouped: Record<string, { registrationId: string; payments: any[]; subscription: any; parentName: string; studentName: string; totalAmount: number; paidAmount: number; isFullyPaid: boolean; }> = {};
    payments.forEach((payment: any) => {
      const registrationId = payment.subscriptions?.registration_id;
      if (!registrationId) return;
      if (!grouped[registrationId]) {
        grouped[registrationId] = { registrationId, payments: [], subscription: payment.subscriptions, parentName: payment.subscriptions?.registrations?.parent_accounts?.parent_name || '', studentName: payment.subscriptions?.registrations?.student_name || '', totalAmount: payment.subscriptions?.value || 0, paidAmount: 0, isFullyPaid: false };
      }
      grouped[registrationId].payments.push(payment);
      if (payment.status === 'paid') grouped[registrationId].paidAmount += Number(payment.amount);
    });
    // Include extra fees in totalAmount
    Object.values(grouped).forEach((reg) => {
      const extraFeesTotal = reg.payments.reduce((sum: number, p: any) => {
        const fees = p.payment_extra_fees || [];
        return sum + fees.reduce((fSum: number, f: any) => fSum + Number(f.amount), 0);
      }, 0);
      reg.totalAmount = (reg.subscription?.value || 0) + extraFeesTotal;
      reg.isFullyPaid = reg.paidAmount >= reg.totalAmount;
    });
    return grouped;
  }, [payments]);

  const filteredByPaymentStatus = useMemo(() => {
    if (paymentTab === 'all') return payments;
    const registrationIds = Object.values(paymentsByRegistration)
      .filter(reg => paymentTab === 'fully_paid' ? reg.isFullyPaid : !reg.isFullyPaid)
      .map(reg => reg.registrationId);
    return payments.filter((payment: any) => registrationIds.includes(payment.subscriptions?.registration_id));
  }, [payments, paymentsByRegistration, paymentTab]);

  const filteredPayments = filteredByPaymentStatus.filter((payment: any) => {
    const parentName = payment.subscriptions?.registrations?.parent_accounts?.parent_name || '';
    const studentName = payment.subscriptions?.registrations?.student_name || '';
    const matchesSearch = parentName.toLowerCase().includes(searchTerm.toLowerCase()) || studentName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
    const matchesInstallments = !installmentFilter || payment.subscriptions?.number_of_installments === parseInt(installmentFilter);
    return matchesSearch && matchesStatus && matchesInstallments;
  });

  // Grouped view filtered by search/status
  const filteredGrouped = useMemo(() => {
    const result: typeof paymentsByRegistration = {};
    Object.entries(paymentsByRegistration).forEach(([regId, regData]) => {
      // Filter by payment tab
      if (paymentTab === 'fully_paid' && !regData.isFullyPaid) return;
      if (paymentTab === 'partial' && regData.isFullyPaid) return;
      // Filter by search
      const matchesSearch = regData.parentName.toLowerCase().includes(searchTerm.toLowerCase()) || regData.studentName.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return;
      result[regId] = regData;
    });
    return result;
  }, [paymentsByRegistration, paymentTab, searchTerm]);

  const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
    paid: { label: t('payments.paid'), variant: 'default', icon: <CheckCircle className="h-4 w-4" /> },
    pending: { label: t('payments.pending'), variant: 'secondary', icon: <Clock className="h-4 w-4" /> },
    overdue: { label: t('payments.overdue'), variant: 'destructive', icon: <AlertCircle className="h-4 w-4" /> },
  };

  const subscriptionTypeLabels: Record<string, string> = {
    monthly: t('payments.monthly'),
    yearly: t('payments.yearly'),
  };

  const stats = useMemo(() => {
    const extraFeesForPayments = (p: any) => (p.payment_extra_fees || []).reduce((s: number, f: any) => s + Number(f.amount), 0);
    const total = payments.reduce((sum: number, p: any) => sum + Number(p.amount) + extraFeesForPayments(p), 0);
    const paid = payments.filter((p: any) => p.status === 'paid').reduce((sum: number, p: any) => sum + Number(p.amount), 0);
    const pending = payments.filter((p: any) => p.status === 'pending').reduce((sum: number, p: any) => sum + Number(p.amount) + extraFeesForPayments(p), 0);
    const overdue = payments.filter((p: any) => p.status === 'overdue').reduce((sum: number, p: any) => sum + Number(p.amount) + extraFeesForPayments(p), 0);
    return { total, paid, pending, overdue };
  }, [payments]);

  const tabStats = useMemo(() => {
    const registrations = Object.values(paymentsByRegistration);
    const fullyPaid = registrations.filter(r => r.isFullyPaid);
    const partial = registrations.filter(r => !r.isFullyPaid);
    return {
      fullyPaidCount: fullyPaid.length,
      fullyPaidAmount: fullyPaid.reduce((sum, r) => sum + r.paidAmount, 0),
      partialCount: partial.length,
      partialPaidAmount: partial.reduce((sum, r) => sum + r.paidAmount, 0),
      partialRemainingAmount: partial.reduce((sum, r) => sum + (r.totalAmount - r.paidAmount), 0),
    };
  }, [paymentsByRegistration]);

  const openPaymentProfile = (payment: any) => {
    const registrationId = payment.subscriptions?.registration_id;
    const regData = paymentsByRegistration[registrationId];
    if (regData) setSelectedRegistration(regData);
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <PageHero
          icon={CreditCard}
          title={t('payments.title')}
          description={t('payments.description')}
          stats={[
            { icon: CreditCard, value: stats.total.toLocaleString(), label: 'Total (EGP)' },
            { icon: CheckCircle, value: stats.paid.toLocaleString(), label: t('payments.paid') },
            { icon: Clock, value: stats.pending.toLocaleString(), label: t('payments.pending') },
            { icon: AlertCircle, value: stats.overdue.toLocaleString(), label: t('payments.overdue') },
          ]}
        />

        {/* Payment Reminders */}
        <PaymentReminders payments={payments} onViewPayment={(payment) => openPaymentProfile(payment)} />

        {/* Premium Stats Grid */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-primary/10"><CreditCard className="h-4 w-4 text-primary" /></div>
                <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <p className="text-3xl font-bold tracking-tight text-foreground">{stats.total.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('payments.totalDue')} (EGP)</p>
            </div>
          </div>
          <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-success/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-success/10"><CheckCircle className="h-4 w-4 text-success" /></div>
              </div>
              <p className="text-3xl font-bold tracking-tight text-foreground">{stats.paid.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('payments.paid')} (EGP)</p>
            </div>
          </div>
          <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-warning/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-warning/10"><Clock className="h-4 w-4 text-warning" /></div>
              </div>
              <p className="text-3xl font-bold tracking-tight text-foreground">{stats.pending.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('payments.pending')} (EGP)</p>
            </div>
          </div>
          <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-destructive/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-destructive/10"><AlertCircle className="h-4 w-4 text-destructive" /></div>
              </div>
              <p className="text-3xl font-bold tracking-tight text-foreground">{stats.overdue.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('payments.overdue')} (EGP)</p>
            </div>
          </div>
        </div>

        {/* Active / Archive Main Tabs */}
        <div className="space-y-3 animate-fade-in" style={{ animationDelay: '0.15s' }}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Tabs value={mainTab} onValueChange={(v) => { setMainTab(v as 'active' | 'archive'); setArchiveYear('all'); }}>
              <TabsList className="bg-muted/50 p-1 rounded-xl h-auto">
                <TabsTrigger value="active" className="gap-2 rounded-lg px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
                  Active
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{activePayments.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="archive" className="gap-2 rounded-lg px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
                  Archive
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{archivedPayments.length}</Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="gap-2 h-10 rounded-xl shadow-sm">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => exportPaymentsExcel(filteredGrouped, `payments-${mainTab}`)}>
                  <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-600" />
                  Download Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportPaymentsPDF(filteredGrouped, `payments-${mainTab}`, `Payments — ${mainTab === 'active' ? 'Active' : 'Archive'}`)}>
                  <FileText className="h-4 w-4 mr-2 text-red-600" />
                  Download PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {mainTab === 'archive' && archiveYears.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setArchiveYear('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${archiveYear === 'all' ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
              >
                All Years ({archivedPayments.length})
              </button>
              {archiveYears.map(([year, count]) => (
                <button
                  key={year}
                  onClick={() => setArchiveYear(year)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${archiveYear === year ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
                >
                  {year} ({count})
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Payment Status Tabs */}
        <div className="space-y-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <Tabs value={paymentTab} onValueChange={setPaymentTab}>
            <TabsList className="bg-muted/50 p-1 rounded-xl h-auto">
              <TabsTrigger value="all" className="rounded-lg px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">{t('common.all')}</TabsTrigger>
              <TabsTrigger value="fully_paid" className="gap-2 rounded-lg px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
                {t('payments.fullyPaid')}
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{tabStats.fullyPaidCount}</Badge>
              </TabsTrigger>
              <TabsTrigger value="partial" className="gap-2 rounded-lg px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
                {t('payments.partialPayment')}
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{tabStats.partialCount}</Badge>
              </TabsTrigger>
            </TabsList>

            {/* Tab Summary Cards */}
            {paymentTab === 'fully_paid' && (
              <div className="rounded-2xl border border-success/20 bg-success/5 p-4 mt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-success font-medium">{t('payments.paidAmount')}:</span>
                  <span className="font-bold text-success">{tabStats.fullyPaidAmount.toLocaleString()} EGP ({tabStats.fullyPaidCount} {t('payments.registrationsCount')})</span>
                </div>
              </div>
            )}
            {paymentTab === 'partial' && (
              <div className="rounded-2xl border border-warning/20 bg-warning/5 p-4 mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-warning font-medium">{t('payments.paidSoFar')}:</span>
                  <span className="font-bold text-warning">{tabStats.partialPaidAmount.toLocaleString()} EGP</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-destructive font-medium">{t('payments.remaining')}:</span>
                  <span className="font-bold text-destructive">{tabStats.partialRemainingAmount.toLocaleString()} EGP</span>
                </div>
              </div>
            )}

            <TabsContent value={paymentTab} className="mt-4 space-y-4">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder={t('common.search') + '...'} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-11 bg-card border-border/50 focus:border-primary/50 rounded-xl transition-all" />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px] h-11 bg-card border-border/50 rounded-xl">
                    <SelectValue placeholder={t('payments.paymentStatus')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('common.all')}</SelectItem>
                    <SelectItem value="paid">{t('payments.paid')}</SelectItem>
                    <SelectItem value="pending">{t('payments.pending')}</SelectItem>
                    <SelectItem value="overdue">{t('payments.overdue')}</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative w-[160px]">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="number" placeholder={t('payments.installments') + '...'} value={installmentFilter} onChange={(e) => setInstallmentFilter(e.target.value)} className="pl-10 h-11 bg-card border-border/50 rounded-xl" min="1" max="10" />
                </div>
              </div>

              {/* Premium Table - One row per user */}
              <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-border/50 flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-primary/10"><CreditCard className="h-4 w-4 text-primary" /></div>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">{t('payments.title')}</h2>
                    <p className="text-xs text-muted-foreground">{Object.keys(filteredGrouped).length} users</p>
                  </div>
                </div>
                {isLoading ? (
                  <div className="p-16 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4 animate-pulse">
                      <CreditCard className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
                  </div>
                ) : Object.keys(filteredGrouped).length === 0 ? (
                  <div className="p-16 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted/50 mb-4">
                      <CreditCard className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground mb-1">{t('payments.noPayments')}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('payments.parentName')}</TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('payments.studentName')}</TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('payments.subscriptionType')}</TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total</TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('payments.paid')}</TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Remaining</TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Progress</TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">{t('common.actions')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.values(filteredGrouped).map((regData) => {
                          const remaining = regData.totalAmount - regData.paidAmount;
                          const progress = regData.totalAmount > 0 ? Math.min((regData.paidAmount / regData.totalAmount) * 100, 100) : 0;
                          return (
                            <TableRow key={regData.registrationId} className="group hover:bg-muted/20 transition-colors duration-150 cursor-pointer" onClick={() => setSelectedRegistration(regData)}>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                    {(regData.parentName || '?')[0].toUpperCase()}
                                  </div>
                                  <span className="font-medium text-sm text-foreground">{regData.parentName || '-'}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{regData.studentName || '-'}</TableCell>
                              <TableCell>
                                <span className="text-xs font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                                  {subscriptionTypeLabels[regData.subscription?.subscription_type] || '-'}
                                </span>
                              </TableCell>
                              <TableCell className="text-sm font-semibold text-foreground">{Number(regData.totalAmount).toLocaleString()} EGP</TableCell>
                              <TableCell className="text-sm font-medium text-success">{regData.paidAmount.toLocaleString()} EGP</TableCell>
                              <TableCell className={`text-sm font-medium ${remaining > 0 ? 'text-destructive' : 'text-success'}`}>{remaining.toLocaleString()} EGP</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-2 rounded-full bg-muted/50 overflow-hidden">
                                    <div className={`h-full rounded-full ${regData.isFullyPaid ? 'bg-success' : 'bg-primary'}`} style={{ width: `${progress}%` }} />
                                  </div>
                                  <span className="text-[10px] text-muted-foreground">{progress.toFixed(0)}%</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="flex justify-end gap-0.5">
                                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => setSelectedRegistration(regData)}>
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                  <InvoiceGenerator
                                    data={{
                                      parentName: regData.parentName,
                                      studentName: regData.studentName,
                                      subscriptionType: regData.subscription?.subscription_type || '',
                                      totalAmount: regData.totalAmount,
                                      paidAmount: regData.paidAmount,
                                      payments: regData.payments,
                                      registrationId: regData.registrationId,
                                    }}
                                    variant="icon"
                                  />
                                  {canEdit && mainTab === 'active' && (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-warning/10 hover:text-warning" title="Archive">
                                          <Archive className="h-3.5 w-3.5" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Archive payments?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            This moves all unpaid installments for {regData.parentName} - {regData.studentName} to the Archive tab and removes them from overdue reminders.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>{t('common.cancel') || 'Cancel'}</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => archiveSubscriptionMutation.mutate(regData.subscription?.id)}
                                          >
                                            Archive
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  )}
                                  {canEdit && (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive">
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>{t('common.confirmDelete') || 'Confirm Delete'}</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            {t('payments.deleteConfirmation') || `This will permanently delete the subscription, all installments, and extra fees for ${regData.parentName} - ${regData.studentName}. This action cannot be undone.`}
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>{t('common.cancel') || 'Cancel'}</AlertDialogCancel>
                                          <AlertDialogAction
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                            onClick={() => deleteSubscriptionMutation.mutate(regData.subscription?.id)}
                                          >
                                            {t('common.delete') || 'Delete'}
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Payment Profile Dialog */}
      {selectedRegistration && (() => {
        const liveRegData = paymentsByRegistration[selectedRegistration.registrationId] || selectedRegistration;
        return (
          <PaymentProfileDialog
            open={!!selectedRegistration}
            onOpenChange={(open) => !open && setSelectedRegistration(null)}
            registrationId={liveRegData.registrationId}
            payments={liveRegData.payments}
            subscription={liveRegData.subscription}
            parentName={liveRegData.parentName}
            studentName={liveRegData.studentName}
            canEdit={canEdit}
          />
        );
      })()}
    </DashboardLayout>
  );
};

export default Payments;
