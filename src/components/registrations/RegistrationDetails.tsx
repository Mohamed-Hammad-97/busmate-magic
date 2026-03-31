import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Phone, MapPin, School, User, Calendar, Car, GraduationCap, Shield, DollarSign } from 'lucide-react';
import type { Tables, Enums } from '@/integrations/supabase/types';

type Registration = Tables<'registrations'> & {
  parent_accounts: Tables<'parent_accounts'>;
  schools: Tables<'schools'>;
};

interface RegistrationDetailsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registration: Registration | null;
}

const RegistrationDetails: React.FC<RegistrationDetailsProps> = ({
  open,
  onOpenChange,
  registration,
}) => {
  const { t } = useTranslation();

  if (!registration) return null;

  const parent = registration.parent_accounts;
  const school = registration.schools;

  const statusConfig: Record<Enums<'registration_status'>, { label: string; color: string }> = {
    pending_fees: { label: 'Pending Fees', color: 'bg-warning/10 text-warning border-warning/20' },
    complete: { label: 'Complete', color: 'bg-success/10 text-success border-success/20' },
    cancelled: { label: 'Cancelled', color: 'bg-destructive/10 text-destructive border-destructive/20' },
    archived: { label: 'Archived', color: 'bg-muted text-muted-foreground border-muted' },
  };

  const status = statusConfig[registration.status];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden rounded-2xl border-border/50">
        {/* Premium Header Card */}
        <div className="relative bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 border-b border-border/50 px-6 pt-6 pb-5">
          <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl" />
          <DialogHeader className="relative">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center text-xl font-bold text-primary shrink-0 ring-2 ring-primary/10">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg font-bold text-foreground tracking-tight">
                  {registration.student_name || 'Student'}
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Parent: {parent?.parent_name}
                </p>
                <div className="flex items-center flex-wrap gap-2 mt-2">
                  <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${status.color}`}>
                    {status.label}
                  </span>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {registration.car_type === 'ac' ? 'AC' : 'Non-AC'}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {registration.education_department}
                  </Badge>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Quick Info Row */}
          <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <School className="h-3.5 w-3.5 text-primary" />
              {school?.name}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-primary" />
              <span dir="ltr">{parent?.father_phone}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              {parent?.city}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              <span dir="ltr" className="font-mono text-[10px]">
                {parent?.pickup_latitude.toFixed(6)}, {parent?.pickup_longitude.toFixed(6)}
              </span>
            </span>
          </div>
        </div>

        <ScrollArea className="max-h-[60vh]">
          <div className="px-6 py-5 space-y-5">
            {/* Student & Parent Info */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <User className="h-3.5 w-3.5" /> Student & Parent Info
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Student Name', value: registration.student_name || '—' },
                  { label: 'Parent Name', value: parent?.parent_name },
                  { label: 'National ID', value: parent?.national_id },
                  { label: 'Grade', value: registration.grade },
                  { label: 'City', value: parent?.city },
                  { label: 'Job', value: parent?.job || '—' },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-border/50 bg-muted/30 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{item.label}</p>
                    <p className="text-sm font-medium text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <Separator className="bg-border/30" />

            {/* Contact Numbers */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <Phone className="h-3.5 w-3.5" /> Contact Numbers
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Father Phone', value: parent?.father_phone, href: `tel:${parent?.father_phone}` },
                  { label: 'Mother Phone', value: parent?.mother_phone || '—', href: parent?.mother_phone ? `tel:${parent.mother_phone}` : undefined },
                  { label: 'Emergency', value: parent?.emergency_phone, href: `tel:${parent?.emergency_phone}` },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-border/50 bg-muted/30 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{item.label}</p>
                    {item.href && item.value !== '—' ? (
                      <a href={item.href} className="text-sm font-medium text-primary hover:underline" dir="ltr">{item.value}</a>
                    ) : (
                      <p className="text-sm font-medium text-foreground" dir="ltr">{item.value}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Separator className="bg-border/30" />

            {/* School & Transport */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <Car className="h-3.5 w-3.5" /> School & Transport
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'School', value: school?.name },
                  { label: 'Education Dept', value: registration.education_department.toUpperCase() },
                  { label: 'Car Type', value: registration.car_type === 'ac' ? 'AC (Air Conditioned)' : 'Non-AC' },
                  { label: 'Grade', value: registration.grade },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-border/50 bg-muted/30 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{item.label}</p>
                    <p className="text-sm font-medium text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <Separator className="bg-border/30" />

            {/* Pickup Location Map */}
            {parent?.pickup_latitude && parent?.pickup_longitude && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5" /> Pickup Location
                </h3>
                <div className="rounded-xl overflow-hidden border border-border/50">
                  <iframe
                    width="100%"
                    height="200"
                    style={{ border: 0 }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://www.google.com/maps?q=${parent.pickup_latitude},${parent.pickup_longitude}&z=15&output=embed`}
                    title="Pickup Location"
                  />
                </div>
              </div>
            )}

            {/* Dates */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground pt-2">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Created: {new Date(registration.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Updated: {new Date(registration.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default RegistrationDetails;
