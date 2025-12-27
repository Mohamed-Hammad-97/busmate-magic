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

const RegistrationDetails: React.FC<RegistrationDetailsProps> = ({
  open,
  onOpenChange,
  registration,
}) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  if (!registration) return null;

  const parent = registration.parent_accounts;
  const school = registration.schools;

  const statusColors: Record<Enums<'registration_status'>, 'default' | 'secondary' | 'destructive'> = {
    pending_fees: 'secondary',
    complete: 'default',
    cancelled: 'destructive',
  };

  const statusLabels: Record<Enums<'registration_status'>, string> = {
    pending_fees: t('registrations.pendingFees'),
    complete: t('registrations.complete'),
    cancelled: t('registrations.cancelled'),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center justify-between">
            <span>{t('registrations.registrationDetails')}</span>
            <Badge variant={statusColors[registration.status]}>
              {statusLabels[registration.status]}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] px-6 pb-6">
          <div className="space-y-6 pt-4">
            {/* Student Info */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <User className="h-4 w-4" />
                {t('registrations.studentParentInfo')}
              </h3>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('registrations.studentName')}</span>
                  <span className="font-medium">{registration.student_name || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('registrations.parentName')}</span>
                  <span className="font-medium">{parent?.parent_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('registrations.nationalId')}</span>
                  <span className="font-medium">{parent?.national_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('registrations.city')}</span>
                  <span className="font-medium">{parent?.city}</span>
                </div>
                {parent?.job && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('registrations.job')}</span>
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
                {t('registrations.contactNumbers')}
              </h3>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('registrations.fatherPhone')}</span>
                  <a href={`tel:${parent?.father_phone}`} className="font-medium text-primary hover:underline">
                    {parent?.father_phone}
                  </a>
                </div>
                {parent?.mother_phone && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('registrations.motherPhone')}</span>
                    <a href={`tel:${parent.mother_phone}`} className="font-medium text-primary hover:underline">
                      {parent.mother_phone}
                    </a>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('registrations.emergency')}</span>
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
                {t('registrations.schoolEnrollment')}
              </h3>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('registrations.school')}</span>
                  <span className="font-medium">{school?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('registrations.grade')}</span>
                  <span className="font-medium">{registration.grade}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('registrations.educationDept')}</span>
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
                {t('registrations.transportDetails')}
              </h3>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('registrations.carType')}</span>
                  <Badge variant="outline">
                    {registration.car_type === 'ac' ? t('registrations.ac') : t('registrations.nonAc')}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('registrations.pickupLocation')}</span>
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
                {t('registrations.registrationInfo')}
              </h3>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('registrations.createdAt')}</span>
                  <span className="font-medium">
                    {new Date(registration.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('registrations.lastUpdated')}</span>
                  <span className="font-medium">
                    {new Date(registration.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default RegistrationDetails;
