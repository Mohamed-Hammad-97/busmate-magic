import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import seaterLogo from '@/assets/seater-logo.jpg';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';

interface PrivateFormData {
  full_name: string;
  phone: string;
  email: string;
  city: string;
  pickup_latitude: number;
  pickup_longitude: number;
  destination: string;
  frequency: string;
  passengers_count: string;
  notes: string;
}

const RegisterPrivate: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState(1);

  const [formData, setFormData] = useState<PrivateFormData>({
    full_name: '',
    phone: '',
    email: '',
    city: '',
    pickup_latitude: 30.0444,
    pickup_longitude: 31.2357,
    destination: '',
    frequency: '',
    passengers_count: '',
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
      const { error } = await supabase
        .from('contact_submissions')
        .insert({
          name: formData.full_name,
          email: formData.email,
          subject: `Private Transportation Request`,
          message: `
Full Name: ${formData.full_name}
Phone: ${formData.phone}
Email: ${formData.email}
City: ${formData.city}
Destination: ${formData.destination}
Frequency: ${formData.frequency}
Number of Passengers: ${formData.passengers_count}
Pickup Location: ${formData.pickup_latitude}, ${formData.pickup_longitude}
Notes: ${formData.notes || 'N/A'}
          `.trim(),
        });

      if (error) throw error;
    },
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (error: Error) => {
      toast({ title: t('register.error'), description: error.message, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.full_name.trim()) {
      toast({ title: t('register.private.validation.fullName'), variant: 'destructive' });
      return;
    }
    if (!formData.phone.trim()) {
      toast({ title: t('register.private.validation.phone'), variant: 'destructive' });
      return;
    }
    if (!formData.email.trim()) {
      toast({ title: t('register.private.validation.email'), variant: 'destructive' });
      return;
    }
    if (!formData.city) {
      toast({ title: t('register.private.validation.city'), variant: 'destructive' });
      return;
    }
    if (!formData.destination.trim()) {
      toast({ title: t('register.private.validation.destination'), variant: 'destructive' });
      return;
    }
    if (!formData.frequency) {
      toast({ title: t('register.private.validation.frequency'), variant: 'destructive' });
      return;
    }

    submitMutation.mutate();
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background py-8 px-4">
        <div className="absolute top-4 right-4">
          <LanguageSwitcher />
        </div>
        <div className="max-w-md mx-auto mt-20">
          <Card className="text-center">
            <CardContent className="pt-8 pb-8 space-y-4">
              <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
              <h2 className="text-2xl font-bold">{t('register.private.success.title')}</h2>
              <p className="text-muted-foreground">
                {t('register.private.success.message')}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('register.private.success.nameLabel')}: {formData.full_name}
              </p>
              <Button onClick={() => navigate('/')} className="mt-4">
                {t('register.private.success.backHome')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background py-8 px-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/register')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            {t('register.backToChoice')}
          </Button>
        </div>
        <div className="text-center mb-8">
          <div className="flex flex-col items-center mb-4">
            <img src={seaterLogo} alt="Seater" className="h-20 w-auto mb-2" />
          </div>
          <h1 className="text-3xl font-bold">{t('register.types.private.title')}</h1>
          <p className="text-muted-foreground mt-2">{t('register.types.private.description')}</p>
        </div>

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
                <CardTitle>{t('register.private.step1.title')}</CardTitle>
                <CardDescription>{t('register.private.step1.description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('register.private.fields.fullName')} *</Label>
                  <Input
                    value={formData.full_name}
                    onChange={(e) => setFormData((f) => ({ ...f, full_name: e.target.value }))}
                    placeholder={t('register.private.placeholders.fullName')}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t('register.private.fields.phone')} *</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="01xxxxxxxxx"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('register.private.fields.email')} *</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
                      placeholder={t('register.private.placeholders.email')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('register.private.fields.city')} *</Label>
                    <Select
                      value={formData.city}
                      onValueChange={(v) => setFormData((f) => ({ ...f, city: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('register.private.placeholders.city')} />
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
                    <Label>{t('register.private.fields.destination')} *</Label>
                    <Input
                      value={formData.destination}
                      onChange={(e) => setFormData((f) => ({ ...f, destination: e.target.value }))}
                      placeholder={t('register.private.placeholders.destination')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('register.private.fields.frequency')} *</Label>
                    <Select
                      value={formData.frequency}
                      onValueChange={(v) => setFormData((f) => ({ ...f, frequency: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('register.private.placeholders.frequency')} />
                      </SelectTrigger>
                      <SelectContent className="bg-background border border-border z-50">
                        <SelectItem value="daily">{t('register.private.options.daily')}</SelectItem>
                        <SelectItem value="weekly">{t('register.private.options.weekly')}</SelectItem>
                        <SelectItem value="monthly">{t('register.private.options.monthly')}</SelectItem>
                        <SelectItem value="one-time">{t('register.private.options.oneTime')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('register.private.fields.passengersCount')}</Label>
                    <Select
                      value={formData.passengers_count}
                      onValueChange={(v) => setFormData((f) => ({ ...f, passengers_count: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('register.private.placeholders.passengersCount')} />
                      </SelectTrigger>
                      <SelectContent className="bg-background border border-border z-50">
                        <SelectItem value="1">1</SelectItem>
                        <SelectItem value="2">2</SelectItem>
                        <SelectItem value="3-5">3-5</SelectItem>
                        <SelectItem value="6-10">6-10</SelectItem>
                        <SelectItem value="10+">10+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('register.private.fields.notes')}</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
                    placeholder={t('register.private.placeholders.notes')}
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
                <CardTitle>{t('register.private.step2.title')}</CardTitle>
                <CardDescription>{t('register.private.step2.description')}</CardDescription>
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
    </div>
  );
};

export default RegisterPrivate;
