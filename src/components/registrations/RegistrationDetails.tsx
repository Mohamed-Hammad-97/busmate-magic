import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Phone, MapPin, School, User, Calendar, Car } from 'lucide-react';
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

const statusColors: Record<Enums<'registration_status'>, 'default' | 'secondary' | 'destructive'> = {
  pending_fees: 'secondary',
  complete: 'default',
  cancelled: 'destructive',
};

const statusLabels: Record<Enums<'registration_status'>, string> = {
  pending_fees: 'Pending Fees',
  complete: 'Complete',
  cancelled: 'Cancelled',
};

const RegistrationDetails: React.FC<RegistrationDetailsProps> = ({
  open,
  onOpenChange,
  registration,
}) => {
  if (!registration) return null;

  const parent = registration.parent_accounts;
  const school = registration.schools;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Registration Details</span>
            <Badge variant={statusColors[registration.status]}>
              {statusLabels[registration.status]}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Parent Info */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <User className="h-4 w-4" />
              Parent Information
            </h3>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{parent?.parent_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">National ID</span>
                <span className="font-medium">{parent?.national_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">City</span>
                <span className="font-medium">{parent?.city}</span>
              </div>
              {parent?.job && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Job</span>
                  <span className="font-medium">{parent.job}</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Contact Info */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Contact Numbers
            </h3>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Father Phone</span>
                <a href={`tel:${parent?.father_phone}`} className="font-medium text-primary hover:underline">
                  {parent?.father_phone}
                </a>
              </div>
              {parent?.mother_phone && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mother Phone</span>
                  <a href={`tel:${parent.mother_phone}`} className="font-medium text-primary hover:underline">
                    {parent.mother_phone}
                  </a>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Emergency</span>
                <a href={`tel:${parent?.emergency_phone}`} className="font-medium text-destructive hover:underline">
                  {parent?.emergency_phone}
                </a>
              </div>
            </div>
          </div>

          <Separator />

          {/* School Info */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <School className="h-4 w-4" />
              School & Enrollment
            </h3>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">School</span>
                <span className="font-medium">{school?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Grade</span>
                <span className="font-medium">{registration.grade}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Education Dept.</span>
                <Badge variant="outline" className="capitalize">
                  {registration.education_department}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Transport Info */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Car className="h-4 w-4" />
              Transport Details
            </h3>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Car Type</span>
                <Badge variant="outline">
                  {registration.car_type === 'ac' ? 'AC' : 'Non-AC'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pickup Location</span>
                <span className="font-medium text-xs">
                  {parent?.pickup_latitude.toFixed(4)}, {parent?.pickup_longitude.toFixed(4)}
                </span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Registration Info */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Registration Info
            </h3>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created At</span>
                <span className="font-medium">
                  {new Date(registration.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Updated</span>
                <span className="font-medium">
                  {new Date(registration.updated_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RegistrationDetails;
