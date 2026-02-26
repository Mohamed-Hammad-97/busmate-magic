import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Bell, Clock, ChevronRight, ChevronDown } from 'lucide-react';
import { differenceInDays, isAfter, isBefore, addDays } from 'date-fns';

interface Payment {
  id: string;
  amount: number;
  due_date: string;
  status: string;
  installment_number: number;
  subscriptions?: {
    registrations?: {
      student_name?: string;
      parent_accounts?: {
        parent_name?: string;
        father_phone?: string;
      };
    };
  };
}

interface PaymentRemindersProps {
  payments: Payment[];
  onViewPayment?: (payment: Payment) => void;
}

export const PaymentReminders: React.FC<PaymentRemindersProps> = ({ payments, onViewPayment }) => {
  const { t } = useTranslation();
  const today = new Date();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const overduePayments = payments.filter(p =>
    p.status !== 'paid' && isBefore(new Date(p.due_date), today)
  );

  const dueSoonPayments = payments.filter(p =>
    p.status !== 'paid' &&
    isAfter(new Date(p.due_date), today) &&
    isBefore(new Date(p.due_date), addDays(today, 7))
  );

  const upcomingPayments = payments.filter(p =>
    p.status !== 'paid' &&
    isAfter(new Date(p.due_date), addDays(today, 7)) &&
    isBefore(new Date(p.due_date), addDays(today, 30))
  );

  const getDaysText = (dueDate: string) => {
    const days = differenceInDays(new Date(dueDate), today);
    if (days < 0) return `${t('paymentReminders.lateBy')} ${Math.abs(days)} ${t('paymentReminders.days')}`;
    if (days === 0) return t('paymentReminders.today');
    if (days === 1) return t('paymentReminders.tomorrow');
    return `${t('paymentReminders.inDays')} ${days} ${t('paymentReminders.days')}`;
  };

  const overdueTotal = overduePayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const dueSoonTotal = dueSoonPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const upcomingTotal = upcomingPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  if (overduePayments.length === 0 && dueSoonPayments.length === 0 && upcomingPayments.length === 0) {
    return null;
  }

  const toggleSection = (section: string) => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  const renderPaymentItem = (payment: Payment, type: 'overdue' | 'due-soon' | 'upcoming') => {
    const parentName = payment.subscriptions?.registrations?.parent_accounts?.parent_name || '-';
    const studentName = payment.subscriptions?.registrations?.student_name || '-';

    return (
      <div
        key={payment.id}
        className="flex items-center justify-between p-3 rounded-lg bg-background/50 hover:bg-background/80 transition-colors cursor-pointer"
        onClick={() => onViewPayment?.(payment)}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${
            type === 'overdue' ? 'bg-destructive/10' :
            type === 'due-soon' ? 'bg-warning/10' : 'bg-muted'
          }`}>
            {type === 'overdue' ? (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            ) : type === 'due-soon' ? (
              <Bell className="h-4 w-4 text-warning" />
            ) : (
              <Clock className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="font-medium text-sm">{studentName}</p>
            <p className="text-xs text-muted-foreground">{parentName}</p>
          </div>
        </div>
        <div className="text-left rtl:text-right">
          <p className="font-semibold text-sm">{Number(payment.amount).toLocaleString()} EGP</p>
          <p className={`text-xs ${
            type === 'overdue' ? 'text-destructive' :
            type === 'due-soon' ? 'text-warning' : 'text-muted-foreground'
          }`}>
            {getDaysText(payment.due_date)}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
      </div>
    );
  };

  const sections = [
    {
      key: 'overdue',
      payments: overduePayments,
      total: overdueTotal,
      label: t('paymentReminders.overduePayments'),
      icon: AlertTriangle,
      colorClass: 'text-destructive',
      bgClass: 'bg-destructive/5 border-destructive/20',
      badgeBg: 'bg-destructive/10 text-destructive',
      type: 'overdue' as const,
    },
    {
      key: 'due-soon',
      payments: dueSoonPayments,
      total: dueSoonTotal,
      label: t('paymentReminders.dueSoon'),
      icon: Bell,
      colorClass: 'text-warning',
      bgClass: 'bg-warning/5 border-warning/20',
      badgeBg: 'bg-warning/10 text-warning',
      type: 'due-soon' as const,
    },
    {
      key: 'upcoming',
      payments: upcomingPayments,
      total: upcomingTotal,
      label: t('paymentReminders.upcoming'),
      icon: Clock,
      colorClass: 'text-muted-foreground',
      bgClass: 'bg-muted/30 border-border/50',
      badgeBg: 'bg-muted text-muted-foreground',
      type: 'upcoming' as const,
    },
  ].filter(s => s.payments.length > 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {sections.map((section) => {
        const isExpanded = expandedSection === section.key;
        const Icon = section.icon;

        return (
          <div key={section.key} className="space-y-0">
            {/* Summary Card */}
            <button
              onClick={() => toggleSection(section.key)}
              className={`w-full rounded-2xl border p-4 transition-all duration-200 hover:shadow-md ${section.bgClass} ${isExpanded ? 'rounded-b-none' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${section.badgeBg}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="text-start">
                    <p className={`text-xs font-medium ${section.colorClass}`}>{section.label}</p>
                    <p className="text-lg font-bold text-foreground">{section.total.toLocaleString()} EGP</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className={`text-xs ${section.badgeBg}`}>
                    {section.payments.length}
                  </Badge>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
              </div>
            </button>

            {/* Expanded Details */}
            {isExpanded && (
              <div className={`rounded-b-2xl border border-t-0 ${section.bgClass} p-3 space-y-2 animate-fade-in`}>
                {section.payments.slice(0, 5).map(p => renderPaymentItem(p, section.type))}
                {section.payments.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center py-1">
                    +{section.payments.length - 5} {t('paymentReminders.morePayments')}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};