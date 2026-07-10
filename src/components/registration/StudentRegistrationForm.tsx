import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
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
import { CheckCircle2, User, MapPin, GraduationCap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Enums } from '@/integrations/supabase/types';
import { useNavigate } from 'react-router-dom';

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
  payment_phone: string;
  city: string;
  job: string;
  comments: string;
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
  const navigate = useNavigate();
  
  const [submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState(1);

  const [formData, setFormData] = useState<FormData>({
    student_name: '',
    parent_name: '',
    national_id: '',
    father_phone: '',
    mother_phone: '',
    emergency_phone: '',
    payment_phone: '',
    city: '',
    job: '',
    comments: '',
    pickup_latitude: 30.0444,
    pickup_longitude: 31.2357,
    school_id: '',
    grade: '',
    car_type: 'ac',
    education_department: 'national',
  });

  const { data: schools = [] } = useQuery({
    queryKey: ['schools-public', formData.city],
    queryFn: async () => {
      let query = supabase
        .from('schools')
        .select('*')
        .eq('is_active', true);
      if (formData.city) {
        query = query.eq('city', formData.city);
      }
      const { data, error } = await query.order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!formData.city,
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
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-register`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_name: formData.student_name,
            parent_name: formData.parent_name,
            national_id: formData.national_id || undefined,
            father_phone: formData.father_phone,
            mother_phone: formData.mother_phone,
            emergency_phone: formData.emergency_phone,
            payment_phone: formData.payment_phone,
            city: formData.city,
            job: formData.job || undefined,
            comments: formData.comments || undefined,
            pickup_latitude: formData.pickup_latitude,
            pickup_longitude: formData.pickup_longitude,
            school_id: formData.school_id,
            grade: formData.grade,
            car_type: formData.car_type,
            education_department: formData.education_department,
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }
      return data;
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
    if (!formData.father_phone.trim()) {
      toast({ title: t('register.student.validation.fatherPhone'), variant: 'destructive' });
      return;
    }
    if (!formData.mother_phone.trim()) {
      toast({ title: t('register.student.validation.motherPhone') || 'رقم هاتف الأم مطلوب', variant: 'destructive' });
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

  const handleRegisterAnother = () => {
    setFormData(prev => ({
      ...prev,
      student_name: '',
      school_id: '',
      grade: '',
      car_type: 'ac',
      education_department: 'national',
    }));
    setStep(1);
    setSubmitted(false);
  };

  if (submitted) {
    return (
      <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-8 text-center space-y-6 max-w-md mx-auto animate-fade-in">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/10 text-green-500 mb-4">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <h2 className="text-2xl font-bold">{t('register.student.success.title')}</h2>
        <p className="text-muted-foreground">
          {t('register.student.success.message')}
        </p>
        <p className="text-sm text-muted-foreground">
          {t('register.student.success.studentLabel')}: <span className="font-medium text-foreground">{formData.student_name}</span>
        </p>
        <div className="space-y-3">
          <Button onClick={handleRegisterAnother} variant="outline" className="w-full" size="lg">
            {t('register.student.registerAnother', 'تسجيل طالب آخر')}
          </Button>
          <Button onClick={() => navigate('/')} className="w-full" size="lg">
            {t('register.private.success.backHome') || 'Back to Home'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Steps Indicator */}
      <div className="flex justify-center items-center gap-4 mb-10">
        {[
          { num: 1, icon: User, label: t('register.student.step1.title') },
          { num: 2, icon: MapPin, label: t('register.student.step2.title') },
          { num: 3, icon: GraduationCap, label: t('register.student.step3.title') },
        ].map((s, index) => (
          <React.Fragment key={s.num}>
            <div className="flex flex-col items-center gap-2">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center font-bold transition-all duration-300 ${
                  step >= s.num 
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg' 
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                <s.icon className="h-5 w-5" />
              </div>
              <span className={`text-xs font-medium hidden sm:block ${step >= s.num ? 'text-foreground' : 'text-muted-foreground'}`}>
                {s.label}
              </span>
            </div>
            {index < 2 && (
              <div className={`w-12 md:w-16 h-0.5 mb-6 ${step > s.num ? 'bg-blue-500' : 'bg-muted'}`}></div>
            )}
          </React.Fragment>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        {step === 1 && (
          <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6 md:p-8 space-y-6 animate-fade-in">
            <div className="space-y-1">
              <h3 className="text-xl font-semibold">{t('register.student.step1.title')}</h3>
              <p className="text-sm text-muted-foreground">{t('register.student.step1.description')}</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t('register.student.fields.studentName')} *</Label>
                <Input
                  value={formData.student_name}
                  onChange={(e) => setFormData((f) => ({ ...f, student_name: e.target.value }))}
                  placeholder={t('register.student.placeholders.studentName')}
                  className="h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t('register.student.fields.parentName')} *</Label>
                  <Input
                    value={formData.parent_name}
                    onChange={(e) => setFormData((f) => ({ ...f, parent_name: e.target.value }))}
                    placeholder={t('register.student.placeholders.parentName')}
                    className="h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t('register.student.fields.nationalId')}</Label>
                  <Input
                    value={formData.national_id}
                    onChange={(e) => setFormData((f) => ({ ...f, national_id: e.target.value }))}
                    placeholder={t('register.student.placeholders.nationalId')}
                    className="h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t('register.student.fields.fatherPhone')} *</Label>
                  <Input
                    value={formData.father_phone}
                    onChange={(e) => setFormData((f) => ({ ...f, father_phone: e.target.value }))}
                    placeholder="01xxxxxxxxx"
                    className="h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t('register.student.fields.motherPhone')} *</Label>
                  <Input
                    value={formData.mother_phone}
                    onChange={(e) => setFormData((f) => ({ ...f, mother_phone: e.target.value }))}
                    placeholder="01xxxxxxxxx"
                    className="h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t('register.student.fields.emergencyPhone')} *</Label>
                  <Input
                    value={formData.emergency_phone}
                    onChange={(e) => setFormData((f) => ({ ...f, emergency_phone: e.target.value }))}
                    placeholder="01xxxxxxxxx"
                    className="h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">رقم الدفع والتجديد *</Label>
                  <Input
                    value={formData.payment_phone}
                    onChange={(e) => setFormData((f) => ({ ...f, payment_phone: e.target.value }))}
                    placeholder="01xxxxxxxxx"
                    className="h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t('register.student.fields.occupation')}</Label>
                  <Input
                    value={formData.job}
                    onChange={(e) => setFormData((f) => ({ ...f, job: e.target.value }))}
                    placeholder={t('register.student.placeholders.occupation')}
                    className="h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-sm font-medium">{t('register.student.fields.city')} *</Label>
                  <Select
                    value={formData.city}
                    onValueChange={(v) => setFormData((f) => ({ ...f, city: v, school_id: '' }))}
                  >
                    <SelectTrigger className="h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors">
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
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-sm font-medium">ملاحظات</Label>
                  <textarea
                    value={formData.comments}
                    onChange={(e) => setFormData((f) => ({ ...f, comments: e.target.value }))}
                    placeholder="أضف أي ملاحظات أو تعليقات..."
                    rows={3}
                    className="w-full rounded-md bg-muted/50 border border-border/50 focus:bg-background transition-colors p-3 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button type="button" onClick={() => {
                if (!formData.student_name.trim()) {
                  toast({ title: t('register.student.validation.studentName'), variant: 'destructive' });
                  return;
                }
                if (!formData.parent_name.trim()) {
                  toast({ title: t('register.student.validation.parentName'), variant: 'destructive' });
                  return;
                }
                if (!formData.father_phone.trim()) {
                  toast({ title: t('register.student.validation.fatherPhone'), variant: 'destructive' });
                  return;
                }
                if (!formData.mother_phone.trim()) {
                  toast({ title: t('register.student.validation.motherPhone') || 'رقم هاتف الأم مطلوب', variant: 'destructive' });
                  return;
                }
                if (!formData.emergency_phone.trim()) {
                  toast({ title: t('register.student.validation.emergencyPhone'), variant: 'destructive' });
                  return;
                }
                if (!formData.payment_phone.trim()) {
                  toast({ title: 'رقم الدفع والتجديد مطلوب', variant: 'destructive' });
                  return;
                }
                if (!formData.city) {
                  toast({ title: t('register.student.validation.city'), variant: 'destructive' });
                  return;
                }
                setStep(2);
              }} size="lg" className="px-8">
                {t('register.common.next')}
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6 md:p-8 space-y-6 animate-fade-in">
            <div className="space-y-1">
              <h3 className="text-xl font-semibold">{t('register.student.step2.title')}</h3>
              <p className="text-sm text-muted-foreground">{t('register.student.step2.description')}</p>
            </div>

            <GoogleMapsProvider>
              <LocationPickerMap
                initialLat={formData.pickup_latitude}
                initialLng={formData.pickup_longitude}
                onLocationChange={(lat, lng) =>
                  setFormData((f) => ({ ...f, pickup_latitude: lat, pickup_longitude: lng }))
                }
              />
            </GoogleMapsProvider>

            <div className="flex gap-4 justify-center text-sm text-muted-foreground bg-muted/50 rounded-xl p-3">
              <span>{t('register.common.latitude')}: <span className="font-medium text-foreground">{formData.pickup_latitude.toFixed(6)}</span></span>
              <span>{t('register.common.longitude')}: <span className="font-medium text-foreground">{formData.pickup_longitude.toFixed(6)}</span></span>
            </div>

            <div className="flex justify-between pt-4">
              <Button type="button" variant="outline" onClick={() => setStep(1)} size="lg" className="px-8">
                {t('register.common.previous')}
              </Button>
              <Button type="button" onClick={() => setStep(3)} size="lg" className="px-8">
                {t('register.common.next')}
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6 md:p-8 space-y-6 animate-fade-in">
            <div className="space-y-1">
              <h3 className="text-xl font-semibold">{t('register.student.step3.title')}</h3>
              <p className="text-sm text-muted-foreground">{t('register.student.step3.description')}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t('register.student.fields.school')} *</Label>
                <Select
                  value={formData.school_id}
                  onValueChange={(v) => setFormData((f) => ({ ...f, school_id: v }))}
                >
                  <SelectTrigger className="h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors">
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
                <Label className="text-sm font-medium">{t('register.student.fields.grade')} *</Label>
                <Select
                  value={formData.grade}
                  onValueChange={(v) => setFormData((f) => ({ ...f, grade: v }))}
                >
                  <SelectTrigger className="h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors">
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
                <Label className="text-sm font-medium">{t('register.student.fields.educationDepartment')} *</Label>
                <Select
                  value={formData.education_department}
                  onValueChange={(v) => setFormData((f) => ({ ...f, education_department: v as Enums<'education_department'> }))}
                >
                  <SelectTrigger className="h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors">
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
                <Label className="text-sm font-medium">{t('register.student.fields.carType')} *</Label>
                <Select
                  value={formData.car_type}
                  onValueChange={(v) => setFormData((f) => ({ ...f, car_type: v as Enums<'car_type'> }))}
                >
                  <SelectTrigger className="h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors">
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
              <Button type="button" variant="outline" onClick={() => setStep(2)} size="lg" className="px-8">
                {t('register.common.previous')}
              </Button>
              <Button type="submit" disabled={submitMutation.isPending} size="lg" className="px-8">
                {submitMutation.isPending ? t('register.common.submitting') : t('register.common.submit')}
              </Button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default StudentRegistrationForm;
