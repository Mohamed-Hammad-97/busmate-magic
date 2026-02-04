import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, GraduationCap, Building2, User, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import seaterLogo from '@/assets/seater-logo.jpg';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';

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

              {/* Phone Mockups Container */}
              <div className="relative w-full max-w-lg aspect-square flex items-center justify-center">
                {/* Main Phone */}
                <div className="relative z-10 w-64 md:w-72 transform hover:scale-105 transition-transform duration-500">
                  <div className="bg-foreground rounded-[2.5rem] p-2 shadow-2xl">
                    <div className="bg-background rounded-[2rem] overflow-hidden aspect-[9/19] relative">
                      {/* Phone Notch */}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-foreground rounded-b-2xl z-20"></div>
                      
                      {/* Phone Content - Corporate specific */}
                      {serviceType === 'corporate' ? (
                        <div className="w-full h-full bg-gradient-to-b from-primary via-primary to-blue-600 p-4 pt-10">
                          <h3 className="text-white text-xl font-bold text-center mb-4">Work Bus</h3>
                          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 mb-6">
                            <div className="w-20 h-14 bg-white/30 rounded-lg mx-auto mb-2"></div>
                          </div>
                          <p className="text-white/90 text-center text-xs leading-relaxed mb-6">
                            Book your seat for your journey from home to work daily with monthly subscription.
                          </p>
                          <div className="bg-white rounded-full py-2 px-6 text-center">
                            <span className="text-primary text-sm font-semibold">Get Started</span>
                          </div>
                          {/* Decorative dots */}
                          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-1 opacity-30">
                            {[...Array(8)].map((_, i) => (
                              <div key={i} className="w-1.5 h-1.5 bg-white rounded-full"></div>
                            ))}
                          </div>
                        </div>
                      ) : customImage ? (
                        <img 
                          src={customImage} 
                          alt={serviceName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-br ${config.gradient} flex items-center justify-center`}>
                          <Icon className="h-20 w-20 text-white/80" />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Phone Reflection */}
                  <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-3/4 h-8 bg-foreground/10 rounded-full blur-xl"></div>
                </div>

                {/* Secondary Phone (Left) - Services Grid */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 md:-translate-x-8 w-48 md:w-56 transform -rotate-12 hover:rotate-0 transition-transform duration-500 opacity-60">
                  <div className="bg-foreground/80 rounded-[2rem] p-1.5 shadow-xl">
                    <div className="bg-background rounded-[1.7rem] overflow-hidden aspect-[9/19]">
                      {serviceType === 'corporate' ? (
                        <div className="w-full h-full bg-muted p-3 pt-8">
                          <h4 className="text-primary text-lg font-bold mb-1">Seater</h4>
                          <p className="text-foreground text-xs font-medium mb-3">Our Services</p>
                          <div className="grid grid-cols-2 gap-2 mb-3">
                            <div className="bg-background rounded-xl p-2 shadow-sm">
                              <div className="w-8 h-6 bg-primary/10 rounded mb-1 mx-auto"></div>
                              <p className="text-[8px] text-center text-foreground">School Bus</p>
                            </div>
                            <div className="bg-background rounded-xl p-2 shadow-sm">
                              <div className="w-8 h-6 bg-blue-100 rounded mb-1 mx-auto"></div>
                              <p className="text-[8px] text-center text-foreground">Tracking</p>
                            </div>
                            <div className="bg-background rounded-xl p-2 shadow-sm">
                              <div className="w-8 h-6 bg-muted-foreground/10 rounded mb-1 mx-auto"></div>
                              <p className="text-[8px] text-center text-foreground">Work Bus</p>
                            </div>
                            <div className="bg-background rounded-xl p-2 shadow-sm">
                              <div className="w-8 h-6 bg-muted-foreground/10 rounded mb-1 mx-auto"></div>
                              <p className="text-[8px] text-center text-foreground">Special</p>
                            </div>
                          </div>
                          <div className="bg-background rounded-xl p-2 shadow-sm">
                            <p className="text-[8px] font-medium text-foreground mb-1">Safety First</p>
                            <div className="flex items-center gap-1 mb-1">
                              <div className="w-4 h-4 bg-primary/10 rounded-full"></div>
                              <p className="text-[6px] text-muted-foreground">Daily sanitization</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-br from-muted to-muted-foreground/10 flex items-center justify-center`}>
                          <div className="space-y-3 p-4 w-full">
                            <div className="h-3 bg-foreground/10 rounded w-3/4"></div>
                            <div className="h-3 bg-foreground/10 rounded w-1/2"></div>
                            <div className="h-20 bg-foreground/5 rounded-xl mt-4"></div>
                            <div className="h-8 bg-primary/20 rounded-lg"></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tertiary Phone (Right) - Map/Tracking */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 md:translate-x-8 w-48 md:w-56 transform rotate-12 hover:rotate-0 transition-transform duration-500 opacity-60">
                  <div className="bg-foreground/80 rounded-[2rem] p-1.5 shadow-xl">
                    <div className="bg-background rounded-[1.7rem] overflow-hidden aspect-[9/19]">
                      {serviceType === 'corporate' ? (
                        <div className="w-full h-full relative">
                          {/* Map placeholder */}
                          <div className="w-full h-3/5 bg-gradient-to-b from-green-100 to-green-50 relative">
                            <div className="absolute top-3 left-3 bg-white rounded-lg px-2 py-1 shadow-sm">
                              <p className="text-[6px] text-primary">📍 Office</p>
                            </div>
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                              <div className="w-8 h-6 bg-white rounded shadow-md flex items-center justify-center">
                                <span className="text-[8px]">🚐</span>
                              </div>
                              <div className="bg-primary text-white text-[6px] rounded px-1 py-0.5 -mt-1 text-center">
                                15 min
                              </div>
                            </div>
                          </div>
                          {/* Driver card */}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-primary to-blue-500 rounded-t-3xl p-3">
                            <p className="text-white/80 text-[7px] text-center mb-2">Next arrival in 5 mins</p>
                            <div className="bg-white rounded-xl p-2 flex items-center gap-2">
                              <div className="w-8 h-8 bg-muted rounded-full"></div>
                              <div className="flex-1">
                                <p className="text-[8px] font-medium text-foreground">Mohamed Ahmed</p>
                                <p className="text-[6px] text-primary">Toyota Hiace</p>
                              </div>
                              <div className="text-[8px] text-amber-500">⭐ 4.9</div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-br from-muted to-muted-foreground/10 flex items-center justify-center`}>
                          <div className="space-y-3 p-4 w-full">
                            <div className="flex items-center gap-2 mb-4">
                              <div className="h-10 w-10 bg-primary/20 rounded-full"></div>
                              <div className="flex-1 space-y-2">
                                <div className="h-2 bg-foreground/10 rounded w-3/4"></div>
                                <div className="h-2 bg-foreground/10 rounded w-1/2"></div>
                              </div>
                            </div>
                            <div className="h-24 bg-foreground/5 rounded-xl"></div>
                            <div className="h-8 bg-primary/20 rounded-lg"></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Floating Elements */}
                <div className="absolute top-4 right-4 md:top-8 md:right-16 animate-float">
                  <div className="bg-card rounded-xl p-3 shadow-xl border border-border/50">
                    <div className="flex items-center gap-2">
                      <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${config.gradient} flex items-center justify-center`}>
                        <CheckCircle2 className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="text-xs font-medium">Active</p>
                        <p className="text-[10px] text-muted-foreground">Service Ready</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="absolute bottom-4 left-4 md:bottom-8 md:left-16 animate-float" style={{ animationDelay: '1s' }}>
                  <div className="bg-card rounded-xl p-3 shadow-xl border border-border/50">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs font-medium">{serviceName}</p>
                        <p className="text-[10px] text-muted-foreground">Premium Service</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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
