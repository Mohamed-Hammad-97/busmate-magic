import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CorporateRegistrationForm from '@/components/registration/CorporateRegistrationForm';
import seaterLogo from '@/assets/seater-logo.jpg';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';

const RegisterCorporate: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

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
            <ArrowLeft className="h-4 w-4" />
            {t('register.backToChoice')}
          </Button>
        </div>
        <div className="text-center mb-8">
          <div className="flex flex-col items-center mb-4">
            <img src={seaterLogo} alt="Seater" className="h-20 w-auto mb-2" />
          </div>
          <h1 className="text-3xl font-bold">{t('register.types.corporate.title')}</h1>
          <p className="text-muted-foreground mt-2">{t('register.types.corporate.description')}</p>
        </div>

        <CorporateRegistrationForm />
      </div>
    </div>
  );
};

export default RegisterCorporate;
