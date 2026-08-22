import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHero } from '@/components/layout/PageHero';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PaymentProfileDialog } from '@/components/payments/PaymentProfileDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useCity } from '@/contexts/CityContext';
import { AlertTriangle, Bell, Clock, ArrowLeft, Search, Eye, CreditCard } from 'lucide-react';
import { differenceInDays, isBefore, isAfter, addDays, format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';

const PaymentReminderDetails = () => {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'ar' ? ar : enUS;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const type = searchParams.get('type') || 'overdue';
  const { isSuperAdmin, hasDepartment } = useAuth();
  const canEdit = isSuperAdmin || hasDepartment('finance');
  const { selectedCity } = useCity();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegistration, setSelectedRegistration] = useState<any>(null);

  const today = new Date();

  const config = {
    overdue: {
      icon: AlertTriangle,
      label: t('paymentReminders.overduePayments'),
      colorClass: 'text-destructive',
      bgClass: 'from-destructive/80 via-destructive/60 to-destructive/40',
      badgeBg: 'bg-destructive/10 text-destructive',
    },
    'due-soon': {
      icon: Bell,
      label: t('paymentReminders.dueSoon'),
      colorClass: 'text-warning',
      bgClass: 'from-warning/80 via-warning/60 to-warning/40',
      badgeBg: 'bg-warning/10 text-warning',
    },
    upcoming: {
      icon: Clock,
      label: t('paymentReminders.upcoming'),
      colorClass: 'text-muted-foreground',
      bgClass: 'from-muted-foreground/50 via-muted-foreground/30 to-muted-foreground/20',
      badgeBg: 'bg-muted text-muted-foreground',
    },
  }[type] || {
    icon: AlertTriangle,
    label: t('paymentReminders.overduePayments'),
    colorClass: 'text-destructive',
    bgClass: 'from-destructive/80 via-destructive/60 to-destructive/40',
    badgeBg: 'bg-destructive/10 text-destructive',
  };

  const { data: allPayments = [], isLoading } = useQuery({
    queryKey: ['payments-reminders-detail'],
    queryFn: async () => {
      const pageSize = 1000;
      let from = 0;
      const all: any[] = [];
      // Page through all rows to bypass the 1000-row default cap
      // eslint-disable-next-line no-constant-condition
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
                status,
                parent_accounts (parent_name, father_phone, city, is_active)
              )
            )
          `)
          .order('due_date', { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
  });

  const payments = useMemo(() => {
    const notCancelled = allPayments.filter((p: any) => {
      const reg = p.subscriptions?.registrations;
      if (!reg || reg.status === 'cancelled') return false;
      if (reg.parent_accounts?.is_active === false) return false;
      return true;
    });

    if (selectedCity === 'all') return notCancelled;
    const cityMapping: Record<string, string[]> = {
      cairo: ['cairo', 'القاهرة', 'قاهرة'],
      giza: ['giza', 'الجيزة', 'جيزة'],
      alexandria: ['alexandria', 'الإسكندرية', 'اسكندرية', 'إسكندرية'],
    };
    const cityNames = cityMapping[selectedCity] || [];
    return notCancelled.filter((p: any) => {
      const city = p.subscriptions?.registrations?.parent_accounts?.city;
      return cityNames.some((name) => city?.toLowerCase().includes(name.toLowerCase()));
    });
  }, [allPayments, selectedCity]);

  const filteredPayments = useMemo(() => {
    let filtered = payments.filter((p: any) => {
      if (p.status === 'paid' || p.status === 'archived') return false;
      const dueDate = new Date(p.due_date);
      if (type === 'overdue') return isBefore(dueDate, today);
      if (type === 'due-soon') return isAfter(dueDate, today) && isBefore(dueDate, addDays(today, 7));
      if (type === 'upcoming') return isAfter(dueDate, addDays(today, 7)) && isBefore(dueDate, addDays(today, 30));
      return false;
    });

    if (searchTerm) {
      filtered = filtered.filter((p: any) => {
        const parentName = p.subscriptions?.registrations?.parent_accounts?.parent_name || '';
        const studentName = p.subscriptions?.registrations?.student_name || '';
        const phone = p.subscriptions?.registrations?.parent_accounts?.father_phone || '';
        return parentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          phone.includes(searchTerm);
      });
    }

    return filtered;
  }, [payments, type, searchTerm, today]);

  const totalAmount = filteredPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);

  const getDaysText = (dueDate: string) => {
    const days = differenceInDays(new Date(dueDate), today);
    if (days < 0) return `${t('paymentReminders.lateBy')} ${Math.abs(days)} ${t('paymentReminders.days')}`;
    if (days === 0) return t('paymentReminders.today');
    if (days === 1) return t('paymentReminders.tomorrow');
    return `${t('paymentReminders.inDays')} ${days} ${t('paymentReminders.days')}`;
  };

  // Group by registration for opening profile dialog
  const paymentsByRegistration = useMemo(() => {
    const grouped: Record<string, any> = {};
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
        };
      }
      grouped[registrationId].payments.push(payment);
      if (payment.status === 'paid') grouped[registrationId].paidAmount += Number(payment.amount);
    });
    return grouped;
  }, [payments]);

  const openProfile = (payment: any) => {
    const registrationId = payment.subscriptions?.registration_id;
    const regData = paymentsByRegistration[registrationId];
    if (regData) setSelectedRegistration(regData);
  };

  const Icon = config.icon;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/payments')}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('common.back') || 'Back'}
        </Button>

        {/* Hero */}
        <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${config.bgClass} p-8 text-white`}>
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
          <div className="relative z-10 flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{config.label}</h1>
                <p className="text-white/70">{filteredPayments.length} {t('payments.installments') || 'installments'}</p>
              </div>
            </div>
          </div>
          <div className="relative z-10 flex flex-wrap gap-3 mt-6">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 text-sm">
              <CreditCard className="h-4 w-4" />
              <span className="font-semibold">{totalAmount.toLocaleString()}</span>
              <span className="text-white/70">EGP</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 text-sm">
              <Icon className="h-4 w-4" />
              <span className="font-semibold">{filteredPayments.length}</span>
              <span className="text-white/70">{t('payments.installments') || 'installments'}</span>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('common.search') + '...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-11 bg-card border-border/50 focus:border-primary/50 rounded-xl"
          />
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-border/50 flex items-center gap-3">
            <div className={`p-1.5 rounded-lg ${config.badgeBg}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">{config.label}</h2>
              <p className="text-xs text-muted-foreground">{filteredPayments.length} {t('payments.installments') || 'records'}</p>
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
                <Icon className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">{t('payments.noPayments')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('payments.parentName')}</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('payments.studentName')}</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('payments.amount')}</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('payments.dueDate')}</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('payments.paymentStatus')}</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('payments.installments')}</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment: any) => {
                    const parentName = payment.subscriptions?.registrations?.parent_accounts?.parent_name || '-';
                    const studentName = payment.subscriptions?.registrations?.student_name || '-';
                    const phone = payment.subscriptions?.registrations?.parent_accounts?.father_phone || '';

                    return (
                      <TableRow
                        key={payment.id}
                        className="group hover:bg-muted/20 transition-colors duration-150 cursor-pointer"
                        onClick={() => openProfile(payment)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                              {(parentName || '?')[0].toUpperCase()}
                            </div>
                            <div>
                              <span className="font-medium text-sm text-foreground block">{parentName}</span>
                              {phone && <span className="text-xs text-muted-foreground">{phone}</span>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{studentName}</TableCell>
                        <TableCell className="text-sm font-semibold text-foreground">{Number(payment.amount).toLocaleString()} EGP</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(payment.due_date), 'dd MMM yyyy', { locale: dateLocale })}
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs font-medium ${config.colorClass}`}>
                            {getDaysText(payment.due_date)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            #{payment.installment_number} / {payment.subscriptions?.number_of_installments || '-'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary"
                            onClick={() => openProfile(payment)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {selectedRegistration && (
        <PaymentProfileDialog
          open={!!selectedRegistration}
          onOpenChange={(open) => !open && setSelectedRegistration(null)}
          registrationId={selectedRegistration.registrationId}
          payments={selectedRegistration.payments}
          subscription={selectedRegistration.subscription}
          parentName={selectedRegistration.parentName}
          studentName={selectedRegistration.studentName}
          canEdit={canEdit}
        />
      )}
    </DashboardLayout>
  );
};

export default PaymentReminderDetails;
