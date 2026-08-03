import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { CheckCircle2, Building2, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

interface CorporateFormData {
  company_name: string;
  contact_person: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  employees_count: string;
  pickup_latitude: number;
  pickup_longitude: number;
  notes: string;
}

const CorporateRegistrationForm: React.FC = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState(1);

  const [formData, setFormData] = useState<CorporateFormData>({
    company_name: '',
    contact_person: '',
    email: '',
    phone: '',
    city: '',
    address: '',
    employees_count: '',
    pickup_latitude: 30.0444,
    pickup_longitude: 31.2357,
    notes: '',
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
      // Submit as a contact submission for now
      const { error } = await supabase
        .from('contact_submissions')
        .insert({
          name: formData.contact_person,
          email: formData.email,
          subject: `Corporate Registration: ${formData.company_name}`,
          message: `
Company Name: ${formData.company_name}
Contact Person: ${formData.contact_person}
Phone: ${formData.phone}
City: ${formData.city}
Address: ${formData.address}
Number of Employees: ${formData.employees_count}
Pickup Location: ${formData.pickup_latitude}, ${formData.pickup_longitude}
Notes: ${formData.notes || 'N/A'}
          `.trim(),
        });

      if (error) throw error;
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

    if (!formData.company_name.trim()) {
      toast({ title: t('register.corporate.validation.companyName'), variant: 'destructive' });
      return;
    }
    if (!formData.contact_person.trim()) {
      toast({ title: t('register.corporate.validation.contactPerson'), variant: 'destructive' });
      return;
    }
    if (!formData.email.trim()) {
      toast({ title: t('register.corporate.validation.email'), variant: 'destructive' });
      return;
    }
    if (!formData.phone.trim()) {
      toast({ title: t('register.corporate.validation.phone'), variant: 'destructive' });
      return;
    }
    if (!formData.city) {
      toast({ title: t('register.corporate.validation.city'), variant: 'destructive' });
      return;
    }
    if (!formData.employees_count) {
      toast({ title: t('register.corporate.validation.employeesCount'), variant: 'destructive' });
      return;
    }

    submitMutation.mutate();
  };

  if (submitted) {
    return (
      <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-8 text-center space-y-6 max-w-md mx-auto animate-fade-in">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/10 text-green-500 mb-4">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <h2 className="text-2xl font-bold">{t('register.corporate.success.title')}</h2>
        <p className="text-muted-foreground">
          {t('register.corporate.success.message')}
        </p>
        <p className="text-sm text-muted-foreground">
          {t('register.corporate.success.companyLabel')}: <span className="font-medium text-foreground">{formData.company_name}</span>
        </p>
        <Button onClick={() => navigate('/')} className="w-full" size="lg">
          {t('register.private.success.backHome') || 'Back to Home'}
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* Steps Indicator */}
      <div className="flex justify-center items-center gap-4 mb-10">
        {[
          { num: 1, icon: Building2, label: t('register.corporate.step1.title') },
          { num: 2, icon: MapPin, label: t('register.corporate.step2.title') },
        ].map((s, index) => (
          <React.Fragment key={s.num}>
            <div className="flex flex-col items-center gap-2">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center font-bold transition-all duration-300 ${
                  step >= s.num 
                    ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg' 
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                <s.icon className="h-5 w-5" />
              </div>
              <span className={`text-xs font-medium ${step >= s.num ? 'text-foreground' : 'text-muted-foreground'}`}>
                {s.label}
              </span>
            </div>
            {index < 1 && (
              <div className={`w-16 h-0.5 mb-6 ${step > s.num ? 'bg-emerald-500' : 'bg-muted'}`}></div>
            )}
          </React.Fragment>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        {step === 1 && (
          <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6 md:p-8 space-y-6 animate-fade-in">
            <div className="space-y-1">
              <h3 className="text-xl font-semibold">{t('register.corporate.step1.title')}</h3>
              <p className="text-sm text-muted-foreground">{t('register.corporate.step1.description')}</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t('register.corporate.fields.companyName')} *</Label>
                <Input
                  value={formData.company_name}
                  onChange={(e) => setFormData((f) => ({ ...f, company_name: e.target.value }))}
                  placeholder={t('register.corporate.placeholders.companyName')}
                  className="h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t('register.corporate.fields.contactPerson')} *</Label>
                  <Input
                    value={formData.contact_person}
                    onChange={(e) => setFormData((f) => ({ ...f, contact_person: e.target.value }))}
                    placeholder={t('register.corporate.placeholders.contactPerson')}
                    className="h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t('register.corporate.fields.email')} *</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
                    placeholder={t('register.corporate.placeholders.email')}
                    className="h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t('register.corporate.fields.phone')} *</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="01xxxxxxxxx"
                    className="h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t('register.corporate.fields.employeesCount')} *</Label>
                  <Select
                    value={formData.employees_count}
                    onValueChange={(v) => setFormData((f) => ({ ...f, employees_count: v }))}
                  >
                    <SelectTrigger className="h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors">
                      <SelectValue placeholder={t('register.corporate.placeholders.employeesCount')} />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border z-50">
                      <SelectItem value="1-10">{t('register.corporate.options.employees1to10')}</SelectItem>
                      <SelectItem value="11-50">{t('register.corporate.options.employees11to50')}</SelectItem>
                      <SelectItem value="51-100">{t('register.corporate.options.employees51to100')}</SelectItem>
                      <SelectItem value="101-500">{t('register.corporate.options.employees101to500')}</SelectItem>
                      <SelectItem value="500+">{t('register.corporate.options.employees500plus')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t('register.corporate.fields.city')} *</Label>
                  <Select
                    value={formData.city}
                    onValueChange={(v) => setFormData((f) => ({ ...f, city: v }))}
                  >
                    <SelectTrigger className="h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors">
                      <SelectValue placeholder={t('register.corporate.placeholders.city')} />
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
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t('register.corporate.fields.address')}</Label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData((f) => ({ ...f, address: e.target.value }))}
                    placeholder={t('register.corporate.placeholders.address')}
                    className="h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">{t('register.corporate.fields.notes')}</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
                  placeholder={t('register.corporate.placeholders.notes')}
                  rows={3}
                  className="bg-muted/50 border-border/50 focus:bg-background transition-colors"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button type="button" onClick={() => {
                if (!formData.company_name.trim()) {
                  toast({ title: t('register.corporate.validation.companyName'), variant: 'destructive' });
                  return;
                }
                if (!formData.contact_person.trim()) {
                  toast({ title: t('register.corporate.validation.contactPerson'), variant: 'destructive' });
                  return;
                }
                if (!formData.email.trim()) {
                  toast({ title: t('register.corporate.validation.email'), variant: 'destructive' });
                  return;
                }
                if (!formData.phone.trim()) {
                  toast({ title: t('register.corporate.validation.phone'), variant: 'destructive' });
                  return;
                }
                if (!formData.city) {
                  toast({ title: t('register.corporate.validation.city'), variant: 'destructive' });
                  return;
                }
                if (!formData.employees_count) {
                  toast({ title: t('register.corporate.validation.employeesCount'), variant: 'destructive' });
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
              <h3 className="text-xl font-semibold">{t('register.corporate.step2.title')}</h3>
              <p className="text-sm text-muted-foreground">{t('register.corporate.step2.description')}</p>
            </div>

            <GoogleMapsProvider>
              <LocationPickerMap
                initialLat={formData.pickup_latitude}
                initialLng={formData.pickup_longitude}
                onLocationChange={(lat, lng) =>
                  setFormData((f) => ({ ...f, pickup_latitude: lat, pickup_longitude: lng }))
                }
                helperText="انقر على الخريطة أو اسحب العلامة لتحديد موقع البيت"
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

export default CorporateRegistrationForm;
