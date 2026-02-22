import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
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
import { Search, CreditCard, CheckCircle, Clock, AlertCircle, Check, Eye, Hash, TrendingUp, DollarSign, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { PaymentProfileDialog } from '@/components/payments/PaymentProfileDialog';
import { PaymentReminders } from '@/components/payments/PaymentReminders';
import { InvoiceGenerator } from '@/components/payments/InvoiceGenerator';
import { useCity } from '@/contexts/CityContext';

const Payments = () => {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'ar' ? ar : enUS;
  const queryClient = useQueryClient();
  const { selectedCity } = useCity();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [installmentFilter, setInstallmentFilter] = useState<string>('');
  const [paymentTab, setPaymentTab] = useState<string>('all');
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
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          subscriptions (
            id,
            registration_id,
            subscription_type,
            value,
            number_of_installments,
            registrations (
              id,
              student_name,
              parent_accounts (parent_name, city)
            )
          )
        `)
        .order('due_date', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const payments = useMemo(() => {
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
    Object.values(grouped).forEach((reg) => { reg.isFullyPaid = reg.paidAmount >= reg.totalAmount; });
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

  const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
    paid: { label: t('payments.paid'), variant: 'default', icon: <CheckCircle className="h-4 w-4" /> },
    pending: { label: t('payments.pending'), variant: 'secondary', icon: <Clock className="h-4 w-4" /> },
    overdue: { label: t('payments.overdue'), variant: 'destructive', icon: <AlertCircle className="h-4 w-4" /> },
  };

  const subscriptionTypeLabels: Record<string, string> = {
    monthly: t('payments.monthly'),
    yearly: t('payments.yearly'),
  };

  const stats = {
    total: payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0),
    paid: payments.filter((p: any) => p.status === 'paid').reduce((sum: number, p: any) => sum + Number(p.amount), 0),
    pending: payments.filter((p: any) => p.status === 'pending').reduce((sum: number, p: any) => sum + Number(p.amount), 0),
    overdue: payments.filter((p: any) => p.status === 'overdue').reduce((sum: number, p: any) => sum + Number(p.amount), 0),
  };

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
        {/* Premium Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 animate-fade-in">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <CreditCard className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('payments.title')}</h1>
                <p className="text-sm text-muted-foreground">{t('payments.description')}</p>
              </div>
            </div>
          </div>
        </div>

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

              {/* Premium Table */}
              <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-border/50 flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-primary/10"><CreditCard className="h-4 w-4 text-primary" /></div>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">{t('payments.title')}</h2>
                    <p className="text-xs text-muted-foreground">{filteredPayments.length} records</p>
                  </div>
                </div>
                {isLoading ? (
                  <div className="p-16 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4 animate-pulse">
                      <CreditCard className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
                  </div>
                ) : filteredPayments.length === 0 ? (
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
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('payments.installments')}</TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('payments.installmentNumber')}</TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('payments.amount')}</TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('payments.dueDate')}</TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('common.status')}</TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">{t('common.actions')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPayments.map((payment: any) => (
                          <TableRow key={payment.id} className="group hover:bg-muted/20 transition-colors duration-150">
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                  {(payment.subscriptions?.registrations?.parent_accounts?.parent_name || '?')[0].toUpperCase()}
                                </div>
                                <span className="font-medium text-sm text-foreground">{payment.subscriptions?.registrations?.parent_accounts?.parent_name || '-'}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{payment.subscriptions?.registrations?.student_name || '-'}</TableCell>
                            <TableCell>
                              <span className="text-xs font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                                {subscriptionTypeLabels[payment.subscriptions?.subscription_type] || '-'}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{payment.subscriptions?.number_of_installments || '-'}</TableCell>
                            <TableCell className="text-sm text-muted-foreground font-mono">{payment.installment_number}</TableCell>
                            <TableCell className="text-sm font-medium text-foreground">{Number(payment.amount).toLocaleString()} EGP</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{format(new Date(payment.due_date), 'dd MMM yyyy', { locale: dateLocale })}</TableCell>
                            <TableCell>
                              {payment.status === 'paid' ? (
                                <div className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border bg-success/10 text-success border-success/20">
                                  <CheckCircle className="h-3 w-3" />
                                  {t('payments.paid')}
                                </div>
                              ) : payment.status === 'overdue' ? (
                                <div className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border bg-destructive/10 text-destructive border-destructive/20">
                                  <AlertCircle className="h-3 w-3" />
                                  {t('payments.overdue')}
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border bg-warning/10 text-warning border-warning/20">
                                  <Clock className="h-3 w-3" />
                                  {t('payments.pending')}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => openPaymentProfile(payment)}>
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <InvoiceGenerator
                                  data={{
                                    parentName: payment.subscriptions?.registrations?.parent_accounts?.parent_name || '',
                                    studentName: payment.subscriptions?.registrations?.student_name || '',
                                    subscriptionType: payment.subscriptions?.subscription_type || '',
                                    totalAmount: payment.subscriptions?.value || 0,
                                    paidAmount: paymentsByRegistration[payment.subscriptions?.registration_id]?.paidAmount || 0,
                                    payments: paymentsByRegistration[payment.subscriptions?.registration_id]?.payments || [],
                                    registrationId: payment.subscriptions?.registration_id || payment.id,
                                  }}
                                  variant="icon"
                                />
                                {payment.status !== 'paid' && (
                                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-success/10 hover:text-success" onClick={() => markPaidMutation.mutate(payment.id)} disabled={markPaidMutation.isPending}>
                                    <Check className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
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
      {selectedRegistration && (
        <PaymentProfileDialog
          open={!!selectedRegistration}
          onOpenChange={(open) => !open && setSelectedRegistration(null)}
          registrationId={selectedRegistration.registrationId}
          payments={selectedRegistration.payments}
          subscription={selectedRegistration.subscription}
          parentName={selectedRegistration.parentName}
          studentName={selectedRegistration.studentName}
        />
      )}
    </DashboardLayout>
  );
};

export default Payments;
