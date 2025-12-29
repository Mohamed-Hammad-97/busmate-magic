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
import { Bus, CheckCircle2, GraduationCap } from 'lucide-react';
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

const Register: React.FC = () => {
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
      // Use secure edge function for registration
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
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.student_name.trim()) {
      toast({ title: 'Please enter student name / يرجى إدخال اسم الطالب', variant: 'destructive' });
      return;
    }
    if (!formData.parent_name.trim()) {
      toast({ title: 'Please enter parent name / يرجى إدخال اسم ولي الأمر', variant: 'destructive' });
      return;
    }
    if (!formData.national_id.trim()) {
      toast({ title: 'Please enter national ID / يرجى إدخال الرقم القومي', variant: 'destructive' });
      return;
    }
    if (!formData.father_phone.trim()) {
      toast({ title: 'Please enter father phone / يرجى إدخال رقم الأب', variant: 'destructive' });
      return;
    }
    if (!formData.emergency_phone.trim()) {
      toast({ title: 'Please enter emergency phone / يرجى إدخال رقم الطوارئ', variant: 'destructive' });
      return;
    }
    if (!formData.city) {
      toast({ title: 'Please select city / يرجى اختيار المدينة', variant: 'destructive' });
      return;
    }
    if (!formData.school_id) {
      toast({ title: 'Please select school / يرجى اختيار المدرسة', variant: 'destructive' });
      return;
    }
    if (!formData.grade) {
      toast({ title: 'Please select grade / يرجى اختيار الصف', variant: 'destructive' });
      return;
    }

    submitMutation.mutate();
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
            <h2 className="text-2xl font-bold">Registration Received! / تم استلام طلب التسجيل!</h2>
            <p className="text-muted-foreground">
              Thank you for submitting your registration. Our team will contact you soon to complete the registration and payment process.
            </p>
            <p className="text-muted-foreground">
              شكراً لتقديم طلب التسجيل. سيتواصل معكم فريقنا قريباً لاستكمال إجراءات التسجيل والدفع.
            </p>
            <p className="text-sm text-muted-foreground">
              Student / الطالب: {formData.student_name}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex flex-col items-center mb-4">
            <img src="/src/assets/seater-logo.jpg" alt="Seater" className="h-20 w-auto mb-2" />
            <span className="text-lg font-semibold text-muted-foreground">Student Registration</span>
          </div>
          <h1 className="text-3xl font-bold">تسجيل طالب جديد</h1>
          <p className="text-muted-foreground mt-2">استمارة التسجيل في خدمة النقل المدرسي</p>
        </div>

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
                <CardTitle>Student & Parent Information / معلومات الطالب وولي الأمر</CardTitle>
                <CardDescription>Enter basic information / أدخل البيانات الأساسية</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Student Name / اسم الطالب *</Label>
                  <Input
                    value={formData.student_name}
                    onChange={(e) => setFormData((f) => ({ ...f, student_name: e.target.value }))}
                    placeholder="Full student name / الاسم الرباعي للطالب"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Parent Name / اسم ولي الأمر *</Label>
                    <Input
                      value={formData.parent_name}
                      onChange={(e) => setFormData((f) => ({ ...f, parent_name: e.target.value }))}
                      placeholder="Full name / الاسم الكامل"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>National ID / الرقم القومي *</Label>
                    <Input
                      value={formData.national_id}
                      onChange={(e) => setFormData((f) => ({ ...f, national_id: e.target.value }))}
                      placeholder="14 digits / 14 رقم"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Father Phone / رقم الأب *</Label>
                    <Input
                      value={formData.father_phone}
                      onChange={(e) => setFormData((f) => ({ ...f, father_phone: e.target.value }))}
                      placeholder="01xxxxxxxxx"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Mother Phone / رقم الأم</Label>
                    <Input
                      value={formData.mother_phone}
                      onChange={(e) => setFormData((f) => ({ ...f, mother_phone: e.target.value }))}
                      placeholder="01xxxxxxxxx"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Emergency Phone / رقم الطوارئ *</Label>
                    <Input
                      value={formData.emergency_phone}
                      onChange={(e) => setFormData((f) => ({ ...f, emergency_phone: e.target.value }))}
                      placeholder="01xxxxxxxxx"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Occupation / الوظيفة</Label>
                    <Input
                      value={formData.job}
                      onChange={(e) => setFormData((f) => ({ ...f, job: e.target.value }))}
                      placeholder="Job title / الوظيفة"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>City / المدينة *</Label>
                    <Select
                      value={formData.city}
                      onValueChange={(v) => setFormData((f) => ({ ...f, city: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select city / اختر المدينة" />
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
                    Next / التالي
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>Pickup Location / موقع الاستلام</CardTitle>
                <CardDescription>Select the student pickup location on the map / حدد موقع استلام الطالب على الخريطة</CardDescription>
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
                  <span>Latitude / خط العرض: {formData.pickup_latitude.toFixed(6)}</span>
                  <span>Longitude / خط الطول: {formData.pickup_longitude.toFixed(6)}</span>
                </div>
                <div className="flex justify-between pt-4">
                  <Button type="button" variant="outline" onClick={() => setStep(1)}>
                    Previous / السابق
                  </Button>
                  <Button type="button" onClick={() => setStep(3)}>
                    Next / التالي
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle>Registration Details / معلومات التسجيل</CardTitle>
                <CardDescription>Select school, grade, and car type / اختر المدرسة والصف ونوع السيارة</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>School / المدرسة *</Label>
                    <Select
                      value={formData.school_id}
                      onValueChange={(v) => setFormData((f) => ({ ...f, school_id: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select school / اختر المدرسة" />
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
                    <Label>Grade / الصف *</Label>
                    <Select
                      value={formData.grade}
                      onValueChange={(v) => setFormData((f) => ({ ...f, grade: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select grade / اختر الصف" />
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
                    <Label>Education Department / قسم التعليم *</Label>
                    <Select
                      value={formData.education_department}
                      onValueChange={(v) => setFormData((f) => ({ ...f, education_department: v as Enums<'education_department'> }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background border border-border z-50">
                        <SelectItem value="national">National / وطني</SelectItem>
                        <SelectItem value="ig">IG</SelectItem>
                        <SelectItem value="american">American / أمريكي</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Car Type / نوع السيارة *</Label>
                    <Select
                      value={formData.car_type}
                      onValueChange={(v) => setFormData((f) => ({ ...f, car_type: v as Enums<'car_type'> }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background border border-border z-50">
                        <SelectItem value="ac">AC / مكيف</SelectItem>
                        <SelectItem value="non_ac">Non-AC / بدون تكييف</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-between pt-4">
                  <Button type="button" variant="outline" onClick={() => setStep(2)}>
                    Previous / السابق
                  </Button>
                  <Button type="submit" disabled={submitMutation.isPending}>
                    {submitMutation.isPending ? 'Submitting... / جاري الإرسال...' : 'Submit / إرسال الطلب'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </form>
      </div>
    </div>
  );
};

export default Register;
