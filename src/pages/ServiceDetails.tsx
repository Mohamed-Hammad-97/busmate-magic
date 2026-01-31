import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, GraduationCap, Building2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
    <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background py-8 px-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('register.backToChoice')}
          </Button>
        </div>

        <div className="text-center mb-8">
          <div className="flex flex-col items-center mb-4">
            <img src={seaterLogo} alt="Seater" className="h-20 w-auto mb-2" />
          </div>
          <h1 className="text-3xl font-bold">{serviceName}</h1>
        </div>

        <Card className="overflow-hidden">
          {customImage && (
            <div className="w-full h-64 md:h-80 overflow-hidden">
              <img 
                src={customImage} 
                alt={serviceName}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          {!customImage && (
            <div className="w-full h-48 bg-primary/10 flex items-center justify-center">
              <Icon className="h-24 w-24 text-primary/50" />
            </div>
          )}
          <CardContent className="p-8">
            <div className="prose prose-lg max-w-none mb-8">
              <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {description}
              </p>
            </div>
            
            <div className="flex justify-center">
              <Button asChild size="lg" className="px-8">
                <Link to={config.registerPath}>
                  {t('homepage.services.getStarted')}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ServiceDetails;
