import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { 
  User, 
  Phone, 
  GraduationCap, 
  CreditCard, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Check,
  Edit2,
  Save,
  X,
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { InvoiceGenerator } from './InvoiceGenerator';

interface PaymentProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registrationId: string;
  payments: any[];
  subscription: any;
  parentName: string;
  studentName: string;
}

export const PaymentProfileDialog: React.FC<PaymentProfileDialogProps> = ({
  open,
  onOpenChange,
  registrationId,
  payments,
  subscription,
  parentName,
  studentName,
}) => {
  const queryClient = useQueryClient();
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editDueDate, setEditDueDate] = useState('');
  const [editPaidDate, setEditPaidDate] = useState('');

  const totalAmount = subscription?.value || 0;
  const paidAmount = payments
    .filter((p: any) => p.status === 'paid')
    .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  const remainingAmount = totalAmount - paidAmount;
  const isFullyPaid = remainingAmount <= 0;

  const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    paid: { label: 'مدفوع', variant: 'default' },
    pending: { label: 'في الانتظار', variant: 'secondary' },
    overdue: { label: 'متأخر', variant: 'destructive' },
  };

  const subscriptionTypeLabels: Record<string, string> = {
    monthly: 'شهري',
    yearly: 'سنوي',
  };

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
      toast.success('تم تسجيل الدفع بنجاح');
    },
    onError: (error) => {
      toast.error('حدث خطأ أثناء تسجيل الدفع');
      console.error(error);
    },
  });

  const updateDatesMutation = useMutation({
    mutationFn: async ({ paymentId, dueDate, paidDate }: { paymentId: string; dueDate: string; paidDate: string | null }) => {
      const updateData: any = { due_date: dueDate };
      if (paidDate) {
        updateData.paid_date = paidDate;
      }
      const { error } = await supabase
        .from('payments')
        .update(updateData)
        .eq('id', paymentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success('تم تحديث التواريخ بنجاح');
      setEditingPaymentId(null);
    },
    onError: (error) => {
      toast.error('حدث خطأ أثناء التحديث');
      console.error(error);
    },
  });

  const startEditing = (payment: any) => {
    setEditingPaymentId(payment.id);
    setEditDueDate(payment.due_date);
    setEditPaidDate(payment.paid_date || '');
  };

  const cancelEditing = () => {
    setEditingPaymentId(null);
    setEditDueDate('');
    setEditPaidDate('');
  };

  const saveEditing = (paymentId: string) => {
    updateDatesMutation.mutate({
      paymentId,
      dueDate: editDueDate,
      paidDate: editPaidDate || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">ملف المدفوعات</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Profile Header */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  معلومات التسجيل
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ولي الأمر:</span>
                  <span className="font-medium">{parentName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">الطالب:</span>
                  <span className="font-medium">{studentName || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">نوع الاشتراك:</span>
                  <span className="font-medium">
                    {subscriptionTypeLabels[subscription?.subscription_type] || '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">عدد الأقساط:</span>
                  <span className="font-medium">{subscription?.number_of_installments || '-'}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  ملخص المدفوعات
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">إجمالي المبلغ:</span>
                  <span className="font-medium">{Number(totalAmount).toLocaleString()} ج.م</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">المدفوع:</span>
                  <span className="font-medium text-green-600">{paidAmount.toLocaleString()} ج.م</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">المتبقي:</span>
                  <span className={cn("font-medium", remainingAmount > 0 ? "text-red-600" : "text-green-600")}>
                    {remainingAmount.toLocaleString()} ج.م
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">الحالة:</span>
                  <Badge variant={isFullyPaid ? 'default' : 'destructive'}>
                    {isFullyPaid ? 'مدفوع بالكامل' : 'دفع جزئي'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Invoice Download */}
          <div className="flex justify-end">
            <InvoiceGenerator
              data={{
                parentName,
                studentName,
                subscriptionType: subscription?.subscription_type || '',
                totalAmount,
                paidAmount,
                payments,
                registrationId,
              }}
            />
          </div>

          {/* Payments Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">تفاصيل الأقساط</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">رقم القسط</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                    <TableHead className="text-right">تاريخ الاستحقاق</TableHead>
                    <TableHead className="text-right">تاريخ الدفع</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment: any) => (
                    <TableRow key={payment.id}>
                      <TableCell>{payment.installment_number}</TableCell>
                      <TableCell>{Number(payment.amount).toLocaleString()} ج.م</TableCell>
                      <TableCell>
                        {editingPaymentId === payment.id ? (
                          <Input
                            type="date"
                            value={editDueDate}
                            onChange={(e) => setEditDueDate(e.target.value)}
                            className="w-36"
                          />
                        ) : (
                          format(new Date(payment.due_date), 'dd MMM yyyy', { locale: ar })
                        )}
                      </TableCell>
                      <TableCell>
                        {editingPaymentId === payment.id ? (
                          <Input
                            type="date"
                            value={editPaidDate}
                            onChange={(e) => setEditPaidDate(e.target.value)}
                            className="w-36"
                          />
                        ) : (
                          payment.paid_date
                            ? format(new Date(payment.paid_date), 'dd MMM yyyy', { locale: ar })
                            : '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusLabels[payment.status]?.variant || 'secondary'}>
                          {statusLabels[payment.status]?.label || payment.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {editingPaymentId === payment.id ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => saveEditing(payment.id)}
                                disabled={updateDatesMutation.isPending}
                              >
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={cancelEditing}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => startEditing(payment)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              {payment.status !== 'paid' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => markPaidMutation.mutate(payment.id)}
                                  disabled={markPaidMutation.isPending}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};
