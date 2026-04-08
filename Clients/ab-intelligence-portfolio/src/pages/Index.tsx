import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import AboutSection from "@/components/AboutSection";
import ServicesSection from "@/components/ServicesSection";
import PricingSection from "@/components/PricingSection";
import CalculatorSection from "@/components/CalculatorSection";
import ContactSection from "@/components/ContactSection";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import BackToTop from "@/components/BackToTop";

const Index = () => (
  <main>
    <div className="grain-overlay" aria-hidden="true" />
    <Navbar />
    <HeroSection />
    <AboutSection />
    <ServicesSection />
    <PricingSection />
    <CalculatorSection />
    <ContactSection />
    <Footer />
    <WhatsAppButton />
    <BackToTop />
  </main>
);

export default Index;
