import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { User, Phone, MapPin, Briefcase, GraduationCap, Mail, Shield, Calendar } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type ParentAccount = Tables<'parent_accounts'>;

interface CustomerDetailsProps {
  isOpen: boolean;
  onClose: () => void;
  customer: ParentAccount | null;
}

const CustomerDetails: React.FC<CustomerDetailsProps> = ({ isOpen, onClose, customer }) => {
  const { t } = useTranslation();

  React.useEffect(() => {
    const logAccess = async () => {
      if (isOpen && customer?.id) {
        await supabase.rpc('log_sensitive_data_access', {
          p_table_name: 'parent_accounts',
          p_record_id: customer.id
        });
      }
    };
    logAccess().catch(console.error);
  }, [isOpen, customer?.id]);

  const { data: registrations = [] } = useQuery({
    queryKey: ['customer-registrations', customer?.id],
    queryFn: async () => {
      if (!customer) return [];
      const { data, error } = await supabase
        .from('registrations')
        .select(`*, schools (name)`)
        .eq('parent_id', customer.id);
      if (error) throw error;
      return data;
    },
    enabled: !!customer,
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['customer-subscriptions', customer?.id],
    queryFn: async () => {
      if (!customer) return [];
      const regIds = registrations.map(r => r.id);
      if (regIds.length === 0) return [];
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .in('registration_id', regIds);
      if (error) throw error;
      return data;
    },
    enabled: registrations.length > 0,
  });

  if (!customer) return null;

  const statusLabels: Record<string, { label: string; color: string }> = {
    pending_fees: { label: 'Pending Fees', color: 'bg-warning/10 text-warning border-warning/20' },
    complete: { label: 'Complete', color: 'bg-success/10 text-success border-success/20' },
    cancelled: { label: 'Cancelled', color: 'bg-destructive/10 text-destructive border-destructive/20' },
  };

  const totalSubscriptionValue = subscriptions.reduce((sum, s) => sum + Number(s.value), 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden rounded-2xl border-border/50">
        {/* Premium Header Card */}
        <div className="relative bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 border-b border-border/50 px-6 pt-6 pb-5">
          <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl" />
          <DialogHeader className="relative">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center text-xl font-bold text-primary shrink-0 ring-2 ring-primary/10">
                {customer.parent_name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg font-bold text-foreground tracking-tight">
                  {customer.parent_name}
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  National ID: {customer.national_id}
                </p>
                <div className="flex items-center flex-wrap gap-2 mt-2">
                  {customer.user_id ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full border bg-success/10 text-success border-success/20">
                      <Shield className="h-3 w-3" /> Active Account
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full border bg-muted/50 text-muted-foreground border-border/50">
                      Inactive
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full border bg-primary/10 text-primary border-primary/20">
                    <GraduationCap className="h-3 w-3" /> {registrations.length} Students
                  </span>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Quick Info Row */}
          <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-primary" />
              <span dir="ltr">{customer.father_phone}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              {customer.city}
            </span>
            {customer.job && (
              <span className="inline-flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5 text-primary" />
                {customer.job}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              <span dir="ltr" className="font-mono text-[10px]">
                {customer.pickup_latitude.toFixed(6)}, {customer.pickup_longitude.toFixed(6)}
              </span>
            </span>
          </div>
        </div>

        <ScrollArea className="max-h-[60vh]">
          <div className="px-6 py-5 space-y-5">
            {/* Contact Details */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <Phone className="h-3.5 w-3.5" /> Contact Information
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Father Phone', value: customer.father_phone },
                  { label: 'Mother Phone', value: customer.mother_phone || '—' },
                  { label: 'Emergency', value: customer.emergency_phone },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-border/50 bg-muted/30 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{item.label}</p>
                    <p className="text-sm font-medium text-foreground" dir="ltr">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <Separator className="bg-border/30" />

            {/* Registrations */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <GraduationCap className="h-3.5 w-3.5" /> Registrations ({registrations.length})
              </h3>
              {registrations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No registrations found</p>
              ) : (
                <div className="space-y-2">
                  {registrations.map((reg: any) => (
                    <div key={reg.id} className="group relative overflow-hidden rounded-xl border border-border/50 bg-card hover:shadow-md transition-all duration-200 p-4">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
                      <div className="relative flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                            <GraduationCap className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{reg.student_name || 'Student'}</p>
                            <p className="text-xs text-muted-foreground">{reg.schools?.name} · {reg.grade} · {reg.education_department.toUpperCase()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] capitalize">{reg.car_type === 'ac' ? 'AC' : 'Non-AC'}</Badge>
                          <span className={`inline-flex items-center text-[10px] font-medium px-2.5 py-0.5 rounded-full border ${statusLabels[reg.status]?.color || 'bg-muted/50 text-muted-foreground border-border/50'}`}>
                            {statusLabels[reg.status]?.label || reg.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Subscription Summary */}
            {totalSubscriptionValue > 0 && (
              <>
                <Separator className="bg-border/30" />
                <div className="rounded-xl border border-border/50 bg-gradient-to-r from-primary/5 to-transparent p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm font-medium text-foreground">Total Subscription Value</span>
                  </div>
                  <span className="text-lg font-bold text-primary">{totalSubscriptionValue.toLocaleString()} EGP</span>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerDetails;
