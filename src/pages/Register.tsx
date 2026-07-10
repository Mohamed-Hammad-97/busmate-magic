import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GraduationCap, Building2, User, ArrowLeft, ArrowRight, Sparkles, Bus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import seaterLogo from '@/assets/seater-logo.jpg';
import serviceSchoolBus from '@/assets/service-school-bus.png';
import serviceCorporateBus from '@/assets/service-corporate-bus.png';
import servicePrivateCar from '@/assets/service-private-car.png';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import PageSeo from '@/components/seo/PageSeo';

const Register: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const registrationTypes = [
    {
      id: 'student',
      icon: GraduationCap,
      vehicleImage: serviceSchoolBus,
      title: t('register.types.student.title'),
      description: t('register.types.student.description'),
      path: '/register/student',
      gradient: 'from-blue-500 to-blue-600',
      bgGlow: 'bg-blue-500/20',
    },
    {
      id: 'corporate',
      icon: Building2,
      vehicleImage: serviceCorporateBus,
      title: t('register.types.corporate.title'),
      description: t('register.types.corporate.description'),
      path: '/register/corporate',
      gradient: 'from-emerald-500 to-emerald-600',
      bgGlow: 'bg-emerald-500/20',
    },
    {
      id: 'private',
      icon: User,
      vehicleImage: servicePrivateCar,
      title: t('register.types.private.title'),
      description: t('register.types.private.description'),
      path: '/register/private',
      gradient: 'from-purple-500 to-purple-600',
      bgGlow: 'bg-purple-500/20',
    },
    {
      id: 'daily-line',
      icon: Bus,
      vehicleImage: servicePrivateCar,
      title: 'Daily Line Trip',
      description: 'Book a seat on a scheduled daily line. Pay cash or via Instapay.',
      path: '/register/daily-line',
      gradient: 'from-orange-500 to-amber-500',
      bgGlow: 'bg-orange-500/20',
    },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background Decorations */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/5"></div>
      <div className="absolute top-20 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl"></div>

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
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
              {t('register.backToWebsite')}
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="relative pt-32 pb-20 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Header Section */}
          <div className="text-center mb-16 space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">{t('register.title')}</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold">
              {t('register.chooseType')}
            </h1>
          </div>

          {/* Service Cards Grid */}
          <div className="grid gap-8 md:grid-cols-3">
            {registrationTypes.map((type, index) => (
              <div
                key={type.id}
                className="group relative cursor-pointer animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
                onClick={() => navigate(type.path)}
              >
                {/* Card Glow Effect */}
                <div className={`absolute -inset-1 ${type.bgGlow} rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`}></div>
                
                {/* Card */}
                <div className="relative bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-8 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 hover:-translate-y-2">
                  {/* Icon */}
                  <div className="flex justify-center mb-6">
                    <div className="w-36 h-36 rounded-2xl overflow-hidden group-hover:scale-110 transition-transform duration-300">
                      <img src={type.vehicleImage} alt={type.title} className="w-full h-full object-contain" loading="lazy" width={144} height={144} />
                    </div>
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">
                    {type.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                    {type.description}
                  </p>

                  {/* CTA */}
                  <div className="flex items-center gap-2 text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span>{t('homepage.services.getStarted')}</span>
                    <ArrowRight className="h-4 w-4 rtl:rotate-180 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
};

export default Register;
