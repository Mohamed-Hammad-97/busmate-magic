import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GraduationCap, Building2, User, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import seaterLogo from '@/assets/seater-logo.jpg';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';

const Register: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const registrationTypes = [
    {
      id: 'student',
      icon: GraduationCap,
      title: t('register.types.student.title'),
      description: t('register.types.student.description'),
      path: '/register/student',
    },
    {
      id: 'corporate',
      icon: Building2,
      title: t('register.types.corporate.title'),
      description: t('register.types.corporate.description'),
      path: '/register/corporate',
    },
    {
      id: 'private',
      icon: User,
      title: t('register.types.private.title'),
      description: t('register.types.private.description'),
      path: '/register/private',
    },
  ];

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
            {t('register.backToWebsite')}
          </Button>
        </div>
        <div className="text-center mb-12">
          <div className="flex flex-col items-center mb-4">
            <img src={seaterLogo} alt="Seater" className="h-20 w-auto mb-2" />
          </div>
          <h1 className="text-3xl font-bold">{t('register.title')}</h1>
          <p className="text-muted-foreground mt-2">{t('register.chooseType')}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {registrationTypes.map((type) => (
            <Card
              key={type.id}
              className="cursor-pointer transition-all hover:shadow-lg hover:scale-105 hover:border-primary"
              onClick={() => navigate(type.path)}
            >
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <type.icon className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-xl">{type.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center">
                  {type.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Register;
