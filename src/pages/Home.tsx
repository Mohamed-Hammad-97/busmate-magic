import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  PlayCircle
} from "lucide-react";
import { Link } from "react-router-dom";
import seaterLogo from "@/assets/seater-logo.jpg";

const Home = () => {
  const features = [
    {
      icon: DollarSign,
      title: "Affordable Packages",
      description: "We offer a range of affordable packages with exclusive features tailored to our customers' needs."
    },
    {
      icon: MapPin,
      title: "Real-Time Tracking",
      description: "Track every ride live with GPS for complete peace of mind. Always know your child's journey."
    },
    {
      icon: Navigation,
      title: "Nationwide Coverage",
      description: "Reliable service across Egypt, soon expanding across the MENA region."
    },
    {
      icon: Shield,
      title: "Safe and Secure",
      description: "Verified drivers, caring supervisors, and 24/7 support ensure every journey is safe."
    }
  ];

  const services = [
    { icon: Bus, title: "School Bus", description: "Safe and reliable school transportation" },
    { icon: Building2, title: "Corporate Booking", description: "Professional fleet for businesses" },
    { icon: Car, title: "Private Request", description: "Customized private transportation" },
    { icon: MapPin, title: "Tracking Service", description: "Real-time GPS tracking solutions" }
  ];

  const partners = [
    "Partner 1", "Partner 2", "Partner 3", "Partner 4", "Partner 5", 
    "Partner 6", "Partner 7", "Partner 8", "Partner 9", "Partner 10",
    "Partner 11", "Partner 12", "Partner 13", "Partner 14", "Partner 15"
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={seaterLogo} alt="Seater" className="h-10 w-auto rounded-lg" />
            <span className="text-xl font-bold text-primary">Seater</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a href="#about" className="text-muted-foreground hover:text-primary transition-colors">About</a>
            <a href="#features" className="text-muted-foreground hover:text-primary transition-colors">Features</a>
            <a href="#services" className="text-muted-foreground hover:text-primary transition-colors">Services</a>
            <a href="#partners" className="text-muted-foreground hover:text-primary transition-colors">Partners</a>
            <a href="#contact" className="text-muted-foreground hover:text-primary transition-colors">Contact</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="outline">Login</Button>
            </Link>
            <Link to="/register">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
                <Bus className="h-4 w-4" />
                Mobile App for Corporate & Schools
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                Smart, Reliable, and{" "}
                <span className="text-primary">Effortless Transportation</span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-lg">
                Book your ride. Track every trip. Manage your fleet — all in one place. 
                For Schools, Businesses, and Individuals.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="gap-2">
                  <Apple className="h-5 w-5" />
                  Download on App Store
                </Button>
                <Button size="lg" variant="outline" className="gap-2">
                  <PlayCircle className="h-5 w-5" />
                  Get it on Google Play
                </Button>
              </div>
              <div className="flex items-center gap-8 pt-4">
                <div>
                  <p className="text-3xl font-bold text-primary">10K+</p>
                  <p className="text-sm text-muted-foreground">Active Users</p>
                </div>
                <div className="w-px h-12 bg-border"></div>
                <div>
                  <p className="text-3xl font-bold text-primary">500+</p>
                  <p className="text-sm text-muted-foreground">Schools</p>
                </div>
                <div className="w-px h-12 bg-border"></div>
                <div>
                  <p className="text-3xl font-bold text-primary">50+</p>
                  <p className="text-sm text-muted-foreground">Cities</p>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/5 rounded-3xl blur-3xl"></div>
              <div className="relative bg-gradient-to-br from-primary/10 to-primary/5 rounded-3xl p-8 border">
                <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-primary/20 to-background flex items-center justify-center">
                  <Bus className="h-32 w-32 text-primary/50" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 px-4">
        <div className="container mx-auto">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold">About Seater</h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              At Seater, we're redefining transportation with passion, innovation, and a vision for a 
              sustainable future. From schools and parents to corporate clients, we deliver safe, 
              reliable, and comfortable rides, giving families peace of mind and businesses travel 
              they can trust.
            </p>
            <div className="flex justify-center gap-4 pt-4">
              <Button variant="outline" size="lg" className="gap-2">
                Learn More <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl md:text-4xl font-bold">Why Seater</h2>
            <p className="text-lg text-muted-foreground">
              Discover ways to feel at ease and secure
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-0 bg-background">
                <CardContent className="p-6 space-y-4">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <feature.icon className="h-7 w-7 text-primary group-hover:text-primary-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl md:text-4xl font-bold">Seater Services</h2>
            <p className="text-lg text-muted-foreground">Let's get you a ride</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((service, index) => (
              <Card key={index} className="group cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-2 overflow-hidden">
                <CardContent className="p-0">
                  <div className="h-40 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center group-hover:from-primary group-hover:to-primary/80 transition-all duration-300">
                    <service.icon className="h-16 w-16 text-primary group-hover:text-primary-foreground transition-colors" />
                  </div>
                  <div className="p-6 space-y-2">
                    <h3 className="text-xl font-semibold">{service.title}</h3>
                    <p className="text-sm text-muted-foreground">{service.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Partners Section */}
      <section id="partners" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl md:text-4xl font-bold">Our Partners & Clients</h2>
            <p className="text-lg text-muted-foreground">
              Trusted by industry leaders and innovative companies worldwide
            </p>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-6">
            {partners.map((partner, index) => (
              <div 
                key={index} 
                className="aspect-[3/2] bg-background rounded-xl border flex items-center justify-center p-4 hover:shadow-md transition-shadow"
              >
                <div className="text-center">
                  <Building2 className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                  <span className="text-xs text-muted-foreground">{partner}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl md:text-4xl font-bold">Contact Us</h2>
            <p className="text-lg text-muted-foreground">
              Get in touch with our team
            </p>
          </div>
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Contact Form */}
            <Card className="border-0 shadow-lg">
              <CardContent className="p-8 space-y-6">
                <h3 className="text-2xl font-semibold">Send us a message</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <Input placeholder="Your Name" />
                  <Input placeholder="Your Email" type="email" />
                </div>
                <Input placeholder="Subject" />
                <Textarea placeholder="Your Message" rows={5} />
                <Button size="lg" className="w-full">Send Message</Button>
              </CardContent>
            </Card>

            {/* Contact Info */}
            <div className="space-y-8">
              {/* Cairo Office */}
              <Card className="border-0 bg-muted/30">
                <CardContent className="p-6 space-y-4">
                  <h4 className="text-xl font-semibold flex items-center gap-2">
                    <MapPinned className="h-5 w-5 text-primary" />
                    Cairo Office
                  </h4>
                  <div className="space-y-3 text-muted-foreground">
                    <p className="flex items-center gap-3">
                      <MapPin className="h-4 w-4 shrink-0" />
                      5th Settlement, New Cairo, Egypt
                    </p>
                    <p className="flex items-center gap-3">
                      <Phone className="h-4 w-4 shrink-0" />
                      +20 123 456 7890
                    </p>
                    <p className="flex items-center gap-3">
                      <Mail className="h-4 w-4 shrink-0" />
                      cairo@seater.com
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Alexandria Office */}
              <Card className="border-0 bg-muted/30">
                <CardContent className="p-6 space-y-4">
                  <h4 className="text-xl font-semibold flex items-center gap-2">
                    <MapPinned className="h-5 w-5 text-primary" />
                    Alexandria Office
                  </h4>
                  <div className="space-y-3 text-muted-foreground">
                    <p className="flex items-center gap-3">
                      <MapPin className="h-4 w-4 shrink-0" />
                      Smouha, Alexandria, Egypt
                    </p>
                    <p className="flex items-center gap-3">
                      <Phone className="h-4 w-4 shrink-0" />
                      +20 123 456 7891
                    </p>
                    <p className="flex items-center gap-3">
                      <Mail className="h-4 w-4 shrink-0" />
                      alex@seater.com
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <img src={seaterLogo} alt="Seater" className="h-10 w-auto rounded-lg" />
                <span className="text-xl font-bold">Seater</span>
              </div>
              <p className="text-primary-foreground/80 text-sm">
                Smart, Reliable, and Effortless Transportation for Schools, Businesses, and Individuals.
              </p>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Quick Links</h5>
              <ul className="space-y-2 text-sm text-primary-foreground/80">
                <li><a href="#about" className="hover:text-primary-foreground transition-colors">About Us</a></li>
                <li><a href="#services" className="hover:text-primary-foreground transition-colors">Services</a></li>
                <li><a href="#partners" className="hover:text-primary-foreground transition-colors">Partners</a></li>
                <li><a href="#contact" className="hover:text-primary-foreground transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Portals</h5>
              <ul className="space-y-2 text-sm text-primary-foreground/80">
                <li><Link to="/auth" className="hover:text-primary-foreground transition-colors">Employee Login</Link></li>
                <li><Link to="/parent/auth" className="hover:text-primary-foreground transition-colors">Parent Portal</Link></li>
                <li><Link to="/driver/login" className="hover:text-primary-foreground transition-colors">Driver Portal</Link></li>
                <li><Link to="/register" className="hover:text-primary-foreground transition-colors">Register</Link></li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Download App</h5>
              <div className="space-y-3">
                <Button variant="secondary" size="sm" className="w-full gap-2">
                  <Apple className="h-4 w-4" />
                  App Store
                </Button>
                <Button variant="secondary" size="sm" className="w-full gap-2">
                  <PlayCircle className="h-4 w-4" />
                  Google Play
                </Button>
              </div>
            </div>
          </div>
          <div className="border-t border-primary-foreground/20 mt-8 pt-8 text-center text-sm text-primary-foreground/60">
            <p>© 2025 Seater. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
