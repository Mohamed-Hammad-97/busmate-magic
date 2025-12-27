import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
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

  const [subscriptionType, setSubscriptionType] = useState<Enums<'subscription_type'>>('yearly');
  const [value, setValue] = useState<string>('');
  const [installments, setInstallments] = useState<string>('1');

  useEffect(() => {
    if (open) {
      setSubscriptionType('yearly');
      setValue('');
      setInstallments('1');
    }
  }, [open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!registration || !user) throw new Error('Missing data');

      const totalValue = parseFloat(value);
      const numInstallments = parseInt(installments);
      const installmentAmount = totalValue / numInstallments;

      // Create subscription
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

      // Create payments for each installment
      const payments = [];
      const today = new Date();
      for (let i = 0; i < numInstallments; i++) {
        const dueDate = new Date(today);
        if (subscriptionType === 'yearly') {
          dueDate.setMonth(dueDate.getMonth() + i);
        } else {
          dueDate.setDate(dueDate.getDate() + (i * 30));
        }
        
        payments.push({
          subscription_id: subscription.id,
          amount: installmentAmount,
          installment_number: i + 1,
          due_date: dueDate.toISOString().split('T')[0],
          status: 'pending' as Enums<'payment_status'>,
        });
      }

      const { error: payError } = await supabase.from('payments').insert(payments);
      if (payError) throw payError;

      // Update registration status to complete
      const { error: regError } = await supabase
        .from('registrations')
        .update({ status: 'complete' })
        .eq('id', registration.id);
      if (regError) throw regError;
    },
    onSuccess: () => {
      toast({ title: 'Subscription created successfully' });
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
          <DialogTitle>Add Subscription & Fees</DialogTitle>
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

          {totalValue > 0 && (
            <div className="p-3 bg-primary/10 rounded-lg space-y-1">
              <p className="text-sm font-medium">Payment Summary</p>
              <p className="text-xs text-muted-foreground">
                {numInstallments} x {perInstallment.toFixed(2)} EGP = {totalValue.toFixed(2)} EGP
              </p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : 'Create Subscription'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SubscriptionDialog;
