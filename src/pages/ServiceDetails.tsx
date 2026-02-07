import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, GraduationCap, Building2, User, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import seaterLogo from '@/assets/seater-logo.jpg';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';

// Import app screen images
import privateScreen1 from '@/assets/private-screen-1.png';
import privateScreen2 from '@/assets/private-screen-2.png';
import schoolScreen1 from '@/assets/school-screen-1.png';
import schoolScreen2 from '@/assets/school-screen-2.png';
import schoolScreen3 from '@/assets/school-screen-3.png';
import corporateScreen1 from '@/assets/corporate-screen-1.png';
import corporateScreen2 from '@/assets/corporate-screen-2.png';
import corporateScreen3 from '@/assets/corporate-screen-3.png';

const ServiceDetails: React.FC = () => {
  const { serviceType } = useParams<{ serviceType: string }>();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isRtl = i18n.language === 'ar';

  const { data: settings } = useQuery({
    queryKey: ['homepage-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('homepage_settings')
        .select('key, value');
      if (error) throw error;
      return data?.reduce((acc, item) => {
        acc[item.key] = item.value;
        return acc;
      }, {} as Record<string, string | null>) || {};
    },
  });

  const serviceConfig: Record<string, { 
    icon: typeof GraduationCap; 
    titleKey: string; 
    descriptionKey: string;
    imageKey: string;
    nameEnKey: string;
    nameArKey: string;
    descriptionEnKey: string;
    descriptionArKey: string;
    registerPath: string;
    features: string[];
    gradient: string;
  }> = {
    student: {
      icon: GraduationCap,
      titleKey: 'register.types.student.title',
      descriptionKey: 'register.types.student.description',
      imageKey: 'service_student_image',
      nameEnKey: 'service_student_name_en',
      nameArKey: 'service_student_name_ar',
      descriptionEnKey: 'service_student_description_en',
      descriptionArKey: 'service_student_description_ar',
      registerPath: '/register/student',
      features: ['Safe & Reliable', 'GPS Tracking', 'Professional Drivers', 'Door-to-door Service'],
      gradient: 'from-blue-500 to-blue-600',
    },
    corporate: {
      icon: Building2,
      titleKey: 'register.types.corporate.title',
      descriptionKey: 'register.types.corporate.description',
      imageKey: 'service_corporate_image',
      nameEnKey: 'service_corporate_name_en',
      nameArKey: 'service_corporate_name_ar',
      descriptionEnKey: 'service_corporate_description_en',
      descriptionArKey: 'service_corporate_description_ar',
      registerPath: '/register/corporate',
      features: ['Fleet Management', 'Cost Optimization', 'Employee Tracking', 'Flexible Scheduling'],
      gradient: 'from-emerald-500 to-emerald-600',
    },
    private: {
      icon: User,
      titleKey: 'register.types.private.title',
      descriptionKey: 'register.types.private.description',
      imageKey: 'service_private_image',
      nameEnKey: 'service_private_name_en',
      nameArKey: 'service_private_name_ar',
      descriptionEnKey: 'service_private_description_en',
      descriptionArKey: 'service_private_description_ar',
      registerPath: '/register/private',
      features: ['Personal Service', 'Flexible Routes', 'Premium Vehicles', '24/7 Support'],
      gradient: 'from-purple-500 to-purple-600',
    },
  };

  const config = serviceType ? serviceConfig[serviceType] : null;

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Service not found</p>
      </div>
    );
  }

  const Icon = config.icon;
  const customImage = settings?.[config.imageKey];
  const nameEn = settings?.[config.nameEnKey];
  const nameAr = settings?.[config.nameArKey];
  const serviceName = isRtl && nameAr ? nameAr : (nameEn || t(config.titleKey));
  const descriptionEn = settings?.[config.descriptionEnKey];
  const descriptionAr = settings?.[config.descriptionArKey];
  const description = isRtl && descriptionAr ? descriptionAr : descriptionEn || t(config.descriptionKey);

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <img src={seaterLogo} alt="Seater" className="h-10 w-auto rounded-xl shadow-md" />
            <span className="text-xl font-bold">Seater</span>
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
              {t('register.backToChoice')}
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section with App Showcase */}
      <section className="pt-24 pb-16 px-4 relative overflow-hidden">
        {/* Background Decorations */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/5"></div>
        <div className="absolute top-20 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl"></div>
        
        <div className="container mx-auto relative">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center min-h-[calc(100vh-8rem)]">
            {/* Left Content */}
            <div className="space-y-8 order-2 lg:order-1">
              {/* Service Badge */}
              <div className={`inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-gradient-to-r ${config.gradient} text-white shadow-lg`}>
                <Icon className="h-5 w-5" />
                <span className="font-medium">{serviceName}</span>
              </div>

              {/* Title */}
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                {serviceName}
              </h1>

              {/* Description */}
              <p className="text-lg text-muted-foreground leading-relaxed max-w-xl whitespace-pre-wrap">
                {description}
              </p>

              {/* Features List */}
              <div className="grid grid-cols-2 gap-4 pt-4">
                {config.features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm font-medium text-foreground">{feature}</span>
                  </div>
                ))}
              </div>

              {/* CTA Button */}
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button asChild size="lg" className="gap-2 px-8 shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 transition-all duration-300">
                  <Link to={config.registerPath}>
                    {t('homepage.services.getStarted')}
                    <ArrowRight className="h-5 w-5 rtl:rotate-180" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="gap-2 px-8">
                  <Link to="/#contact">
                    {t('homepage.nav.contact')}
                  </Link>
                </Button>
              </div>
            </div>

            {/* Right Side - App Showcase */}
            <div className="relative order-1 lg:order-2 flex items-center justify-center">
              {/* Decorative Glow */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className={`w-80 h-80 bg-gradient-to-br ${config.gradient} opacity-20 rounded-full blur-3xl`}></div>
              </div>

              {/* Images Grid - Different layouts per service type */}
              {serviceType === 'private' ? (
                /* Private Service - 2 images side by side */
                <div className="relative w-full flex items-center justify-center gap-4 md:gap-6 p-4">
                  <div className="transform hover:scale-105 transition-transform duration-500 animate-fade-in">
                    <img 
                      src={privateScreen1} 
                      alt="Private Service - Special Request"
                      className="w-44 md:w-56 lg:w-64 rounded-3xl shadow-2xl"
                    />
                  </div>
                  <div className="transform hover:scale-105 transition-transform duration-500 animate-fade-in" style={{ animationDelay: '0.2s' }}>
                    <img 
                      src={privateScreen2} 
                      alt="Private Service - Booking Form"
                      className="w-44 md:w-56 lg:w-64 rounded-3xl shadow-2xl"
                    />
                  </div>
                </div>
              ) : serviceType === 'student' ? (
                /* Student/School Service - 3 images */
                <div className="relative w-full flex items-center justify-center gap-3 md:gap-5 p-4">
                  <div className="transform hover:scale-105 transition-transform duration-500 animate-fade-in -rotate-3 hover:rotate-0">
                    <img 
                      src={schoolScreen1} 
                      alt="School Bus - Add Booking"
                      className="w-36 md:w-44 lg:w-52 rounded-3xl shadow-2xl"
                    />
                  </div>
                  <div className="transform hover:scale-105 transition-transform duration-500 animate-fade-in z-10" style={{ animationDelay: '0.15s' }}>
                    <img 
                      src={schoolScreen2} 
                      alt="School Bus - Student List"
                      className="w-40 md:w-48 lg:w-56 rounded-3xl shadow-2xl"
                    />
                  </div>
                  <div className="transform hover:scale-105 transition-transform duration-500 animate-fade-in rotate-3 hover:rotate-0" style={{ animationDelay: '0.3s' }}>
                    <img 
                      src={schoolScreen3} 
                      alt="School Bus - Live Tracking"
                      className="w-36 md:w-44 lg:w-52 rounded-3xl shadow-2xl"
                    />
                  </div>
                </div>
              ) : (
                /* Corporate Service - 3 images like school */
                <div className="relative w-full flex items-center justify-center gap-3 md:gap-5 p-4">
                  <div className="transform hover:scale-105 transition-transform duration-500 animate-fade-in -rotate-3 hover:rotate-0">
                    <img 
                      src={corporateScreen1} 
                      alt="Corporate - Services"
                      className="w-36 md:w-44 lg:w-52 rounded-3xl shadow-2xl"
                    />
                  </div>
                  <div className="transform hover:scale-105 transition-transform duration-500 animate-fade-in z-10" style={{ animationDelay: '0.15s' }}>
                    <img 
                      src={corporateScreen2} 
                      alt="Corporate - Live Tracking"
                      className="w-40 md:w-48 lg:w-56 rounded-3xl shadow-2xl"
                    />
                  </div>
                  <div className="transform hover:scale-105 transition-transform duration-500 animate-fade-in rotate-3 hover:rotate-0" style={{ animationDelay: '0.3s' }}>
                    <img 
                      src={corporateScreen3} 
                      alt="Corporate - Work Bus"
                      className="w-36 md:w-44 lg:w-52 rounded-3xl shadow-2xl"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-primary text-primary-foreground py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.15)]">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <div className="hidden sm:block">
            <p className="font-semibold">{t('homepage.services.readyToStart') || 'Ready to get started?'}</p>
            <p className="text-sm text-primary-foreground/80">{t('homepage.services.joinNow') || 'Join thousands of satisfied customers'}</p>
          </div>
          <Button asChild size="lg" variant="secondary" className="gap-2 shadow-lg w-full sm:w-auto">
            <Link to={config.registerPath}>
              {t('homepage.services.getStarted')}
              <ArrowRight className="h-5 w-5 rtl:rotate-180" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ServiceDetails;
