import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Search, CreditCard, CheckCircle, Clock, AlertCircle, Check, Eye, Hash, Download } from 'lucide-react';
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

  // Filter payments by city
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
        .update({
          status: 'paid',
          paid_date: new Date().toISOString().split('T')[0],
        })
        .eq('id', paymentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success(t('payments.paymentSuccess'));
    },
    onError: (error) => {
      toast.error(t('payments.paymentError'));
      console.error(error);
    },
  });

  // Group payments by registration for profile view and payment status calculation
  const paymentsByRegistration = useMemo(() => {
    const grouped: Record<string, {
      registrationId: string;
      payments: any[];
      subscription: any;
      parentName: string;
      studentName: string;
      totalAmount: number;
      paidAmount: number;
      isFullyPaid: boolean;
    }> = {};

    payments.forEach((payment: any) => {
      const registrationId = payment.subscriptions?.registration_id;
      if (!registrationId) return;

      if (!grouped[registrationId]) {
        grouped[registrationId] = {
          registrationId,
          payments: [],
          subscription: payment.subscriptions,
          parentName: payment.subscriptions?.registrations?.parent_accounts?.parent_name || '',
          studentName: payment.subscriptions?.registrations?.student_name || '',
          totalAmount: payment.subscriptions?.value || 0,
          paidAmount: 0,
          isFullyPaid: false,
        };
      }

      grouped[registrationId].payments.push(payment);
      if (payment.status === 'paid') {
        grouped[registrationId].paidAmount += Number(payment.amount);
      }
    });

    // Calculate if fully paid
    Object.values(grouped).forEach((reg) => {
      reg.isFullyPaid = reg.paidAmount >= reg.totalAmount;
    });

    return grouped;
  }, [payments]);

  // Filter by payment status tab (fully paid vs partial)
  const filteredByPaymentStatus = useMemo(() => {
    if (paymentTab === 'all') return payments;
    
    const registrationIds = Object.values(paymentsByRegistration)
      .filter(reg => paymentTab === 'fully_paid' ? reg.isFullyPaid : !reg.isFullyPaid)
      .map(reg => reg.registrationId);

    return payments.filter((payment: any) => 
      registrationIds.includes(payment.subscriptions?.registration_id)
    );
  }, [payments, paymentsByRegistration, paymentTab]);

  const filteredPayments = filteredByPaymentStatus.filter((payment: any) => {
    const parentName = payment.subscriptions?.registrations?.parent_accounts?.parent_name || '';
    const studentName = payment.subscriptions?.registrations?.student_name || '';
    const matchesSearch = 
      parentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      studentName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
    
    // Filter by number of installments
    const matchesInstallments = !installmentFilter || 
      payment.subscriptions?.number_of_installments === parseInt(installmentFilter);
    
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

  // Tab stats
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
    if (regData) {
      setSelectedRegistration(regData);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('payments.title')}</h1>
          <p className="text-muted-foreground">{t('payments.description')}</p>
        </div>

        {/* Payment Reminders */}
        <PaymentReminders 
          payments={payments} 
          onViewPayment={(payment) => openPaymentProfile(payment)}
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t('payments.totalDue')}</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total.toLocaleString()} EGP</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t('payments.paid')}</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.paid.toLocaleString()} EGP</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t('payments.pending')}</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending.toLocaleString()} EGP</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t('payments.overdue')}</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.overdue.toLocaleString()} EGP</div>
            </CardContent>
          </Card>
        </div>

        {/* Payment Status Tabs */}
        <Tabs value={paymentTab} onValueChange={setPaymentTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">{t('common.all')}</TabsTrigger>
            <TabsTrigger value="fully_paid" className="flex items-center gap-2">
              {t('payments.fullyPaid')}
              <Badge variant="outline" className="text-xs">
                {tabStats.fullyPaidCount}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="partial" className="flex items-center gap-2">
              {t('payments.partialPayment')}
              <Badge variant="outline" className="text-xs">
                {tabStats.partialCount}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {/* Tab Summary Cards */}
          {paymentTab === 'fully_paid' && (
            <Card className="mt-4 bg-green-50 dark:bg-green-900/20 border-green-200">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-green-700 dark:text-green-300">{t('payments.paidAmount')}:</span>
                  <span className="font-bold text-green-700 dark:text-green-300">
                    {tabStats.fullyPaidAmount.toLocaleString()} EGP ({tabStats.fullyPaidCount} {t('payments.registrationsCount')})
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {paymentTab === 'partial' && (
            <Card className="mt-4 bg-orange-50 dark:bg-orange-900/20 border-orange-200">
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-orange-700 dark:text-orange-300">{t('payments.paidSoFar')}:</span>
                  <span className="font-bold text-orange-700 dark:text-orange-300">
                    {tabStats.partialPaidAmount.toLocaleString()} EGP
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-orange-700 dark:text-orange-300">{t('payments.remaining')}:</span>
                  <span className="font-bold text-red-600 dark:text-red-400">
                    {tabStats.partialRemainingAmount.toLocaleString()} EGP
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          <TabsContent value={paymentTab} className="mt-4 space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative max-w-sm">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('common.search') + '...'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t('payments.paymentStatus')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.all')}</SelectItem>
                  <SelectItem value="paid">{t('payments.paid')}</SelectItem>
                  <SelectItem value="pending">{t('payments.pending')}</SelectItem>
                  <SelectItem value="overdue">{t('payments.overdue')}</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative w-[180px]">
                <Hash className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  placeholder={t('payments.installments') + '...'}
                  value={installmentFilter}
                  onChange={(e) => setInstallmentFilter(e.target.value)}
                  className="pr-10"
                  min="1"
                  max="10"
                />
              </div>
            </div>

            {/* Payments Table */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">{t('payments.parentName')}</TableHead>
                      <TableHead className="text-right">{t('payments.studentName')}</TableHead>
                      <TableHead className="text-right">{t('payments.subscriptionType')}</TableHead>
                      <TableHead className="text-right">{t('payments.installments')}</TableHead>
                      <TableHead className="text-right">{t('payments.installmentNumber')}</TableHead>
                      <TableHead className="text-right">{t('payments.amount')}</TableHead>
                      <TableHead className="text-right">{t('payments.dueDate')}</TableHead>
                      <TableHead className="text-right">{t('common.status')}</TableHead>
                      <TableHead className="text-right">{t('common.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">
                          {t('common.loading')}
                        </TableCell>
                      </TableRow>
                    ) : filteredPayments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">
                          {t('payments.noPayments')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPayments.map((payment: any) => (
                        <TableRow key={payment.id}>
                          <TableCell className="font-medium">
                            {payment.subscriptions?.registrations?.parent_accounts?.parent_name || '-'}
                          </TableCell>
                          <TableCell>
                            {payment.subscriptions?.registrations?.student_name || '-'}
                          </TableCell>
                          <TableCell>
                            {subscriptionTypeLabels[payment.subscriptions?.subscription_type] || '-'}
                          </TableCell>
                          <TableCell>
                            {payment.subscriptions?.number_of_installments || '-'}
                          </TableCell>
                          <TableCell>{payment.installment_number}</TableCell>
                          <TableCell>{Number(payment.amount).toLocaleString()} EGP</TableCell>
                          <TableCell>
                            {format(new Date(payment.due_date), 'dd MMM yyyy', { locale: dateLocale })}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={statusLabels[payment.status]?.variant || 'secondary'}
                              className="gap-1"
                            >
                              {statusLabels[payment.status]?.icon}
                              {statusLabels[payment.status]?.label || payment.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openPaymentProfile(payment)}
                                title="عرض الملف"
                              >
                                <Eye className="h-4 w-4" />
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
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => markPaidMutation.mutate(payment.id)}
                                  disabled={markPaidMutation.isPending}
                                  title="تسجيل دفع"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
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
