import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Plus,
  Receipt,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { InvoiceGenerator } from './InvoiceGenerator';
import { ReceiptUpload } from './ReceiptUpload';
import { useAuth } from '@/contexts/AuthContext';
import SubscriptionDialog from '@/components/registrations/SubscriptionDialog';

interface PaymentProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registrationId: string;
  payments: any[];
  subscription: any;
  parentName: string;
  studentName: string;
  canEdit?: boolean;
}

export const PaymentProfileDialog: React.FC<PaymentProfileDialogProps> = ({
  open,
  onOpenChange,
  registrationId,
  payments,
  subscription,
  parentName,
  studentName,
  canEdit = true,
}) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editDueDate, setEditDueDate] = useState('');
  const [editPaidDate, setEditPaidDate] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [activeTab, setActiveTab] = useState('installments');
  const [editSubOpen, setEditSubOpen] = useState(false);
  const [editRegistration, setEditRegistration] = useState<any>(null);

  const openEditSubscription = async () => {
    const { data, error } = await supabase
      .from('registrations')
      .select('*, parent_accounts(*), schools(*)')
      .eq('id', registrationId)
      .maybeSingle();
    if (error || !data) {
      toast.error('Unable to load registration');
      return;
    }
    setEditRegistration(data);
    setEditSubOpen(true);
  };

  // Extra fee form state
  const [feePaymentIds, setFeePaymentIds] = useState<string[]>([]);
  const [feeType, setFeeType] = useState<string>('custom');
  const [feeAmount, setFeeAmount] = useState('');
  const [feeReason, setFeeReason] = useState('');

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

  // Fetch extra fees for all payments in this profile
  const paymentIds = payments.map((p: any) => p.id);
  const { data: extraFees = [], refetch: refetchFees } = useQuery({
    queryKey: ['extra-fees', registrationId],
    queryFn: async () => {
      if (paymentIds.length === 0) return [];
      const { data, error } = await supabase
        .from('payment_extra_fees')
        .select('*')
        .in('payment_id', paymentIds)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open && paymentIds.length > 0,
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
      toast.success('Payment recorded successfully');
    },
    onError: (error) => {
      toast.error('Error recording payment');
      console.error(error);
    },
  });

  const updatePaymentMutation = useMutation({
    mutationFn: async ({ paymentId, dueDate, paidDate, amount }: { paymentId: string; dueDate: string; paidDate: string | null; amount: number }) => {
      const updateData: any = { due_date: dueDate, amount };
      if (paidDate) updateData.paid_date = paidDate;
      const { error } = await supabase.from('payments').update(updateData).eq('id', paymentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success('Payment updated successfully');
      setEditingPaymentId(null);
    },
    onError: (error) => {
      toast.error('Error updating payment');
      console.error(error);
    },
  });

  const addFeeMutation = useMutation({
    mutationFn: async () => {
      if (feePaymentIds.length === 0 || !feeAmount || !user?.id) throw new Error('Missing fields');
      const rows = feePaymentIds.map(pid => ({
        payment_id: pid,
        fee_type: feeType,
        amount: parseFloat(feeAmount),
        reason: feeReason || null,
        created_by: user.id,
      }));
      const { error } = await supabase.from('payment_extra_fees').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchFees();
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success('Extra fee added successfully');
      setFeePaymentIds([]);
      setFeeAmount('');
      setFeeReason('');
      setFeeType('custom');
    },
    onError: (error) => {
      toast.error('Error adding extra fee');
      console.error(error);
    },
  });

  const deleteFeeMutation = useMutation({
    mutationFn: async (feeId: string) => {
      const { error } = await supabase.from('payment_extra_fees').delete().eq('id', feeId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchFees();
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success('Fee removed');
    },
    onError: () => toast.error('Error removing fee'),
  });

  const startEditing = (payment: any) => {
    setEditingPaymentId(payment.id);
    setEditDueDate(payment.due_date);
    setEditPaidDate(payment.paid_date || '');
    setEditAmount(String(payment.amount));
  };

  const cancelEditing = () => {
    setEditingPaymentId(null);
    setEditDueDate('');
    setEditPaidDate('');
    setEditAmount('');
  };

  const saveEditing = (paymentId: string) => {
    updatePaymentMutation.mutate({
      paymentId,
      dueDate: editDueDate,
      paidDate: editPaidDate || null,
      amount: parseFloat(editAmount) || 0,
    });
  };

  const totalExtraFees = extraFees.reduce((sum: number, f: any) => sum + Number(f.amount), 0);

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
            {totalExtraFees > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5 text-warning" />
                Extra Fees: <span className="font-semibold text-warning">{totalExtraFees.toLocaleString()} EGP</span>
              </span>
            )}
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

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-muted/50 p-1 rounded-xl h-auto">
                <TabsTrigger value="installments" className="rounded-lg px-4 py-2 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Calendar className="h-3.5 w-3.5 mr-1.5" />
                  Installments
                </TabsTrigger>
                {canEdit && (
                  <TabsTrigger value="extra-fees" className="rounded-lg px-4 py-2 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <Receipt className="h-3.5 w-3.5 mr-1.5" />
                    Extra Fees
                    {extraFees.length > 0 && (
                      <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">{extraFees.length}</Badge>
                    )}
                  </TabsTrigger>
                )}
              </TabsList>

              {/* Installments Tab */}
              <TabsContent value="installments" className="mt-4">
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
                        <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Extra Fees</TableHead>
                        <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total</TableHead>
                        <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Due Date</TableHead>
                        <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Paid Date</TableHead>
                        <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                        <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...payments].sort((a: any, b: any) => a.installment_number - b.installment_number).map((payment: any) => {
                        const sc = statusConfig[payment.status];
                        const paymentFees = extraFees.filter((f: any) => f.payment_id === payment.id);
                        const feesTotal = paymentFees.reduce((s: number, f: any) => s + Number(f.amount), 0);
                        return (
                          <TableRow key={payment.id} className="hover:bg-muted/20 transition-colors">
                            <TableCell className="text-sm font-medium">
                              {payment.installment_number === 0 ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary">Insurance</span>
                              ) : (
                                payment.installment_number
                              )}
                            </TableCell>
                            <TableCell>
                              {editingPaymentId === payment.id ? (
                                <Input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} className="w-24 h-8 text-xs" min="0" />
                              ) : (
                                <span className="text-sm font-semibold">{Number(payment.amount).toLocaleString()} EGP</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {feesTotal > 0 ? (
                                <div>
                                  <span className="text-sm font-semibold text-warning">+{feesTotal.toLocaleString()} EGP</span>
                                  {paymentFees.map((f: any) => (
                                    <span key={f.id} className="block text-[10px] text-muted-foreground">
                                      {f.fee_type === 'late_penalty' ? 'Late Penalty' : 'Custom'}{f.reason ? `: ${f.reason}` : ''}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm font-bold">{(Number(payment.amount) + feesTotal).toLocaleString()} EGP</span>
                            </TableCell>
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
                              {canEdit && (
                              <div className="flex justify-end gap-0.5">
                                {editingPaymentId === payment.id ? (
                                  <>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-success/10 hover:text-success" onClick={() => saveEditing(payment.id)} disabled={updatePaymentMutation.isPending}>
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
                                     <ReceiptUpload paymentId={payment.id} receiptUrl={payment.receipt_url} canEdit={canEdit} />
                                   </>
                                 )}
                              </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* Extra Fees Tab */}
              <TabsContent value="extra-fees" className="mt-4 space-y-4">
                {/* Add Fee Form */}
                <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 rounded-lg bg-warning/10">
                      <Plus className="h-3.5 w-3.5 text-warning" />
                    </div>
                    <h3 className="text-xs font-semibold text-foreground">Add Extra Fee</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Installments (multi-select)</label>
                      <div className="space-y-1.5 max-h-32 overflow-y-auto border border-input rounded-lg p-2">
                        {payments.map((p: any) => {
                          const checked = feePaymentIds.includes(p.id);
                          return (
                            <label key={p.id} className="flex items-center gap-2 cursor-pointer text-xs hover:bg-muted/30 rounded px-1 py-0.5">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setFeePaymentIds(prev =>
                                    checked ? prev.filter(id => id !== p.id) : [...prev, p.id]
                                  );
                                }}
                                className="h-3.5 w-3.5 rounded border-input"
                              />
                              #{p.installment_number} — {Number(p.amount).toLocaleString()} EGP
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Fee Type</label>
                      <Select value={feeType} onValueChange={setFeeType}>
                        <SelectTrigger className="h-9 text-xs rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="late_penalty">Late Payment Penalty</SelectItem>
                          <SelectItem value="custom">Custom Fee</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Amount (EGP)</label>
                      <Input type="number" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} placeholder="0" className="h-9 text-xs rounded-lg" min="0" />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Reason</label>
                      <Input value={feeReason} onChange={(e) => setFeeReason(e.target.value)} placeholder="Optional reason" className="h-9 text-xs rounded-lg" />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={() => addFeeMutation.mutate()}
                    disabled={feePaymentIds.length === 0 || !feeAmount || addFeeMutation.isPending}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Fee
                  </Button>
                </div>

                {/* Fees List */}
                <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
                  <div className="px-5 py-3 border-b border-border/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-warning/10">
                        <Receipt className="h-3.5 w-3.5 text-warning" />
                      </div>
                      <h3 className="text-xs font-semibold text-foreground">All Extra Fees</h3>
                    </div>
                    <span className="text-xs font-semibold text-warning">{totalExtraFees.toLocaleString()} EGP</span>
                  </div>
                  {extraFees.length === 0 ? (
                    <div className="p-8 text-center">
                      <Receipt className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">No extra fees added yet</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Installment</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Type</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Amount</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Reason</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Date</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {extraFees.map((fee: any) => {
                          const linkedPayment = payments.find((p: any) => p.id === fee.payment_id);
                          return (
                            <TableRow key={fee.id} className="hover:bg-muted/20">
                              <TableCell className="text-xs">#{linkedPayment?.installment_number || '?'}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px]">
                                  {fee.fee_type === 'late_penalty' ? 'Late Penalty' : 'Custom'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm font-semibold text-warning">{Number(fee.amount).toLocaleString()} EGP</TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{fee.reason || '—'}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {format(new Date(fee.created_at), 'dd MMM yyyy', { locale: enUS })}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-destructive/10 hover:text-destructive" onClick={() => deleteFeeMutation.mutate(fee.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
