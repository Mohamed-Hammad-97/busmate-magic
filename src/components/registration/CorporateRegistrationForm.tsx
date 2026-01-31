import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
      <Card className="max-w-md w-full text-center mx-auto">
        <CardContent className="pt-8 pb-8 space-y-4">
          <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
          <h2 className="text-2xl font-bold">{t('register.corporate.success.title')}</h2>
          <p className="text-muted-foreground">
            {t('register.corporate.success.message')}
          </p>
          <p className="text-sm text-muted-foreground">
            {t('register.corporate.success.companyLabel')}: {formData.company_name}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      {/* Steps */}
      <div className="flex justify-center gap-4 mb-8">
        {[1, 2].map((s) => (
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
              <CardTitle>{t('register.corporate.step1.title')}</CardTitle>
              <CardDescription>{t('register.corporate.step1.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t('register.corporate.fields.companyName')} *</Label>
                <Input
                  value={formData.company_name}
                  onChange={(e) => setFormData((f) => ({ ...f, company_name: e.target.value }))}
                  placeholder={t('register.corporate.placeholders.companyName')}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t('register.corporate.fields.contactPerson')} *</Label>
                  <Input
                    value={formData.contact_person}
                    onChange={(e) => setFormData((f) => ({ ...f, contact_person: e.target.value }))}
                    placeholder={t('register.corporate.placeholders.contactPerson')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('register.corporate.fields.email')} *</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
                    placeholder={t('register.corporate.placeholders.email')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('register.corporate.fields.phone')} *</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="01xxxxxxxxx"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('register.corporate.fields.employeesCount')} *</Label>
                  <Select
                    value={formData.employees_count}
                    onValueChange={(v) => setFormData((f) => ({ ...f, employees_count: v }))}
                  >
                    <SelectTrigger>
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
                  <Label>{t('register.corporate.fields.city')} *</Label>
                  <Select
                    value={formData.city}
                    onValueChange={(v) => setFormData((f) => ({ ...f, city: v }))}
                  >
                    <SelectTrigger>
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
                  <Label>{t('register.corporate.fields.address')}</Label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData((f) => ({ ...f, address: e.target.value }))}
                    placeholder={t('register.corporate.placeholders.address')}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('register.corporate.fields.notes')}</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
                  placeholder={t('register.corporate.placeholders.notes')}
                  rows={3}
                />
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
              <CardTitle>{t('register.corporate.step2.title')}</CardTitle>
              <CardDescription>{t('register.corporate.step2.description')}</CardDescription>
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

export default CorporateRegistrationForm;
