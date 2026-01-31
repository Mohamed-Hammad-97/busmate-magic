import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import LocationPickerMap from '@/components/schools/LocationPickerMap';
import { GoogleMapsProvider } from '@/components/maps/GoogleMapsProvider';
import { CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Enums } from '@/integrations/supabase/types';

const gradeOptions = [
  'KG1', 'KG2', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4',
  'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9',
  'Grade 10', 'Grade 11', 'Grade 12'
];

interface FormData {
  student_name: string;
  parent_name: string;
  national_id: string;
  father_phone: string;
  mother_phone: string;
  emergency_phone: string;
  city: string;
  job: string;
  pickup_latitude: number;
  pickup_longitude: number;
  school_id: string;
  grade: string;
  car_type: Enums<'car_type'>;
  education_department: Enums<'education_department'>;
}

const StudentRegistrationForm: React.FC = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  const [submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState(1);

  const [formData, setFormData] = useState<FormData>({
    student_name: '',
    parent_name: '',
    national_id: '',
    father_phone: '',
    mother_phone: '',
    emergency_phone: '',
    city: '',
    job: '',
    pickup_latitude: 30.0444,
    pickup_longitude: 31.2357,
    school_id: '',
    grade: '',
    car_type: 'ac',
    education_department: 'national',
  });

  const { data: schools = [] } = useQuery({
    queryKey: ['schools-public'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schools')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: cities = [] } = useQuery({
    queryKey: ['cities-public'],
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

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('public-register', {
        body: {
          student_name: formData.student_name,
          parent_name: formData.parent_name,
          national_id: formData.national_id,
          father_phone: formData.father_phone,
          mother_phone: formData.mother_phone || undefined,
          emergency_phone: formData.emergency_phone,
          city: formData.city,
          job: formData.job || undefined,
          pickup_latitude: formData.pickup_latitude,
          pickup_longitude: formData.pickup_longitude,
          school_id: formData.school_id,
          grade: formData.grade,
          car_type: formData.car_type,
          education_department: formData.education_department,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (error: any) => {
      toast({ title: t('register.error'), description: error.message, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.student_name.trim()) {
      toast({ title: t('register.student.validation.studentName'), variant: 'destructive' });
      return;
    }
    if (!formData.parent_name.trim()) {
      toast({ title: t('register.student.validation.parentName'), variant: 'destructive' });
      return;
    }
    if (!formData.national_id.trim()) {
      toast({ title: t('register.student.validation.nationalId'), variant: 'destructive' });
      return;
    }
    if (!formData.father_phone.trim()) {
      toast({ title: t('register.student.validation.fatherPhone'), variant: 'destructive' });
      return;
    }
    if (!formData.emergency_phone.trim()) {
      toast({ title: t('register.student.validation.emergencyPhone'), variant: 'destructive' });
      return;
    }
    if (!formData.city) {
      toast({ title: t('register.student.validation.city'), variant: 'destructive' });
      return;
    }
    if (!formData.school_id) {
      toast({ title: t('register.student.validation.school'), variant: 'destructive' });
      return;
    }
    if (!formData.grade) {
      toast({ title: t('register.student.validation.grade'), variant: 'destructive' });
      return;
    }

    submitMutation.mutate();
  };

  if (submitted) {
    return (
      <Card className="max-w-md w-full text-center mx-auto">
        <CardContent className="pt-8 pb-8 space-y-4">
          <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
          <h2 className="text-2xl font-bold">{t('register.student.success.title')}</h2>
          <p className="text-muted-foreground">
            {t('register.student.success.message')}
          </p>
          <p className="text-sm text-muted-foreground">
            {t('register.student.success.studentLabel')}: {formData.student_name}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      {/* Steps */}
      <div className="flex justify-center gap-4 mb-8">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors ${
              step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            {s}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>{t('register.student.step1.title')}</CardTitle>
              <CardDescription>{t('register.student.step1.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t('register.student.fields.studentName')} *</Label>
                <Input
                  value={formData.student_name}
                  onChange={(e) => setFormData((f) => ({ ...f, student_name: e.target.value }))}
                  placeholder={t('register.student.placeholders.studentName')}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t('register.student.fields.parentName')} *</Label>
                  <Input
                    value={formData.parent_name}
                    onChange={(e) => setFormData((f) => ({ ...f, parent_name: e.target.value }))}
                    placeholder={t('register.student.placeholders.parentName')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('register.student.fields.nationalId')} *</Label>
                  <Input
                    value={formData.national_id}
                    onChange={(e) => setFormData((f) => ({ ...f, national_id: e.target.value }))}
                    placeholder={t('register.student.placeholders.nationalId')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('register.student.fields.fatherPhone')} *</Label>
                  <Input
                    value={formData.father_phone}
                    onChange={(e) => setFormData((f) => ({ ...f, father_phone: e.target.value }))}
                    placeholder="01xxxxxxxxx"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('register.student.fields.motherPhone')}</Label>
                  <Input
                    value={formData.mother_phone}
                    onChange={(e) => setFormData((f) => ({ ...f, mother_phone: e.target.value }))}
                    placeholder="01xxxxxxxxx"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('register.student.fields.emergencyPhone')} *</Label>
                  <Input
                    value={formData.emergency_phone}
                    onChange={(e) => setFormData((f) => ({ ...f, emergency_phone: e.target.value }))}
                    placeholder="01xxxxxxxxx"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('register.student.fields.occupation')}</Label>
                  <Input
                    value={formData.job}
                    onChange={(e) => setFormData((f) => ({ ...f, job: e.target.value }))}
                    placeholder={t('register.student.placeholders.occupation')}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>{t('register.student.fields.city')} *</Label>
                  <Select
                    value={formData.city}
                    onValueChange={(v) => setFormData((f) => ({ ...f, city: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('register.student.placeholders.city')} />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border z-50">
                      {cities.map((city) => (
                        <SelectItem key={city.id} value={city.name}>
                          {city.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end pt-4">
                <Button type="button" onClick={() => setStep(2)}>
                  {t('register.common.next')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>{t('register.student.step2.title')}</CardTitle>
              <CardDescription>{t('register.student.step2.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <GoogleMapsProvider>
                <LocationPickerMap
                  initialLat={formData.pickup_latitude}
                  initialLng={formData.pickup_longitude}
                  onLocationChange={(lat, lng) =>
                    setFormData((f) => ({ ...f, pickup_latitude: lat, pickup_longitude: lng }))
                  }
                />
              </GoogleMapsProvider>
              <div className="flex gap-4 justify-center text-sm text-muted-foreground">
                <span>{t('register.common.latitude')}: {formData.pickup_latitude.toFixed(6)}</span>
                <span>{t('register.common.longitude')}: {formData.pickup_longitude.toFixed(6)}</span>
              </div>
              <div className="flex justify-between pt-4">
                <Button type="button" variant="outline" onClick={() => setStep(1)}>
                  {t('register.common.previous')}
                </Button>
                <Button type="button" onClick={() => setStep(3)}>
                  {t('register.common.next')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>{t('register.student.step3.title')}</CardTitle>
              <CardDescription>{t('register.student.step3.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t('register.student.fields.school')} *</Label>
                  <Select
                    value={formData.school_id}
                    onValueChange={(v) => setFormData((f) => ({ ...f, school_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('register.student.placeholders.school')} />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border z-50">
                      {schools.map((school) => (
                        <SelectItem key={school.id} value={school.id}>
                          {school.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('register.student.fields.grade')} *</Label>
                  <Select
                    value={formData.grade}
                    onValueChange={(v) => setFormData((f) => ({ ...f, grade: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('register.student.placeholders.grade')} />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border z-50">
                      {gradeOptions.map((grade) => (
                        <SelectItem key={grade} value={grade}>
                          {grade}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('register.student.fields.educationDepartment')} *</Label>
                  <Select
                    value={formData.education_department}
                    onValueChange={(v) => setFormData((f) => ({ ...f, education_department: v as Enums<'education_department'> }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border z-50">
                      <SelectItem value="national">{t('register.student.options.national')}</SelectItem>
                      <SelectItem value="ig">{t('register.student.options.ig')}</SelectItem>
                      <SelectItem value="american">{t('register.student.options.american')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('register.student.fields.carType')} *</Label>
                  <Select
                    value={formData.car_type}
                    onValueChange={(v) => setFormData((f) => ({ ...f, car_type: v as Enums<'car_type'> }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border z-50">
                      <SelectItem value="ac">{t('register.student.options.ac')}</SelectItem>
                      <SelectItem value="non_ac">{t('register.student.options.nonAc')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-between pt-4">
                <Button type="button" variant="outline" onClick={() => setStep(2)}>
                  {t('register.common.previous')}
                </Button>
                <Button type="submit" disabled={submitMutation.isPending}>
                  {submitMutation.isPending ? t('register.common.submitting') : t('register.common.submit')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </form>
    </div>
  );
};

export default StudentRegistrationForm;
