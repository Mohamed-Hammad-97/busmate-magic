import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Building2 } from 'lucide-react';
import CorporateRegistrationForm from '@/components/registration/CorporateRegistrationForm';
import seaterLogo from '@/assets/seater-logo.jpg';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import PageSeo from '@/components/seo/PageSeo';

const RegisterCorporate: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background Decorations */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-background to-emerald-500/5"></div>
      <div className="absolute top-20 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>

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
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg mb-4">
              <Building2 className="h-8 w-8" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold">{t('register.types.corporate.title')}</h1>
            <p className="text-muted-foreground max-w-lg mx-auto">{t('register.types.corporate.description')}</p>
          </div>

          <CorporateRegistrationForm />
        </div>
      </div>
    </div>
  );
};

export default RegisterCorporate;
