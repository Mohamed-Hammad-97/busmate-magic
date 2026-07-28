import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables, Enums } from '@/integrations/supabase/types';

type Registration = Tables<'registrations'> & {
  parent_accounts: Tables<'parent_accounts'>;
  schools: Tables<'schools'>;
};

interface SubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registration: Registration | null;
  onSuccess: () => void;
}

const SubscriptionDialog: React.FC<SubscriptionDialogProps> = ({
  open,
  onOpenChange,
  registration,
  onSuccess,
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [subscriptionType, setSubscriptionType] = useState<Enums<'subscription_type'>>('yearly');
  const [value, setValue] = useState<string>('');
  const [insurance, setInsurance] = useState<string>('');
  const [installments, setInstallments] = useState<string>('1');
  const [startDate, setStartDate] = useState<Date>(new Date());

  useEffect(() => {
    if (!open || !registration) return;

    // Defaults
    setSubscriptionType('yearly');
    setValue('');
    setInsurance('');
    setInstallments('1');
    setStartDate(new Date());

    // Preload existing subscription + insurance payment (if any)
    (async () => {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('id, subscription_type, value, number_of_installments')
        .eq('registration_id', registration.id)
        .maybeSingle();

      if (!sub) return;

      setSubscriptionType(sub.subscription_type as Enums<'subscription_type'>);
      setValue(String(sub.value ?? ''));
      setInstallments(String(sub.number_of_installments ?? 1));

      const { data: pays } = await supabase
        .from('payments')
        .select('amount, installment_number, due_date')
        .eq('subscription_id', sub.id)
        .order('installment_number', { ascending: true });

      if (pays && pays.length) {
        const ins = pays.find((p) => p.installment_number === 0);
        if (ins) setInsurance(String(ins.amount));
        const first = pays.find((p) => p.installment_number === 1) || pays[0];
        if (first?.due_date) setStartDate(new Date(first.due_date));
      }
    })();
  }, [open, registration]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!registration || !user) throw new Error('Missing data');

      const totalValue = parseFloat(value);
      const numInstallments = parseInt(installments);
      const installmentAmount = totalValue / numInstallments;
      const insuranceAmount = parseFloat(insurance) || 0;

      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('registration_id', registration.id)
        .maybeSingle();

      let subscriptionId: string;
      // Preserve receipts / paid state keyed by installment_number
      const existingByNum: Record<number, any> = {};

      if (existingSub) {
        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            subscription_type: subscriptionType,
            value: totalValue,
            number_of_installments: numInstallments,
          })
          .eq('id', existingSub.id);
        if (updateError) throw updateError;

        const { data: existingPays } = await supabase
          .from('payments')
          .select('*')
          .eq('subscription_id', existingSub.id);

        (existingPays || []).forEach((p: any) => {
          const key = Number(p.installment_number);
          const prev = existingByNum[key];
          if (!prev) { existingByNum[key] = p; return; }
          const t1 = new Date(p.updated_at || p.created_at || 0).getTime();
          const t2 = new Date(prev.updated_at || prev.created_at || 0).getTime();
          if (t1 >= t2) existingByNum[key] = p;
        });

        const { error: delError } = await supabase
          .from('payments')
          .delete()
          .eq('subscription_id', existingSub.id);
        if (delError) throw delError;

        subscriptionId = existingSub.id;
      } else {
        const { data: subscription, error: subError } = await supabase
          .from('subscriptions')
          .insert({
            registration_id: registration.id,
            subscription_type: subscriptionType,
            value: totalValue,
            number_of_installments: numInstallments,
            created_by: user.id,
          })
          .select()
          .single();
        if (subError) throw subError;
        subscriptionId = subscription.id;
      }

      const buildRow = (installment_number: number, amount: number, due_date: string, notes?: string) => {
        const prev = existingByNum[installment_number];
        return {
          subscription_id: subscriptionId,
          amount,
          installment_number,
          due_date,
          notes: notes ?? prev?.notes ?? null,
          status: (prev?.status ?? 'pending') as Enums<'payment_status'>,
          paid_date: prev?.paid_date ?? null,
          receipt_url: prev?.receipt_url ?? null,
          payment_note: prev?.payment_note ?? null,
          paid_by: prev?.paid_by ?? null,
          paid_by_name: prev?.paid_by_name ?? null,
        };
      };

      const payments: any[] = [];
      if (insuranceAmount > 0) {
        payments.push(buildRow(0, insuranceAmount, startDate.toISOString().split('T')[0], 'Insurance'));
      }
      for (let i = 0; i < numInstallments; i++) {
        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + i);
        payments.push(buildRow(i + 1, installmentAmount, dueDate.toISOString().split('T')[0]));
      }

      const { error: payError } = await supabase.from('payments').insert(payments);
      if (payError) throw payError;

      const { error: regError } = await supabase
        .from('registrations')
        .update({ status: 'complete' })
        .eq('id', registration.id);
      if (regError) throw regError;

      try {
        await supabase.functions.invoke('activate-parent-account', {
          body: { parent_id: registration.parent_id },
        });
      } catch (activateErr) {
        console.error('Failed to activate parent account:', activateErr);
      }
    },
    onSuccess: () => {
      toast({ title: 'Subscription saved successfully' });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['registrations'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      onSuccess();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!value || parseFloat(value) <= 0) {
      toast({ title: 'Please enter a valid amount', variant: 'destructive' });
      return;
    }
    if (!installments || parseInt(installments) < 1) {
      toast({ title: 'Please enter valid number of installments', variant: 'destructive' });
      return;
    }

    saveMutation.mutate();
  };

  if (!registration) return null;

  const totalValue = parseFloat(value) || 0;
  const numInstallments = parseInt(installments) || 1;
  const perInstallment = totalValue / numInstallments;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Subscription & Fees</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 bg-muted rounded-lg space-y-1">
            <p className="text-sm font-medium">{registration.student_name || 'N/A'}</p>
            <p className="text-xs text-muted-foreground">
              Parent: {registration.parent_accounts?.parent_name} • {registration.schools?.name}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Subscription Type</Label>
            <Select
              value={subscriptionType}
              onValueChange={(v) => setSubscriptionType(v as Enums<'subscription_type'>)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background border border-border z-50">
                <SelectItem value="yearly">Yearly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Total Value (EGP)</Label>
            <Input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Enter total amount"
              min="0"
              step="0.01"
            />
          </div>

          <div className="space-y-2">
            <Label>Insurance / التأمين (EGP)</Label>
            <Input
              type="number"
              value={insurance}
              onChange={(e) => setInsurance(e.target.value)}
              placeholder="Enter insurance amount (optional)"
              min="0"
              step="0.01"
            />
          </div>

          <div className="space-y-2">
            <Label>Number of Installments</Label>
            <Select value={installments} onValueChange={setInstallments}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background border border-border z-50">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <SelectItem key={n} value={n.toString()}>
                    {n} {n === 1 ? 'Payment' : 'Installments'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>First Installment Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-50" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => date && setStartDate(date)}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {totalValue > 0 && (
            <div className="p-3 bg-primary/10 rounded-lg space-y-2">
              <p className="text-sm font-medium">Payment Summary</p>
              <p className="text-xs text-muted-foreground">
                {numInstallments} x {perInstallment.toFixed(2)} EGP = {totalValue.toFixed(2)} EGP
              </p>
              {(parseFloat(insurance) || 0) > 0 && (
                <p className="text-xs text-muted-foreground">
                  + Insurance: {(parseFloat(insurance) || 0).toFixed(2)} EGP
                </p>
              )}
              <div className="text-xs text-muted-foreground space-y-0.5 border-t border-primary/10 pt-2 mt-1">
                {(parseFloat(insurance) || 0) > 0 && (
                  <div className="flex justify-between font-medium">
                    <span>Insurance / التأمين</span>
                    <span>{format(startDate, "dd MMM yyyy")}</span>
                  </div>
                )}
                {numInstallments > 1 && Array.from({ length: numInstallments }, (_, i) => {
                  const d = new Date(startDate);
                  d.setMonth(d.getMonth() + i);
                  return (
                    <div key={i} className="flex justify-between">
                      <span>Installment {i + 1}</span>
                      <span>{format(d, "dd MMM yyyy")}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : 'Save Subscription'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SubscriptionDialog;
