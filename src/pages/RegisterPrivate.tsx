import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CheckCircle2, User, MapPin, FileText } from 'lucide-react';
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
import seaterLogo from '@/assets/seater-logo.jpg';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import PageSeo from '@/components/seo/PageSeo';

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
      <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-background to-purple-500/5"></div>
        <div className="absolute top-20 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
        
        <div className="relative max-w-md mx-auto px-4">
          <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-8 text-center space-y-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/10 text-green-500 mb-4">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h2 className="text-2xl font-bold">{t('register.private.success.title')}</h2>
            <p className="text-muted-foreground">
              {t('register.private.success.message')}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('register.private.success.nameLabel')}: <span className="font-medium text-foreground">{formData.full_name}</span>
            </p>
            <Button onClick={() => navigate('/')} className="w-full" size="lg">
              {t('register.private.success.backHome')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background Decorations */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-background to-purple-500/5"></div>
      <div className="absolute top-20 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>

      {/* Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <img src={seaterLogo} alt="Seater" className="h-10 w-auto rounded-xl shadow-md" />
            <span className="text-xl font-bold">Seater</span>
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <button
              onClick={() => navigate('/register')}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
              {t('register.backToChoice')}
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="relative pt-28 pb-20 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Header Section */}
          <div className="text-center mb-10 space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg mb-4">
              <User className="h-8 w-8" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold">{t('register.types.private.title')}</h1>
            <p className="text-muted-foreground max-w-lg mx-auto">{t('register.types.private.description')}</p>
          </div>

          {/* Steps Indicator */}
          <div className="flex justify-center items-center gap-4 mb-10">
            {[
              { num: 1, icon: FileText, label: t('register.private.step1.title') },
              { num: 2, icon: MapPin, label: t('register.private.step2.title') },
            ].map((s, index) => (
              <React.Fragment key={s.num}>
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center font-bold transition-all duration-300 ${
                      step >= s.num 
                        ? 'bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg' 
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
                  <div className={`w-16 h-0.5 mb-6 ${step > s.num ? 'bg-purple-500' : 'bg-muted'}`}></div>
                )}
              </React.Fragment>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {step === 1 && (
              <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6 md:p-8 space-y-6 animate-fade-in">
                <div className="space-y-1">
                  <h3 className="text-xl font-semibold">{t('register.private.step1.title')}</h3>
                  <p className="text-sm text-muted-foreground">{t('register.private.step1.description')}</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t('register.private.fields.fullName')} *</Label>
                    <Input
                      value={formData.full_name}
                      onChange={(e) => setFormData((f) => ({ ...f, full_name: e.target.value }))}
                      placeholder={t('register.private.placeholders.fullName')}
                      className="h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">{t('register.private.fields.phone')} *</Label>
                      <Input
                        value={formData.phone}
                        onChange={(e) => setFormData((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="01xxxxxxxxx"
                        className="h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">{t('register.private.fields.email')} *</Label>
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
                        placeholder={t('register.private.placeholders.email')}
                        className="h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">{t('register.private.fields.city')} *</Label>
                      <Select
                        value={formData.city}
                        onValueChange={(v) => setFormData((f) => ({ ...f, city: v }))}
                      >
                        <SelectTrigger className="h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors">
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
                      <Label className="text-sm font-medium">{t('register.private.fields.destination')} *</Label>
                      <Input
                        value={formData.destination}
                        onChange={(e) => setFormData((f) => ({ ...f, destination: e.target.value }))}
                        placeholder={t('register.private.placeholders.destination')}
                        className="h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">{t('register.private.fields.frequency')} *</Label>
                      <Select
                        value={formData.frequency}
                        onValueChange={(v) => setFormData((f) => ({ ...f, frequency: v }))}
                      >
                        <SelectTrigger className="h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors">
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
                      <Label className="text-sm font-medium">{t('register.private.fields.passengersCount')}</Label>
                      <Select
                        value={formData.passengers_count}
                        onValueChange={(v) => setFormData((f) => ({ ...f, passengers_count: v }))}
                      >
                        <SelectTrigger className="h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors">
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
                    <Label className="text-sm font-medium">{t('register.private.fields.notes')}</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
                      placeholder={t('register.private.placeholders.notes')}
                      rows={3}
                      className="bg-muted/50 border-border/50 focus:bg-background transition-colors"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button type="button" onClick={() => {
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
                  <h3 className="text-xl font-semibold">{t('register.private.step2.title')}</h3>
                  <p className="text-sm text-muted-foreground">{t('register.private.step2.description')}</p>
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
                  <Button type="submit" disabled={submitMutation.isPending} size="lg" className="px-8">
                    {submitMutation.isPending ? t('register.common.submitting') : t('register.common.submit')}
                  </Button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default RegisterPrivate;
