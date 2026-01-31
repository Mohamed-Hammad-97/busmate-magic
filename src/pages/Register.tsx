import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GraduationCap, Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import StudentRegistrationForm from '@/components/registration/StudentRegistrationForm';
import CorporateRegistrationForm from '@/components/registration/CorporateRegistrationForm';
import seaterLogo from '@/assets/seater-logo.jpg';

const Register: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex flex-col items-center mb-4">
            <img src={seaterLogo} alt="Seater" className="h-20 w-auto mb-2" />
          </div>
          <h1 className="text-3xl font-bold">{t('register.title')}</h1>
          <p className="text-muted-foreground mt-2">{t('register.description')}</p>
        </div>

        <Tabs defaultValue="student" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="student" className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              {t('register.tabs.student')}
            </TabsTrigger>
            <TabsTrigger value="corporate" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {t('register.tabs.corporate')}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="student">
            <StudentRegistrationForm />
          </TabsContent>
          <TabsContent value="corporate">
            <CorporateRegistrationForm />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Register;
