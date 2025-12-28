import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';
import LocationPickerMap from '@/components/schools/LocationPickerMap';
import { GoogleMapsProvider } from '@/components/maps/GoogleMapsProvider';

type ParentAccount = Tables<'parent_accounts'>;

interface CustomerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  customer: ParentAccount | null;
}

interface FormData {
  parent_name: string;
  national_id: string;
  father_phone: string;
  mother_phone: string;
  emergency_phone: string;
  city: string;
  job: string;
  pickup_latitude: number;
  pickup_longitude: number;
}

const CustomerDialog: React.FC<CustomerDialogProps> = ({ isOpen, onClose, customer }) => {
  const queryClient = useQueryClient();
  

  const [formData, setFormData] = useState<FormData>({
    parent_name: '',
    national_id: '',
    father_phone: '',
    mother_phone: '',
    emergency_phone: '',
    city: '',
    job: '',
    pickup_latitude: 30.0444,
    pickup_longitude: 31.2357,
  });

  const { data: cities = [] } = useQuery({
    queryKey: ['active-cities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cities')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (customer) {
      setFormData({
        parent_name: customer.parent_name,
        national_id: customer.national_id,
        father_phone: customer.father_phone,
        mother_phone: customer.mother_phone || '',
        emergency_phone: customer.emergency_phone,
        city: customer.city,
        job: customer.job || '',
        pickup_latitude: customer.pickup_latitude,
        pickup_longitude: customer.pickup_longitude,
      });
    } else {
      setFormData({
        parent_name: '',
        national_id: '',
        father_phone: '',
        mother_phone: '',
        emergency_phone: '',
        city: '',
        job: '',
        pickup_latitude: 30.0444,
        pickup_longitude: 31.2357,
      });
    }
  }, [customer, isOpen]);

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (customer) {
        const { error } = await supabase
          .from('parent_accounts')
          .update({
            parent_name: data.parent_name,
            national_id: data.national_id,
            father_phone: data.father_phone,
            mother_phone: data.mother_phone || null,
            emergency_phone: data.emergency_phone,
            city: data.city,
            job: data.job || null,
            pickup_latitude: data.pickup_latitude,
            pickup_longitude: data.pickup_longitude,
          })
          .eq('id', customer.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('parent_accounts')
          .insert({
            parent_name: data.parent_name,
            national_id: data.national_id,
            father_phone: data.father_phone,
            mother_phone: data.mother_phone || null,
            emergency_phone: data.emergency_phone,
            city: data.city,
            job: data.job || null,
            pickup_latitude: data.pickup_latitude,
            pickup_longitude: data.pickup_longitude,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success(customer ? 'تم تحديث العميل بنجاح' : 'تم إضافة العميل بنجاح');
      onClose();
    },
    onError: (error) => {
      toast.error('حدث خطأ أثناء الحفظ');
      console.error(error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.parent_name || !formData.national_id || !formData.father_phone || !formData.emergency_phone || !formData.city) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    saveMutation.mutate(formData);
  };

  const handleLocationChange = (lat: number, lng: number) => {
    setFormData((prev) => ({
      ...prev,
      pickup_latitude: lat,
      pickup_longitude: lng,
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{customer ? 'تعديل العميل' : 'إضافة عميل جديد'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="info">المعلومات الأساسية</TabsTrigger>
              <TabsTrigger value="location">موقع الاستلام</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="parent_name">اسم ولي الأمر *</Label>
                  <Input
                    id="parent_name"
                    value={formData.parent_name}
                    onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="national_id">الرقم القومي *</Label>
                  <Input
                    id="national_id"
                    value={formData.national_id}
                    onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="father_phone">هاتف الأب *</Label>
                  <Input
                    id="father_phone"
                    value={formData.father_phone}
                    onChange={(e) => setFormData({ ...formData, father_phone: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mother_phone">هاتف الأم</Label>
                  <Input
                    id="mother_phone"
                    value={formData.mother_phone}
                    onChange={(e) => setFormData({ ...formData, mother_phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emergency_phone">هاتف الطوارئ *</Label>
                  <Input
                    id="emergency_phone"
                    value={formData.emergency_phone}
                    onChange={(e) => setFormData({ ...formData, emergency_phone: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">المدينة *</Label>
                  <Select
                    value={formData.city}
                    onValueChange={(value) => setFormData({ ...formData, city: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر المدينة" />
                    </SelectTrigger>
                    <SelectContent>
                      {cities.map((city) => (
                        <SelectItem key={city.id} value={city.name}>
                          {city.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="job">الوظيفة</Label>
                <Input
                  id="job"
                  value={formData.job}
                  onChange={(e) => setFormData({ ...formData, job: e.target.value })}
                />
              </div>
            </TabsContent>

            <TabsContent value="location" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>خط العرض</Label>
                  <Input value={formData.pickup_latitude.toFixed(6)} readOnly />
                </div>
                <div className="space-y-2">
                  <Label>خط الطول</Label>
                  <Input value={formData.pickup_longitude.toFixed(6)} readOnly />
                </div>
              </div>
              <GoogleMapsProvider>
                <LocationPickerMap
                  initialLat={formData.pickup_latitude}
                  initialLng={formData.pickup_longitude}
                  onLocationChange={handleLocationChange}
                />
              </GoogleMapsProvider>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 mt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerDialog;
