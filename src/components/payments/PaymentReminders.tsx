import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Bell, Clock, ChevronRight } from 'lucide-react';
import { format, differenceInDays, isAfter, isBefore, addDays } from 'date-fns';
import { ar } from 'date-fns/locale';

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
  const today = new Date();
  
  // Categorize payments
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
    if (days < 0) return `متأخر ${Math.abs(days)} يوم`;
    if (days === 0) return 'اليوم';
    if (days === 1) return 'غداً';
    return `بعد ${days} يوم`;
  };
  
  const renderPaymentItem = (payment: Payment, type: 'overdue' | 'due-soon' | 'upcoming') => {
    const parentName = payment.subscriptions?.registrations?.parent_accounts?.parent_name || '-';
    const studentName = payment.subscriptions?.registrations?.student_name || '-';
    const phone = payment.subscriptions?.registrations?.parent_accounts?.father_phone || '';
    
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
        <div className="text-left">
          <p className="font-semibold text-sm">{Number(payment.amount).toLocaleString()} ج.م</p>
          <p className={`text-xs ${
            type === 'overdue' ? 'text-destructive' : 
            type === 'due-soon' ? 'text-warning' : 'text-muted-foreground'
          }`}>
            {getDaysText(payment.due_date)}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  };
  
  if (overduePayments.length === 0 && dueSoonPayments.length === 0 && upcomingPayments.length === 0) {
    return null;
  }
  
  return (
    <div className="space-y-4">
      {overduePayments.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              مدفوعات متأخرة ({overduePayments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {overduePayments.slice(0, 5).map(p => renderPaymentItem(p, 'overdue'))}
            {overduePayments.length > 5 && (
              <p className="text-xs text-muted-foreground text-center">
                +{overduePayments.length - 5} مدفوعات أخرى
              </p>
            )}
          </CardContent>
        </Card>
      )}
      
      {dueSoonPayments.length > 0 && (
        <Card className="border-warning/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-warning">
              <Bell className="h-4 w-4" />
              مستحقة خلال 7 أيام ({dueSoonPayments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dueSoonPayments.slice(0, 5).map(p => renderPaymentItem(p, 'due-soon'))}
            {dueSoonPayments.length > 5 && (
              <p className="text-xs text-muted-foreground text-center">
                +{dueSoonPayments.length - 5} مدفوعات أخرى
              </p>
            )}
          </CardContent>
        </Card>
      )}
      
      {upcomingPayments.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              مستحقة خلال 30 يوم ({upcomingPayments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingPayments.slice(0, 3).map(p => renderPaymentItem(p, 'upcoming'))}
            {upcomingPayments.length > 3 && (
              <p className="text-xs text-muted-foreground text-center">
                +{upcomingPayments.length - 3} مدفوعات أخرى
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
