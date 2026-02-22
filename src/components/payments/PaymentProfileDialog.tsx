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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
import { enUS } from 'date-fns/locale';
import { 
  User, 
  CreditCard, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Check,
  Edit2,
  Save,
  X,
  DollarSign,
  Calendar,
  GraduationCap
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
  const progressPercent = totalAmount > 0 ? Math.min((paidAmount / totalAmount) * 100, 100) : 0;

  const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    paid: { label: 'Paid', color: 'bg-success/10 text-success border-success/20', icon: <CheckCircle className="h-3 w-3" /> },
    pending: { label: 'Pending', color: 'bg-warning/10 text-warning border-warning/20', icon: <Clock className="h-3 w-3" /> },
    overdue: { label: 'Overdue', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: <AlertCircle className="h-3 w-3" /> },
  };

  const subscriptionTypeLabels: Record<string, string> = {
    monthly: 'Monthly',
    yearly: 'Yearly',
  };

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
      toast.success('Payment recorded successfully');
    },
    onError: (error) => {
      toast.error('Error recording payment');
      console.error(error);
    },
  });

  const updateDatesMutation = useMutation({
    mutationFn: async ({ paymentId, dueDate, paidDate }: { paymentId: string; dueDate: string; paidDate: string | null }) => {
      const updateData: any = { due_date: dueDate };
      if (paidDate) updateData.paid_date = paidDate;
      const { error } = await supabase.from('payments').update(updateData).eq('id', paymentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success('Dates updated successfully');
      setEditingPaymentId(null);
    },
    onError: (error) => {
      toast.error('Error updating dates');
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
    updateDatesMutation.mutate({ paymentId, dueDate: editDueDate, paidDate: editPaidDate || null });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 overflow-hidden rounded-2xl border-border/50">
        {/* Premium Header Card */}
        <div className="relative bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 border-b border-border/50 px-6 pt-6 pb-5">
          <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl" />
          <DialogHeader className="relative">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center text-xl font-bold text-primary shrink-0 ring-2 ring-primary/10">
                <CreditCard className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg font-bold text-foreground tracking-tight">
                  Payment Profile
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {parentName} · {studentName || 'Student'}
                </p>
                <div className="flex items-center flex-wrap gap-2 mt-2">
                  <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${isFullyPaid ? 'bg-success/10 text-success border-success/20' : 'bg-warning/10 text-warning border-warning/20'}`}>
                    {isFullyPaid ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                    {isFullyPaid ? 'Fully Paid' : 'Partial Payment'}
                  </span>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {subscriptionTypeLabels[subscription?.subscription_type] || '—'}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {subscription?.number_of_installments || 0} Installments
                  </Badge>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Quick Stats Row */}
          <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-primary" />
              Total: <span className="font-semibold text-foreground">{Number(totalAmount).toLocaleString()} EGP</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-success" />
              Paid: <span className="font-semibold text-success">{paidAmount.toLocaleString()} EGP</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 text-destructive" />
              Remaining: <span className={cn("font-semibold", remainingAmount > 0 ? "text-destructive" : "text-success")}>{remainingAmount.toLocaleString()} EGP</span>
            </span>
          </div>

          {/* Progress Bar */}
          <div className="mt-3">
            <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", isFullyPaid ? "bg-success" : "bg-primary")}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">{progressPercent.toFixed(0)}% collected</p>
          </div>
        </div>

        <ScrollArea className="max-h-[55vh]">
          <div className="px-6 py-5 space-y-4">
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

            {/* Installments Table */}
            <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
              <div className="px-5 py-3 border-b border-border/50 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                </div>
                <h3 className="text-xs font-semibold text-foreground">Installment Details</h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">#</TableHead>
                    <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Amount</TableHead>
                    <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Due Date</TableHead>
                    <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Paid Date</TableHead>
                    <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                    <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment: any) => {
                    const sc = statusConfig[payment.status];
                    return (
                      <TableRow key={payment.id} className="hover:bg-muted/20 transition-colors">
                        <TableCell className="text-sm font-medium">{payment.installment_number}</TableCell>
                        <TableCell className="text-sm font-semibold">{Number(payment.amount).toLocaleString()} EGP</TableCell>
                        <TableCell className="text-sm">
                          {editingPaymentId === payment.id ? (
                            <Input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} className="w-36 h-8 text-xs" />
                          ) : (
                            format(new Date(payment.due_date), 'dd MMM yyyy', { locale: enUS })
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {editingPaymentId === payment.id ? (
                            <Input type="date" value={editPaidDate} onChange={(e) => setEditPaidDate(e.target.value)} className="w-36 h-8 text-xs" />
                          ) : (
                            payment.paid_date ? format(new Date(payment.paid_date), 'dd MMM yyyy', { locale: enUS }) : '—'
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2.5 py-0.5 rounded-full border ${sc?.color || 'bg-muted/50 text-muted-foreground border-border/50'}`}>
                            {sc?.icon} {sc?.label || payment.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-0.5">
                            {editingPaymentId === payment.id ? (
                              <>
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-success/10 hover:text-success" onClick={() => saveEditing(payment.id)} disabled={updateDatesMutation.isPending}>
                                  <Save className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-destructive/10 hover:text-destructive" onClick={cancelEditing}>
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => startEditing(payment)}>
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                                {payment.status !== 'paid' && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-success/10 hover:text-success" onClick={() => markPaidMutation.mutate(payment.id)} disabled={markPaidMutation.isPending}>
                                    <Check className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
