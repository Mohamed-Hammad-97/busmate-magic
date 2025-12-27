import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { User, Phone, MapPin, Briefcase, GraduationCap } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type ParentAccount = Tables<'parent_accounts'>;

interface CustomerDetailsProps {
  isOpen: boolean;
  onClose: () => void;
  customer: ParentAccount | null;
}

const CustomerDetails: React.FC<CustomerDetailsProps> = ({ isOpen, onClose, customer }) => {
  const { data: registrations = [] } = useQuery({
    queryKey: ['customer-registrations', customer?.id],
    queryFn: async () => {
      if (!customer) return [];
      const { data, error } = await supabase
        .from('registrations')
        .select(`
          *,
          schools (name)
        `)
        .eq('parent_id', customer.id);
      if (error) throw error;
      return data;
    },
    enabled: !!customer,
  });

  if (!customer) return null;

  const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pending_fees: { label: 'في انتظار الرسوم', variant: 'secondary' },
    complete: { label: 'مكتمل', variant: 'default' },
    cancelled: { label: 'ملغي', variant: 'destructive' },
  };

  const carTypeLabels: Record<string, string> = {
    ac: 'مكيف',
    non_ac: 'غير مكيف',
  };

  const educationLabels: Record<string, string> = {
    national: 'وطني',
    ig: 'IG',
    american: 'أمريكي',
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>تفاصيل العميل</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5" />
                المعلومات الشخصية
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">اسم ولي الأمر</p>
                  <p className="font-medium">{customer.parent_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">الرقم القومي</p>
                  <p className="font-medium">{customer.national_id}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Phone className="h-5 w-5" />
                معلومات الاتصال
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">هاتف الأب</p>
                  <p className="font-medium" dir="ltr">{customer.father_phone}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">هاتف الأم</p>
                  <p className="font-medium" dir="ltr">{customer.mother_phone || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">هاتف الطوارئ</p>
                  <p className="font-medium" dir="ltr">{customer.emergency_phone}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Location & Job */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-5 w-5" />
                الموقع والوظيفة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">المدينة</p>
                  <p className="font-medium">{customer.city}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">الوظيفة</p>
                  <p className="font-medium">{customer.job || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">إحداثيات الاستلام</p>
                  <p className="font-medium text-sm" dir="ltr">
                    {customer.pickup_latitude.toFixed(6)}, {customer.pickup_longitude.toFixed(6)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Registrations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <GraduationCap className="h-5 w-5" />
                التسجيلات ({registrations.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {registrations.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">لا توجد تسجيلات</p>
              ) : (
                <div className="space-y-3">
                  {registrations.map((reg: any) => (
                    <div
                      key={reg.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div>
                        <p className="font-medium">{reg.schools?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {reg.grade} - {educationLabels[reg.education_department]} - {carTypeLabels[reg.car_type]}
                        </p>
                      </div>
                      <Badge variant={statusLabels[reg.status]?.variant || 'secondary'}>
                        {statusLabels[reg.status]?.label || reg.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerDetails;
