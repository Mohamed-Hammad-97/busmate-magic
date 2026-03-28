import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { 
  Bus, 
  MapPin, 
  Shield, 
  DollarSign, 
  Building2, 
  Car, 
  Navigation,
  Phone,
  Mail,
  MapPinned,
  ChevronRight,
  Apple,
  PlayCircle,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  Youtube,
  Sparkles,
  CheckCircle2,
  GraduationCap,
  UserRound
} from "lucide-react";
import { Link } from "react-router-dom";
import seaterLogo from "@/assets/seater-logo.jpg";
import serviceSchoolBus from "@/assets/service-school-bus.png";
import serviceCorporateBus from "@/assets/service-corporate-bus.png";
import servicePrivateCar from "@/assets/service-private-car.png";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import PhoneMockup from "@/components/home/PhoneMockup";

interface HomepageSetting {
  key: string;
  value: string | null;
}

interface Partner {
  id: string;
  name: string;
  logo_url: string | null;
  website_url: string | null;
}

interface GalleryImage {
  id: string;
  title: string | null;
  image_url: string;
  alt_text: string | null;
}

const Home = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  // Fetch settings
  const { data: settings } = useQuery({
    queryKey: ["homepage-settings-public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("homepage_settings")
        .select("key, value");
      if (error) throw error;
      const settingsMap: Record<string, string> = {};
      (data as HomepageSetting[]).forEach((s) => {
        settingsMap[s.key] = s.value || "";
      });
      return settingsMap;
    },
  });

  // Fetch partners
  const { data: partners } = useQuery({
    queryKey: ["homepage-partners-public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("homepage_partners")
        .select("id, name, logo_url, website_url")
        .order("display_order");
      if (error) throw error;
      return data as Partner[];
    },
  });

  // Fetch gallery
  const { data: gallery } = useQuery({
    queryKey: ["homepage-gallery-public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("homepage_gallery")
        .select("id, title, image_url, alt_text")
        .order("display_order");
      if (error) throw error;
      return data as GalleryImage[];
    },
  });

  // Submit contact form
  const submitContactMutation = useMutation({
    mutationFn: async (form: typeof contactForm) => {
      const { error } = await supabase
        .from("contact_submissions")
        .insert({
          name: form.name,
          email: form.email,
          subject: form.subject || null,
          message: form.message,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t('homepage.contact.successMessage'));
      setContactForm({ name: "", email: "", subject: "", message: "" });
    },
    onError: (error) => {
      toast.error(t('homepage.contact.errorMessage') + ": " + error.message);
    },
  });

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name || !contactForm.email || !contactForm.message) {
      toast.error(t('homepage.contact.fillRequired'));
      return;
    }
    submitContactMutation.mutate(contactForm);
  };

  const features = [
    {
      icon: DollarSign,
      title: t('homepage.features.affordable.title'),
      description: t('homepage.features.affordable.description')
    },
    {
      icon: MapPin,
      title: t('homepage.features.tracking.title'),
      description: t('homepage.features.tracking.description')
    },
    {
      icon: Navigation,
      title: t('homepage.features.coverage.title'),
      description: t('homepage.features.coverage.description')
    },
    {
      icon: Shield,
      title: t('homepage.features.safe.title'),
      description: t('homepage.features.safe.description')
    }
  ];

  // Dynamic services based on admin settings
  const getServiceDescription = (key: string, fallbackKey: string) => {
    const enKey = `service_${key}_description_en`;
    const arKey = `service_${key}_description_ar`;
    const customDesc = isRtl 
      ? (settings?.[arKey] || settings?.[enKey])
      : settings?.[enKey];
    return customDesc && customDesc.trim() !== "" ? customDesc : t(fallbackKey);
  };

  const getServiceShortDescription = (key: string, fallbackKey: string) => {
    const enKey = `service_${key}_short_en`;
    const arKey = `service_${key}_short_ar`;
    const customDesc = isRtl 
      ? (settings?.[arKey] || settings?.[enKey])
      : settings?.[enKey];
    return customDesc && customDesc.trim() !== "" ? customDesc : t(fallbackKey);
  };

  const getServiceName = (key: string, fallbackKey: string) => {
    const enKey = `service_${key}_name_en`;
    const arKey = `service_${key}_name_ar`;
    const customName = isRtl 
      ? (settings?.[arKey] || settings?.[enKey])
      : settings?.[enKey];
    return customName && customName.trim() !== "" ? customName : t(fallbackKey);
  };

  const isServiceEnabled = (key: string) => {
    return settings?.[`service_${key}_enabled`] === "true";
  };

  const getServiceImage = (key: string) => {
    return settings?.[`service_${key}_image`] || "";
  };

  const hasCustomDescription = (key: string) => {
    const enKey = `service_${key}_description_en`;
    const customDesc = settings?.[enKey];
    return customDesc && customDesc.trim() !== "";
  };

  const hasShortDescription = (key: string) => {
    const enKey = `service_${key}_short_en`;
    const customDesc = settings?.[enKey];
    return customDesc && customDesc.trim() !== "";
  };

  const getServiceLink = (key: string) => {
    if (hasCustomDescription(key)) {
      return `/services/${key}`;
    }
    return `/register/${key}`;
  };

  const services = [
    { 
      key: 'student',
      icon: GraduationCap,
      vehicleImage: serviceSchoolBus,
      title: getServiceName('student', 'homepage.services.schoolBus.title'), 
      subtitle: t('register.types.student.description'),
      shortDescription: getServiceShortDescription('student', 'homepage.services.schoolBus.description'),
      description: getServiceDescription('student', 'homepage.services.schoolBus.description'),
      image: getServiceImage('student'),
      enabled: isServiceEnabled('student'),
      hasShort: hasShortDescription('student'),
      link: getServiceLink('student'),
      badgeGradient: 'bg-gradient-to-br from-blue-500 to-blue-600',
      badgeShadow: 'shadow-blue-500/30',
      iconBgLight: 'from-blue-500/20 via-blue-500/10 to-blue-500/5',
      iconColor: 'text-blue-500',
      bgGlow: 'bg-blue-500/20'
    },
    { 
      key: 'corporate',
      icon: Building2,
      vehicleImage: serviceCorporateBus,
      title: getServiceName('corporate', 'homepage.services.corporate.title'), 
      subtitle: t('register.types.corporate.description'),
      shortDescription: getServiceShortDescription('corporate', 'homepage.services.corporate.description'),
      description: getServiceDescription('corporate', 'homepage.services.corporate.description'),
      image: getServiceImage('corporate'),
      enabled: isServiceEnabled('corporate'),
      hasShort: hasShortDescription('corporate'),
      link: getServiceLink('corporate'),
      badgeGradient: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
      badgeShadow: 'shadow-emerald-500/30',
      iconBgLight: 'from-emerald-500/20 via-emerald-500/10 to-emerald-500/5',
      iconColor: 'text-emerald-500',
      bgGlow: 'bg-emerald-500/20'
    },
    { 
      key: 'private',
      icon: UserRound,
      vehicleImage: servicePrivateCar,
      title: getServiceName('private', 'homepage.services.private.title'), 
      subtitle: t('register.types.private.description'),
      shortDescription: getServiceShortDescription('private', 'homepage.services.private.description'),
      description: getServiceDescription('private', 'homepage.services.private.description'),
      image: getServiceImage('private'),
      enabled: isServiceEnabled('private'),
      hasShort: hasShortDescription('private'),
      link: getServiceLink('private'),
      badgeGradient: 'bg-gradient-to-br from-purple-500 to-purple-600',
      badgeShadow: 'shadow-purple-500/30',
      iconBgLight: 'from-purple-500/20 via-purple-500/10 to-purple-500/5',
      iconColor: 'text-purple-500',
      bgGlow: 'bg-purple-500/20'
    }
  ];
  const getSetting = (key: string, fallback: string = "") => settings?.[key] || fallback;
  
  // Helper to check if a setting has a value (not empty)
  const hasSetting = (key: string) => {
    const value = settings?.[key];
    return value !== undefined && value !== null && value.trim() !== "";
  };

  return (
    <>
      {/* SEO Meta Tags */}
      <Helmet>
        <title>{getSetting("seo_title", "Seater - Smart School & Corporate Transportation")}</title>
        <meta name="description" content={getSetting("seo_description", "Smart, Reliable, and Effortless Transportation for Schools, Businesses, and Individuals.")} />
        <meta name="keywords" content={getSetting("seo_keywords", "school bus, transportation, fleet management, GPS tracking")} />
        <meta property="og:title" content={getSetting("seo_title", "Seater - Smart School & Corporate Transportation")} />
        <meta property="og:description" content={getSetting("seo_description", "Smart, Reliable, and Effortless Transportation for Schools, Businesses, and Individuals.")} />
        <meta name="twitter:title" content={getSetting("seo_title", "Seater - Smart School & Corporate Transportation")} />
        <meta name="twitter:description" content={getSetting("seo_description", "Smart, Reliable, and Effortless Transportation for Schools, Businesses, and Individuals.")} />
      </Helmet>
      <div className="min-h-screen bg-background">
      {/* Premium Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              <img src={seaterLogo} alt="Seater" className="h-11 w-auto rounded-xl shadow-md transition-transform duration-300 group-hover:scale-105" />
              <div className="absolute inset-0 rounded-xl bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/80">Seater</span>
          </Link>
          <div className="hidden lg:flex items-center gap-8">
            <a href="#about" className="text-muted-foreground hover:text-primary transition-colors font-medium link-underline">{t('homepage.nav.about')}</a>
            <a href="#features" className="text-muted-foreground hover:text-primary transition-colors font-medium link-underline">{t('homepage.nav.features')}</a>
            <a href="#services" className="text-muted-foreground hover:text-primary transition-colors font-medium link-underline">{t('homepage.nav.services')}</a>
            {partners && partners.length > 0 && (
              <a href="#partners" className="text-muted-foreground hover:text-primary transition-colors font-medium link-underline">{t('homepage.nav.partners')}</a>
            )}
            <a href="#contact" className="text-muted-foreground hover:text-primary transition-colors font-medium link-underline">{t('homepage.nav.contact')}</a>
          </div>
          <div className="flex items-center gap-3">
            {/* Social Media Links in Header */}
            {(hasSetting("social_facebook") || hasSetting("social_twitter") || hasSetting("social_instagram") || hasSetting("social_linkedin") || hasSetting("social_youtube") || hasSetting("social_tiktok")) && (
              <div className="hidden sm:flex items-center gap-2">
                {hasSetting("social_facebook") && (
                  <a href={getSetting("social_facebook")} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors p-1.5 rounded-lg hover:bg-primary/10">
                    <Facebook className="h-4 w-4" />
                  </a>
                )}
                {hasSetting("social_twitter") && (
                  <a href={getSetting("social_twitter")} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors p-1.5 rounded-lg hover:bg-primary/10">
                    <Twitter className="h-4 w-4" />
                  </a>
                )}
                {hasSetting("social_instagram") && (
                  <a href={getSetting("social_instagram")} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors p-1.5 rounded-lg hover:bg-primary/10">
                    <Instagram className="h-4 w-4" />
                  </a>
                )}
                {hasSetting("social_linkedin") && (
                  <a href={getSetting("social_linkedin")} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors p-1.5 rounded-lg hover:bg-primary/10">
                    <Linkedin className="h-4 w-4" />
                  </a>
                )}
                {hasSetting("social_youtube") && (
                  <a href={getSetting("social_youtube")} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors p-1.5 rounded-lg hover:bg-primary/10">
                    <Youtube className="h-4 w-4" />
                  </a>
                )}
                {hasSetting("social_tiktok") && (
                  <a href={getSetting("social_tiktok")} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors p-1.5 rounded-lg hover:bg-primary/10">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                    </svg>
                  </a>
                )}
              </div>
            )}
            <div className="h-6 w-px bg-border hidden sm:block"></div>
            <LanguageSwitcher />
            <Link to="/register">
              <Button className="shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300">
                {t('homepage.nav.getStarted')}
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Premium Hero Section */}
      <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
        </div>

        {/* Background Gallery Image */}
        {gallery && gallery.length > 0 ? (
          <div className="absolute inset-0 z-0">
            <img 
              src={gallery[0].image_url} 
              alt={gallery[0].alt_text || gallery[0].title || "Hero background"} 
              className={`w-full h-full object-cover ${isRtl ? 'scale-x-[-1]' : ''}`}
            />
            <div className={`absolute inset-0 ${isRtl 
              ? 'bg-gradient-to-l from-background via-background/80 to-background/40' 
              : 'bg-gradient-to-r from-background via-background/80 to-background/40'}`}></div>
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/30"></div>
          </div>
        ) : (
          <div className="absolute inset-0 z-0 bg-gradient-to-br from-background via-background to-primary/5"></div>
        )}
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-2xl space-y-8 animate-fade-in-up">

            {(() => {
              const isAr = i18n.language === 'ar';
              const title = isAr && getSetting("hero_title_ar") ? getSetting("hero_title_ar") : getSetting("hero_title", t('homepage.hero.defaultTitle'));
              const subtitle = isAr && getSetting("hero_subtitle_ar") ? getSetting("hero_subtitle_ar") : getSetting("hero_subtitle", t('homepage.hero.defaultSubtitle'));
              return (
                <>
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
                    {title.split(",")[0]},{" "}
                    <span className="text-primary relative">
                      {title.split(",").slice(1).join(",")}
                      <svg className="absolute -bottom-2 left-0 w-full h-3 text-primary/30" viewBox="0 0 200 12" preserveAspectRatio="none">
                        <path d="M0,8 Q50,0 100,8 T200,8" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
                      </svg>
                    </span>
                  </h1>
                  <p className="text-xl text-muted-foreground max-w-lg leading-relaxed">
                    {subtitle}
                  </p>
                </>
              );
            })()}
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              {getSetting("app_store_url") && (
                <a href={getSetting("app_store_url")} target="_blank" rel="noopener noreferrer">
                  <Button size="lg" className="gap-2 w-full sm:w-auto shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 hover:-translate-y-0.5">
                    <Apple className="h-5 w-5" />
                    {t('homepage.hero.downloadAppStore')}
                  </Button>
                </a>
              )}
              {getSetting("google_play_url") && (
                <a href={getSetting("google_play_url")} target="_blank" rel="noopener noreferrer">
                  <Button size="lg" variant="outline" className="gap-2 w-full sm:w-auto bg-background/80 backdrop-blur-sm border-2 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-300 hover:-translate-y-0.5">
                    <PlayCircle className="h-5 w-5" />
                    {t('homepage.hero.downloadPlayStore')}
                  </Button>
                </a>
              )}
              {!getSetting("app_store_url") && !getSetting("google_play_url") && (
                <Link to="/register">
                  <Button size="lg" className="gap-2 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 hover:-translate-y-0.5">
                    {t('homepage.nav.getStarted')}
                    <ChevronRight className="h-5 w-5 rtl:rotate-180" />
                  </Button>
                </Link>
              )}
            </div>

            {/* Premium Stats Cards */}
            {(hasSetting("stats_users") || hasSetting("stats_schools") || hasSetting("stats_cities")) && (
              <div className="flex flex-wrap items-center gap-4 pt-6">
                {hasSetting("stats_users") && (
                  <div className="glass-card px-6 py-4 flex items-center gap-4 animate-fade-in stagger-1">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <CheckCircle2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{getSetting("stats_users")}</p>
                      <p className="text-sm text-muted-foreground">{t('homepage.hero.activeUsers')}</p>
                    </div>
                  </div>
                )}
                {hasSetting("stats_schools") && (
                  <div className="glass-card px-6 py-4 flex items-center gap-4 animate-fade-in stagger-2">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{getSetting("stats_schools")}</p>
                      <p className="text-sm text-muted-foreground">{t('homepage.hero.schools')}</p>
                    </div>
                  </div>
                )}
                {hasSetting("stats_cities") && (
                  <div className="glass-card px-6 py-4 flex items-center gap-4 animate-fade-in stagger-3">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <MapPin className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{getSetting("stats_cities")}</p>
                      <p className="text-sm text-muted-foreground">{t('homepage.hero.cities')}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-8 h-12 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center pt-2">
            <div className="w-1.5 h-3 rounded-full bg-muted-foreground/50 animate-pulse"></div>
          </div>
        </div>
      </section>

      {/* Premium About Section */}
      <section id="about" className="py-24 px-4 relative section-premium">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Phone Mockup */}
            <div className="relative flex justify-center order-2 lg:order-1">
              <div className="relative">
                <div className="absolute -inset-8 bg-gradient-to-r from-primary/20 to-primary/5 rounded-full blur-3xl"></div>
                <PhoneMockup />
              </div>
            </div>
            {/* About Content */}
            <div className="space-y-6 order-1 lg:order-2">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight">
                {isRtl 
                  ? getSetting("about_title_ar", getSetting("about_title", t('homepage.about.defaultTitle')))
                  : getSetting("about_title", t('homepage.about.defaultTitle'))
                }
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {isRtl 
                  ? getSetting("about_text_ar", getSetting("about_text", t('homepage.about.defaultText')))
                  : getSetting("about_text", t('homepage.about.defaultText'))
                }
              </p>
              <Link to="/register">
                <Button size="lg" className="gap-2 shadow-lg shadow-primary/20 hover:shadow-xl transition-all duration-300 mt-4">
                  {t('homepage.services.moreDetails')}
                  <ChevronRight className="h-5 w-5 rtl:rotate-180" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Premium Features Section */}
      <section id="features" className="py-24 px-4 bg-gradient-to-b from-muted/50 to-background relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-border to-transparent"></div>
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-border to-transparent"></div>
        
        <div className="container mx-auto relative">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold">{t('homepage.features.title')}</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t('homepage.features.subtitle')}
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="group hover-lift border-0 bg-card/50 backdrop-blur-sm shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <CardContent className="p-8 space-y-5 relative">
                  <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:scale-110 transition-all duration-300 shadow-lg shadow-primary/10">
                    <feature.icon className="h-8 w-8 text-primary group-hover:text-primary-foreground transition-colors duration-300" />
                  </div>
                  <h3 className="text-xl font-semibold">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Premium Services Section */}
      <section id="services" className="py-24 px-4 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-b from-muted/30 via-background to-muted/30"></div>
        <div className="absolute top-20 right-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl"></div>
        
        <div className="container mx-auto relative">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold">{t('homepage.services.title')}</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{t('homepage.services.subtitle')}</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((service, index) => {
              const cardContent = (
                <div key={index} className={`group relative ${service.enabled ? 'cursor-pointer' : ''} animate-fade-in`} style={{ animationDelay: `${index * 0.1}s` }}>
                  {/* Card Glow Effect */}
                  <div className={`absolute -inset-1 ${service.bgGlow} rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`}></div>
                  
                  {/* Card Container */}
                  <div className="relative bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-8 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 hover:-translate-y-2">
                    {/* Centered Icon */}
                    <div className="flex justify-center mb-6">
                      <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl ${service.badgeGradient} text-white shadow-lg ${service.badgeShadow} group-hover:scale-110 transition-transform duration-300`}>
                        <service.icon className="h-8 w-8" />
                      </div>
                    </div>
                    
                    {/* Title */}
                    <h3 className="text-xl font-bold mb-3 text-center group-hover:text-primary transition-colors">
                      {service.title}
                    </h3>
                    
                    {/* Subtitle */}
                    <p className="text-muted-foreground text-sm leading-relaxed text-center mb-6">
                      {service.subtitle}
                    </p>
                    
                    {/* CTA */}
                    {service.enabled && (
                      <div className="flex items-center justify-center gap-2 text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <span>{t('homepage.services.moreDetails')}</span>
                        <ChevronRight className="h-4 w-4 rtl:rotate-180 group-hover:translate-x-1 transition-transform" />
                      </div>
                    )}
                  </div>
                </div>
              );

              return service.enabled ? (
                <Link key={index} to={service.link}>
                  {cardContent}
                </Link>
              ) : (
                <div key={index}>{cardContent}</div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Premium Partners Section */}
      {partners && partners.length > 0 && (
        <section id="partners" className="py-24 px-4 bg-gradient-to-b from-muted/50 to-background relative">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-border to-transparent"></div>
          <div className="container mx-auto">
            <div className="text-center space-y-4 mb-16">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold">{t('homepage.partners.title')}</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                {t('homepage.partners.subtitle')}
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {partners.map((partner) => (
                <a
                  key={partner.id}
                  href={partner.website_url || "#"}
                  target={partner.website_url ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  className="group aspect-[3/2] bg-card rounded-2xl border border-border/50 flex items-center justify-center p-6 hover:shadow-xl hover:border-primary/30 hover:-translate-y-1 transition-all duration-300"
                >
                  {partner.logo_url ? (
                    <img src={partner.logo_url} alt={partner.name} className="max-h-full max-w-full object-contain grayscale group-hover:grayscale-0 transition-all duration-300" />
                  ) : (
                    <div className="text-center">
                      <Building2 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2 group-hover:text-primary transition-colors" />
                      <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{partner.name}</span>
                    </div>
                  )}
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Premium Contact Section */}
      <section id="contact" className="py-24 px-4 relative">
        <div className="container mx-auto">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold">{t('homepage.contact.title')}</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t('homepage.contact.subtitle')}
            </p>
          </div>
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Contact Form */}
            <Card className="border-0 shadow-2xl bg-card/80 backdrop-blur-sm overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none"></div>
              <CardContent className="p-10 relative">
                <form onSubmit={handleContactSubmit} className="space-y-6">
                  <h3 className="text-2xl font-semibold mb-8">{t('homepage.contact.sendMessage')}</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <Input 
                      placeholder={t('homepage.contact.yourName')} 
                      value={contactForm.name}
                      onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                      required
                      className="h-12 bg-background/50 border-border/50 focus:border-primary"
                    />
                    <Input 
                      placeholder={t('homepage.contact.yourEmail')} 
                      type="email" 
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      required
                      className="h-12 bg-background/50 border-border/50 focus:border-primary"
                    />
                  </div>
                  <Input 
                    placeholder={t('homepage.contact.subject')} 
                    value={contactForm.subject}
                    onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                    className="h-12 bg-background/50 border-border/50 focus:border-primary"
                  />
                  <Textarea 
                    placeholder={t('homepage.contact.yourMessage')} 
                    rows={5}
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    required
                    className="bg-background/50 border-border/50 focus:border-primary resize-none"
                  />
                  <Button 
                    type="submit" 
                    size="lg" 
                    className="w-full shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300"
                    disabled={submitContactMutation.isPending}
                  >
                    {submitContactMutation.isPending ? t('homepage.contact.sending') : t('homepage.contact.send')}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Office Locations */}
            <div className="space-y-6">
              {/* Cairo Office */}
              <Card className="border-0 shadow-xl bg-card/80 backdrop-blur-sm overflow-hidden group hover:-translate-y-1 transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none"></div>
                <CardContent className="p-8 space-y-5 relative">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary transition-colors duration-300">
                      <MapPinned className="h-7 w-7 text-primary group-hover:text-primary-foreground transition-colors" />
                    </div>
                    <h4 className="text-xl font-semibold">{t('homepage.contact.cairoOffice')}</h4>
                  </div>
                  <div className="space-y-4 text-muted-foreground">
                    <p className="flex items-start gap-4">
                      <MapPin className="h-5 w-5 shrink-0 mt-0.5 text-primary/60" />
                      <span>{getSetting("cairo_address", "5th Settlement, New Cairo, Egypt")}</span>
                    </p>
                    <p className="flex items-center gap-4">
                      <Phone className="h-5 w-5 shrink-0 text-primary/60" />
                      <span>{getSetting("cairo_phone", "+20 123 456 7890")}</span>
                    </p>
                    <p className="flex items-center gap-4">
                      <Mail className="h-5 w-5 shrink-0 text-primary/60" />
                      <span>{getSetting("cairo_email", "cairo@seater.com")}</span>
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Alexandria Office */}
              <Card className="border-0 shadow-xl bg-card/80 backdrop-blur-sm overflow-hidden group hover:-translate-y-1 transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none"></div>
                <CardContent className="p-8 space-y-5 relative">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary transition-colors duration-300">
                      <MapPinned className="h-7 w-7 text-primary group-hover:text-primary-foreground transition-colors" />
                    </div>
                    <h4 className="text-xl font-semibold">{t('homepage.contact.alexandriaOffice')}</h4>
                  </div>
                  <div className="space-y-4 text-muted-foreground">
                    <p className="flex items-start gap-4">
                      <MapPin className="h-5 w-5 shrink-0 mt-0.5 text-primary/60" />
                      <span>{getSetting("alex_address", "Smouha, Alexandria, Egypt")}</span>
                    </p>
                    <p className="flex items-center gap-4">
                      <Phone className="h-5 w-5 shrink-0 text-primary/60" />
                      <span>{getSetting("alex_phone", "+20 123 456 7891")}</span>
                    </p>
                    <p className="flex items-center gap-4">
                      <Mail className="h-5 w-5 shrink-0 text-primary/60" />
                      <span>{getSetting("alex_email", "alex@seater.com")}</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Premium Footer */}
      <footer className="py-16 px-4 bg-gradient-to-b from-foreground to-foreground/95 text-background relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,hsl(var(--primary)/0.15),transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_50%,hsl(var(--primary)/0.1),transparent_50%)]"></div>
        
        <div className="container mx-auto relative">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <img src={seaterLogo} alt="Seater" className="h-12 w-auto rounded-xl shadow-lg" />
                <span className="text-2xl font-bold text-background">Seater</span>
              </div>
              <p className="text-background/70 leading-relaxed">
                {t('homepage.footer.tagline')}
              </p>
              {/* Social Media Links */}
              {(hasSetting("social_facebook") || hasSetting("social_twitter") || hasSetting("social_instagram") || hasSetting("social_linkedin") || hasSetting("social_youtube") || hasSetting("social_tiktok")) && (
                <div className="flex items-center gap-2 pt-2">
                  {hasSetting("social_facebook") && (
                    <a href={getSetting("social_facebook")} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-xl bg-background/10 hover:bg-primary hover:text-primary-foreground transition-all duration-300">
                      <Facebook className="h-5 w-5" />
                    </a>
                  )}
                  {hasSetting("social_twitter") && (
                    <a href={getSetting("social_twitter")} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-xl bg-background/10 hover:bg-primary hover:text-primary-foreground transition-all duration-300">
                      <Twitter className="h-5 w-5" />
                    </a>
                  )}
                  {hasSetting("social_instagram") && (
                    <a href={getSetting("social_instagram")} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-xl bg-background/10 hover:bg-primary hover:text-primary-foreground transition-all duration-300">
                      <Instagram className="h-5 w-5" />
                    </a>
                  )}
                  {hasSetting("social_linkedin") && (
                    <a href={getSetting("social_linkedin")} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-xl bg-background/10 hover:bg-primary hover:text-primary-foreground transition-all duration-300">
                      <Linkedin className="h-5 w-5" />
                    </a>
                  )}
                  {hasSetting("social_youtube") && (
                    <a href={getSetting("social_youtube")} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-xl bg-background/10 hover:bg-primary hover:text-primary-foreground transition-all duration-300">
                      <Youtube className="h-5 w-5" />
                    </a>
                  )}
                  {hasSetting("social_tiktok") && (
                    <a href={getSetting("social_tiktok")} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-xl bg-background/10 hover:bg-primary hover:text-primary-foreground transition-all duration-300">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                      </svg>
                    </a>
                  )}
                </div>
              )}
            </div>
            <div>
              <h5 className="font-semibold text-lg mb-6">{t('homepage.footer.quickLinks')}</h5>
              <ul className="space-y-3">
                <li><a href="#about" className="text-background/70 hover:text-background hover:translate-x-1 inline-block transition-all duration-300">{t('homepage.footer.aboutUs')}</a></li>
                <li><a href="#services" className="text-background/70 hover:text-background hover:translate-x-1 inline-block transition-all duration-300">{t('homepage.nav.services')}</a></li>
                <li><a href="#partners" className="text-background/70 hover:text-background hover:translate-x-1 inline-block transition-all duration-300">{t('homepage.nav.partners')}</a></li>
                <li><a href="#contact" className="text-background/70 hover:text-background hover:translate-x-1 inline-block transition-all duration-300">{t('homepage.nav.contact')}</a></li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold text-lg mb-6">{t('homepage.footer.portals')}</h5>
              <ul className="space-y-3">
                <li><Link to="/auth" className="text-background/70 hover:text-background hover:translate-x-1 inline-block transition-all duration-300">{t('homepage.footer.employeeLogin')}</Link></li>
                <li><Link to="/parent/auth" className="text-background/70 hover:text-background hover:translate-x-1 inline-block transition-all duration-300">{t('homepage.footer.parentPortal')}</Link></li>
                <li><Link to="/driver/login" className="text-background/70 hover:text-background hover:translate-x-1 inline-block transition-all duration-300">{t('homepage.footer.driverPortal')}</Link></li>
                <li><Link to="/company/auth" className="text-background/70 hover:text-background hover:translate-x-1 inline-block transition-all duration-300">{t('homepage.footer.companyPortal')}</Link></li>
                <li><Link to="/register" className="text-background/70 hover:text-background hover:translate-x-1 inline-block transition-all duration-300">{t('homepage.footer.register')}</Link></li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold text-lg mb-6">{t('homepage.footer.downloadApp')}</h5>
              <div className="space-y-3">
                {getSetting("app_store_url") && (
                  <a href={getSetting("app_store_url")} target="_blank" rel="noopener noreferrer">
                    <Button variant="secondary" size="lg" className="w-full gap-2 bg-background/10 hover:bg-background text-background hover:text-foreground border-0">
                      <Apple className="h-5 w-5" />
                      App Store
                    </Button>
                  </a>
                )}
                {getSetting("google_play_url") && (
                  <a href={getSetting("google_play_url")} target="_blank" rel="noopener noreferrer">
                    <Button variant="secondary" size="lg" className="w-full gap-2 mt-3 bg-background/10 hover:bg-background text-background hover:text-foreground border-0">
                      <PlayCircle className="h-5 w-5" />
                      Google Play
                    </Button>
                  </a>
                )}
                {!getSetting("app_store_url") && !getSetting("google_play_url") && (
                  <p className="text-sm text-background/50">{t('homepage.footer.comingSoon')}</p>
                )}
              </div>
            </div>
          </div>
          <div className="border-t border-background/10 mt-12 pt-8 text-center">
            <p className="text-background/50">{t('homepage.footer.copyright')}</p>
          </div>
        </div>
      </footer>
      </div>
    </>
  );
};

export default Home;