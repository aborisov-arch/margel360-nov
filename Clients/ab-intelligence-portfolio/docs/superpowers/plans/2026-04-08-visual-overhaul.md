# AB Intelligence Visual Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the AB Intelligence portfolio site to match Metalab.com's premium minimalist aesthetic — pure black background, massive editorial typography, horizontal service rows with hover interactions, and smooth Framer Motion animations throughout.

**Architecture:** Each component is rewritten in isolation. Global styles go first (index.css), then Navbar, then Hero, then each section top-to-bottom. PortfolioSection is deleted. ServicesSection is completely rewritten as horizontal numbered rows.

**Tech Stack:** React 18, TypeScript, Framer Motion, Tailwind CSS, Lucide React

---

## File Map

| File | Action |
|---|---|
| `src/index.css` | Update CSS variables to pure black + accent `#1d4ed8`, remove glass/glow utilities |
| `src/components/Navbar.tsx` | Remove scroll transparency, always black, add "Свържете се" CTA |
| `src/components/HeroSection.tsx` | Remove mockup card, add word-by-word text reveal, left-aligned layout |
| `src/components/ServicesSection.tsx` | Complete rewrite — horizontal numbered rows with hover expand |
| `src/components/PortfolioSection.tsx` | Delete entirely |
| `src/pages/Index.tsx` | Remove PortfolioSection import and JSX |
| `src/components/AboutSection.tsx` | Two-column bold statement layout |
| `src/components/PricingSection.tsx` | Remove glassmorphism, flat minimal card |
| `src/components/CalculatorSection.tsx` | Flat minimal inputs, dark style |
| `src/components/ContactSection.tsx` | Huge heading, flat form, remove glass cards |
| `src/components/Footer.tsx` | Single-row layout with top border |

---

### Task 1: Global CSS — pure black theme + remove glass utilities

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Replace CSS variables and remove glass/glow utilities**

Replace the entire `src/index.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

@layer base {
  :root {
    --background: 0 0% 0%;
    --foreground: 0 0% 100%;

    --card: 0 0% 4%;
    --card-foreground: 0 0% 100%;

    --popover: 0 0% 4%;
    --popover-foreground: 0 0% 100%;

    --primary: 221 91% 47%;
    --primary-foreground: 0 0% 100%;

    --secondary: 0 0% 6%;
    --secondary-foreground: 0 0% 100%;

    --muted: 0 0% 10%;
    --muted-foreground: 0 0% 42%;

    --accent: 221 91% 47%;
    --accent-foreground: 0 0% 100%;

    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;

    --border: 0 0% 10%;
    --input: 0 0% 10%;
    --ring: 221 91% 47%;

    --radius: 0.75rem;
  }
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
    font-family: 'Inter', sans-serif;
    background: #000;
    color: #fff;
  }

  html {
    scroll-behavior: smooth;
  }
}

@layer utilities {
  .text-gradient {
    @apply bg-clip-text text-transparent;
    background-image: linear-gradient(135deg, #fff 0%, #6b7280 100%);
  }

  .section-padding {
    @apply py-24 md:py-32;
  }

  .accent-line {
    display: block;
    width: 40px;
    height: 2px;
    background: #1d4ed8;
    margin-bottom: 24px;
  }
}

@keyframes grain {
  0%, 100% { transform: translate(0, 0); }
  10% { transform: translate(-2%, -3%); }
  20% { transform: translate(1%, 2%); }
  30% { transform: translate(-1%, 1%); }
  40% { transform: translate(2%, -1%); }
  50% { transform: translate(-2%, 2%); }
  60% { transform: translate(1%, -2%); }
  70% { transform: translate(-1%, 3%); }
  80% { transform: translate(2%, 1%); }
  90% { transform: translate(-2%, -1%); }
}

.grain-overlay {
  position: fixed;
  inset: -200%;
  width: 400%;
  height: 400%;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E");
  opacity: 0.03;
  pointer-events: none;
  z-index: 9999;
  animation: grain 8s steps(10) infinite;
}
```

- [ ] **Step 2: Verify the app still compiles**

```bash
cd "/Users/angelborisov/AB Intelligence/Clients/ab-intelligence-portfolio"
npm run build 2>&1 | tail -5
```

Expected: no errors (warnings OK)

- [ ] **Step 3: Commit**

```bash
cd "/Users/angelborisov/AB Intelligence/Clients/ab-intelligence-portfolio"
git add src/index.css
git commit -m "style: pure black theme, remove glassmorphism, update CSS variables"
```

---

### Task 2: Add grain overlay to main layout

**Files:**
- Modify: `src/pages/Index.tsx`
- Modify: `src/components/PortfolioSection.tsx` → delete

- [ ] **Step 1: Delete PortfolioSection.tsx**

```bash
rm "/Users/angelborisov/AB Intelligence/Clients/ab-intelligence-portfolio/src/components/PortfolioSection.tsx"
```

- [ ] **Step 2: Rewrite Index.tsx — remove PortfolioSection, add grain overlay**

Replace `src/pages/Index.tsx` with:

```tsx
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
```

- [ ] **Step 3: Verify build**

```bash
cd "/Users/angelborisov/AB Intelligence/Clients/ab-intelligence-portfolio"
npm run build 2>&1 | tail -5
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
cd "/Users/angelborisov/AB Intelligence/Clients/ab-intelligence-portfolio"
git add src/pages/Index.tsx src/components/PortfolioSection.tsx
git commit -m "feat: remove PortfolioSection, add grain texture overlay"
```

---

### Task 3: Navbar — always black, CTA button, clean links

**Files:**
- Modify: `src/components/Navbar.tsx`

- [ ] **Step 1: Rewrite Navbar.tsx**

Replace entire file with:

```tsx
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const navLinks = [
  { href: "#services", label: "Услуги" },
  { href: "#pricing", label: "Цени" },
  { href: "#calculator", label: "Калкулатор" },
  { href: "#about", label: "За нас" },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const handleClick = (href: string) => {
    setMobileOpen(false);
    setTimeout(() => {
      document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
    }, mobileOpen ? 300 : 0);
  };

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-white/5"
      style={{ background: "#000" }}
    >
      <nav className="container mx-auto flex items-center justify-between py-5 px-6 md:px-10">
        {/* Logo */}
        <a
          href="#hero"
          className="text-xl font-bold tracking-tight text-white"
          onClick={(e) => { e.preventDefault(); handleClick("#hero"); }}
        >
          АБИ
        </a>

        {/* Desktop links */}
        <ul className="hidden md:flex items-center gap-10">
          {navLinks.map((l) => (
            <li key={l.href}>
              <button
                onClick={() => handleClick(l.href)}
                className="text-sm font-medium text-white/50 hover:text-white transition-colors duration-200"
              >
                {l.label}
              </button>
            </li>
          ))}
        </ul>

        {/* CTA + hamburger */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => handleClick("#contact")}
            className="hidden md:block text-sm font-semibold px-5 py-2.5 border border-white/20 text-white rounded-full hover:bg-white hover:text-black transition-all duration-300"
          >
            Свържете се
          </button>
          <button
            className="md:hidden w-10 h-10 flex flex-col items-center justify-center gap-[5px] relative z-50"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            <motion.span
              animate={mobileOpen ? { rotate: 45, y: 7 } : { rotate: 0, y: 0 }}
              transition={{ duration: 0.3 }}
              className="block w-6 h-[1.5px] bg-white origin-center"
            />
            <motion.span
              animate={mobileOpen ? { opacity: 0 } : { opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="block w-6 h-[1.5px] bg-white"
            />
            <motion.span
              animate={mobileOpen ? { rotate: -45, y: -7 } : { rotate: 0, y: 0 }}
              transition={{ duration: 0.3 }}
              className="block w-6 h-[1.5px] bg-white origin-center"
            />
          </button>
        </div>
      </nav>

      {/* Mobile fullscreen overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 flex flex-col items-center justify-center md:hidden"
            style={{ background: "#000" }}
          >
            <ul className="flex flex-col items-center gap-8">
              {[...navLinks, { href: "#contact", label: "Свържете се" }].map((l, i) => (
                <motion.li
                  key={l.href}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07, duration: 0.4 }}
                >
                  <button
                    onClick={() => handleClick(l.href)}
                    className="text-3xl font-bold text-white hover:text-[#1d4ed8] transition-colors"
                  >
                    {l.label}
                  </button>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
};

export default Navbar;
```

- [ ] **Step 2: Verify build**

```bash
cd "/Users/angelborisov/AB Intelligence/Clients/ab-intelligence-portfolio"
npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/angelborisov/AB Intelligence/Clients/ab-intelligence-portfolio"
git add src/components/Navbar.tsx
git commit -m "feat: navbar always black, CTA button, fullscreen mobile overlay"
```

---

### Task 4: HeroSection — word-by-word reveal, remove mockup card

**Files:**
- Modify: `src/components/HeroSection.tsx`

- [ ] **Step 1: Rewrite HeroSection.tsx**

Replace entire file with:

```tsx
import { motion } from "framer-motion";

const words = ["Изграждаме", "дигиталното", "бъдеще", "на", "вашия", "бизнес."];

const HeroSection = () => {
  const scrollTo = (id: string) => {
    document.querySelector(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center"
      style={{ background: "#000" }}
    >
      <div className="container mx-auto px-6 md:px-10 pt-32 pb-20">
        {/* Label */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-xs font-semibold tracking-[0.2em] text-[#1d4ed8] uppercase mb-8"
        >
          — Уеб агенция от София, България
        </motion.p>

        {/* Headline */}
        <h1 className="text-[clamp(3rem,8vw,6.5rem)] font-extrabold leading-[1.04] tracking-tight text-white mb-10 max-w-5xl">
          {words.map((word, i) => (
            <motion.span
              key={word + i}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="inline-block mr-[0.25em]"
            >
              {word}
            </motion.span>
          ))}
        </h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.0 }}
          className="text-base md:text-lg text-white/40 mb-12 max-w-lg"
        >
          Модерни уебсайтове, които привличат реални клиенти — от концепция до публикуване.
        </motion.p>

        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.15 }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <button
            onClick={() => scrollTo("#calculator")}
            className="px-8 py-4 rounded-full bg-white text-black text-sm font-bold hover:bg-white/90 transition-colors"
          >
            Сметнете инвестицията
          </button>
          <button
            onClick={() => scrollTo("#contact")}
            className="px-8 py-4 rounded-full border border-white/20 text-white text-sm font-semibold hover:border-white/50 transition-colors"
          >
            Свържете се с нас
          </button>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8, duration: 0.8 }}
          className="absolute bottom-10 left-6 md:left-10 flex items-center gap-3"
        >
          <div className="w-px h-12 bg-white/20" />
          <span className="text-xs text-white/30 tracking-widest uppercase rotate-0">Scroll</span>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
```

- [ ] **Step 2: Verify build**

```bash
cd "/Users/angelborisov/AB Intelligence/Clients/ab-intelligence-portfolio"
npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/angelborisov/AB Intelligence/Clients/ab-intelligence-portfolio"
git add src/components/HeroSection.tsx
git commit -m "feat: hero word-by-word reveal, remove mockup card, left-aligned layout"
```

---

### Task 5: ServicesSection — horizontal numbered rows

**Files:**
- Modify: `src/components/ServicesSection.tsx`

- [ ] **Step 1: Rewrite ServicesSection.tsx**

Replace entire file with:

```tsx
import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";

const services = [
  {
    num: "01",
    title: "Уеб дизайн",
    sub: "Web Design",
    desc: "Модерни и атрактивни уебсайтове, проектирани да впечатляват и конвертират.",
  },
  {
    num: "02",
    title: "SEO Оптимизация",
    sub: "SEO Optimization",
    desc: "Повишете видимостта си в Google и привличайте органичен трафик.",
  },
  {
    num: "03",
    title: "Мобилна оптимизация",
    sub: "Mobile Optimization",
    desc: "Перфектно изживяване на всяко устройство — телефон, таблет, десктоп.",
  },
  {
    num: "04",
    title: "Поддръжка",
    sub: "Website Maintenance",
    desc: "Непрекъсната поддръжка, актуализации и сигурност на вашия сайт.",
  },
  {
    num: "05",
    title: "Брандинг",
    sub: "Branding & Identity",
    desc: "Изградете запомнящ се бранд с уникална визия и последователна идентичност.",
  },
];

const ServiceRow = ({
  service,
  index,
  inView,
}: {
  service: (typeof services)[0];
  index: number;
  inView: boolean;
}) => {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group border-t border-white/8 cursor-default"
      style={{ borderColor: "rgba(255,255,255,0.08)" }}
    >
      <div
        className="flex items-center justify-between py-7 md:py-9 px-0 transition-all duration-300"
        style={{ background: hovered ? "rgba(255,255,255,0.02)" : "transparent" }}
      >
        {/* Left: number + title */}
        <div className="flex items-center gap-5 md:gap-10 flex-1 min-w-0">
          <span
            className="text-xs font-bold tracking-widest transition-colors duration-300 shrink-0"
            style={{ color: hovered ? "#1d4ed8" : "rgba(255,255,255,0.25)" }}
          >
            {service.num}
          </span>
          <div className="min-w-0">
            <h3
              className="text-2xl md:text-4xl font-bold text-white transition-colors duration-300 leading-tight"
              style={{ color: hovered ? "#fff" : "rgba(255,255,255,0.85)" }}
            >
              {service.title}
            </h3>
          </div>
        </div>

        {/* Right: description (fades in on hover) or arrow */}
        <div className="flex items-center gap-6 shrink-0 ml-6">
          <motion.p
            animate={{ opacity: hovered ? 1 : 0, x: hovered ? 0 : 10 }}
            transition={{ duration: 0.25 }}
            className="hidden lg:block text-sm text-white/50 max-w-xs text-right"
          >
            {service.desc}
          </motion.p>
          <motion.span
            animate={{ opacity: hovered ? 1 : 0.2, x: hovered ? 4 : 0 }}
            transition={{ duration: 0.25 }}
            className="text-white text-xl"
          >
            →
          </motion.span>
        </div>
      </div>
    </motion.div>
  );
};

const ServicesSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="services" className="section-padding" ref={ref} style={{ background: "#000" }}>
      <div className="container mx-auto px-6 md:px-10">
        {/* Label */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5 }}
          className="text-xs font-bold tracking-[0.2em] text-[#1d4ed8] uppercase mb-16"
        >
          — УСЛУГИ
        </motion.p>

        {/* Rows */}
        <div>
          {services.map((s, i) => (
            <ServiceRow key={s.num} service={s} index={i} inView={inView} />
          ))}
          {/* Bottom border */}
          <div className="border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }} />
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;
```

- [ ] **Step 2: Verify build**

```bash
cd "/Users/angelborisov/AB Intelligence/Clients/ab-intelligence-portfolio"
npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/angelborisov/AB Intelligence/Clients/ab-intelligence-portfolio"
git add src/components/ServicesSection.tsx
git commit -m "feat: services as Metalab-style horizontal numbered rows with hover"
```

---

### Task 6: AboutSection — two-column bold statement

**Files:**
- Modify: `src/components/AboutSection.tsx`

- [ ] **Step 1: Rewrite AboutSection.tsx**

Replace entire file with:

```tsx
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const AboutSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="about" className="section-padding" ref={ref} style={{ background: "#000" }}>
      <div className="container mx-auto px-6 md:px-10">
        {/* Label */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5 }}
          className="text-xs font-bold tracking-[0.2em] text-[#1d4ed8] uppercase mb-16"
        >
          — ЗА НАС
        </motion.p>

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-start">
          {/* Left: bold statement */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <h2 className="text-3xl md:text-5xl font-extrabold text-white leading-tight">
              18+ проекта.<br />
              100% клиентско<br />
              удовлетворение.
            </h2>
          </motion.div>

          {/* Right: divider + text */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="lg:pt-3"
          >
            <div className="w-8 h-px bg-[#1d4ed8] mb-8" />
            <p className="text-base md:text-lg text-white/50 leading-relaxed mb-6">
              АБИ (AB Intelligence) е Sofia-базирана агенция за уеб дизайн, която помага на малки и средни бизнеси да изградят своето онлайн присъствие.
            </p>
            <p className="text-base text-white/35 leading-relaxed">
              Създаваме модерни, бързи и оптимизирани за търсачки уебсайтове, които не само изглеждат страхотно, но и привличат реални клиенти — всичко с достъпни цени.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
```

- [ ] **Step 2: Verify build**

```bash
cd "/Users/angelborisov/AB Intelligence/Clients/ab-intelligence-portfolio"
npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/angelborisov/AB Intelligence/Clients/ab-intelligence-portfolio"
git add src/components/AboutSection.tsx
git commit -m "feat: about section two-column bold statement layout"
```

---

### Task 7: PricingSection + CalculatorSection — flat minimal style

**Files:**
- Modify: `src/components/PricingSection.tsx`
- Modify: `src/components/CalculatorSection.tsx`

- [ ] **Step 1: Rewrite PricingSection.tsx**

Replace entire file with:

```tsx
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Check, X } from "lucide-react";

const features = [
  { text: "До 5 страници / Up to 5 pages", included: true },
  { text: "Мобилна оптимизация / Mobile optimization", included: true },
  { text: "Базова SEO настройка / Basic SEO setup", included: true },
  { text: "Форма за контакт / Contact form", included: true },
  { text: "Google Maps + WhatsApp", included: true },
  { text: "SSL сертификат / SSL certificate", included: true },
  { text: "Двуезичен сайт (БГ + EN) / Bilingual", included: true },
  { text: "SEO Оптимизация (+€50)", included: false },
  { text: "Блог секция (+€50)", included: false },
  { text: "Онлайн записване / Online Booking (+€80)", included: false },
];

const PricingSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="pricing" className="section-padding" ref={ref} style={{ background: "#000" }}>
      <div className="container mx-auto px-6 md:px-10 max-w-2xl">
        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5 }}
          className="text-xs font-bold tracking-[0.2em] text-[#1d4ed8] uppercase mb-16"
        >
          — ЦЕНИ
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="border rounded-2xl p-8 md:p-12 transition-colors duration-300 hover:border-[#1d4ed8]/50"
          style={{ borderColor: "rgba(255,255,255,0.08)", background: "#000" }}
        >
          <p className="text-xs font-bold tracking-widest text-white/30 mb-6 uppercase">
            Базов пакет / Basic Package
          </p>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-5xl md:text-6xl font-extrabold text-white">€200</span>
            <span className="text-white/30 text-sm">/ старт</span>
          </div>
          <p className="text-white/40 text-sm mb-10">
            Идеален за малки бизнеси, стартиращи онлайн.
          </p>

          <div className="space-y-4 mb-10">
            {features.map((f) => (
              <div key={f.text} className="flex items-center gap-3">
                {f.included ? (
                  <Check size={15} className="shrink-0" style={{ color: "#1d4ed8" }} />
                ) : (
                  <X size={15} className="shrink-0 text-white/20" />
                )}
                <span className={f.included ? "text-white/70 text-sm" : "text-white/20 text-sm"}>
                  {f.text}
                </span>
              </div>
            ))}
          </div>

          <p className="text-xs text-white/25 mb-6 italic">
            Поддръжка: първият месец е безплатен, след това €110/месец
          </p>

          <button
            onClick={() => document.querySelector("#contact")?.scrollIntoView({ behavior: "smooth" })}
            className="w-full py-4 rounded-full border border-white/15 text-white text-sm font-semibold hover:bg-white hover:text-black transition-all duration-300"
          >
            Поръчай сега
          </button>
        </motion.div>
      </div>
    </section>
  );
};

export default PricingSection;
```

- [ ] **Step 2: Rewrite CalculatorSection.tsx**

Replace entire file with:

```tsx
import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import { ArrowRight } from "lucide-react";

const pages = [
  { label: "1–5 страници", price: 0 },
  { label: "6–10 страници", price: 50 },
];

const extras = [
  { label: "SEO Оптимизация", price: 50, note: "" },
  { label: "Блог секция", price: 50, note: "" },
  { label: "Двуезичен сайт (БГ + EN)", price: 0, note: "Безплатно" },
  { label: "Онлайн записване", price: 80, note: "" },
  { label: "Поддръжка", price: 0, note: "Първият месец е безплатен, след това €110/месец" },
];

const inputClass =
  "w-full px-4 py-3 bg-transparent border text-white text-sm focus:outline-none transition-colors duration-200 rounded-lg";
const inputStyle = { borderColor: "rgba(255,255,255,0.1)" };
const inputFocusStyle = { borderColor: "#1d4ed8" };

const CalculatorSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [pageIdx, setPageIdx] = useState(0);
  const [selectedExtras, setSelectedExtras] = useState<number[]>([]);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  const toggleExtra = (i: number) =>
    setSelectedExtras((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
    );

  const base = 200;
  const total = base + pages[pageIdx].price + selectedExtras.reduce((acc, i) => acc + extras[i].price, 0);

  return (
    <section id="calculator" className="section-padding" ref={ref} style={{ background: "#000" }}>
      <div className="container mx-auto px-6 md:px-10 max-w-3xl">
        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5 }}
          className="text-xs font-bold tracking-[0.2em] text-[#1d4ed8] uppercase mb-16"
        >
          — КАЛКУЛАТОР
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="border rounded-2xl p-8 md:p-12"
          style={{ borderColor: "rgba(255,255,255,0.08)" }}
        >
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-10">
            Изчислете цената на вашия сайт
          </h2>

          {/* Pages */}
          <div className="mb-8">
            <p className="text-xs font-semibold tracking-widest text-white/30 uppercase mb-4">
              Брой страници
            </p>
            <div className="flex flex-wrap gap-3">
              {pages.map((p, i) => (
                <button
                  key={p.label}
                  onClick={() => setPageIdx(i)}
                  className="px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200"
                  style={{
                    border: `1px solid ${pageIdx === i ? "#1d4ed8" : "rgba(255,255,255,0.1)"}`,
                    background: pageIdx === i ? "rgba(29,78,216,0.12)" : "transparent",
                    color: pageIdx === i ? "#fff" : "rgba(255,255,255,0.4)",
                  }}
                >
                  {p.label}{p.price > 0 ? ` (+€${p.price})` : ""}
                </button>
              ))}
            </div>
          </div>

          {/* Extras */}
          <div className="mb-10">
            <p className="text-xs font-semibold tracking-widest text-white/30 uppercase mb-4">
              Допълнителни функции
            </p>
            <div className="space-y-3">
              {extras.map((e, i) => (
                <div key={e.label}>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div
                      className="w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors duration-200"
                      style={{
                        borderColor: selectedExtras.includes(i) ? "#1d4ed8" : "rgba(255,255,255,0.2)",
                        background: selectedExtras.includes(i) ? "#1d4ed8" : "transparent",
                      }}
                      onClick={() => toggleExtra(i)}
                    >
                      {selectedExtras.includes(i) && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <span
                      className="text-sm transition-colors duration-200"
                      style={{ color: selectedExtras.includes(i) ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.4)" }}
                      onClick={() => toggleExtra(i)}
                    >
                      {e.label}
                      {e.price > 0 && <span className="ml-1 text-white/25">(+€{e.price})</span>}
                      {e.price === 0 && e.note && !e.note.includes("месец") && (
                        <span className="ml-1 text-[#1d4ed8] text-xs">({e.note})</span>
                      )}
                    </span>
                  </label>
                  {e.note && e.note.includes("месец") && (
                    <p className="text-xs text-white/20 ml-7 mt-1 italic">{e.note}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Result */}
          <div
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pt-8"
            style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div>
              <p className="text-xs text-white/25 uppercase tracking-widest mb-2">Приблизителна цена</p>
              <p className="text-5xl font-extrabold text-white">€{total}</p>
            </div>
            <button
              onClick={() => document.querySelector("#contact")?.scrollIntoView({ behavior: "smooth" })}
              className="flex items-center gap-2 px-6 py-3 rounded-full border border-white/15 text-white text-sm font-semibold hover:bg-white hover:text-black transition-all duration-300 whitespace-nowrap"
            >
              Поискайте оферта <ArrowRight size={16} />
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CalculatorSection;
```

- [ ] **Step 3: Verify build**

```bash
cd "/Users/angelborisov/AB Intelligence/Clients/ab-intelligence-portfolio"
npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
cd "/Users/angelborisov/AB Intelligence/Clients/ab-intelligence-portfolio"
git add src/components/PricingSection.tsx src/components/CalculatorSection.tsx
git commit -m "feat: pricing and calculator flat minimal dark style"
```

---

### Task 8: ContactSection + Footer — huge heading, single-row footer

**Files:**
- Modify: `src/components/ContactSection.tsx`
- Modify: `src/components/Footer.tsx`

- [ ] **Step 1: Rewrite ContactSection.tsx**

Replace entire file with:

```tsx
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Send } from "lucide-react";
import { useForm, ValidationError } from "@formspree/react";

const serviceOptions = [
  "Уеб дизайн / Web Design",
  "SEO Оптимизация / SEO Optimization",
  "Онлайн магазин / E-Commerce",
  "Поддръжка / Maintenance",
  "Брандинг / Branding",
];

const inputClass =
  "w-full px-0 py-4 bg-transparent border-b text-white text-sm placeholder-white/20 focus:outline-none transition-colors duration-200";

const ContactSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [state, handleSubmit] = useForm("xvzvdero");

  return (
    <section id="contact" className="section-padding" ref={ref} style={{ background: "#000" }}>
      <div className="container mx-auto px-6 md:px-10">
        {/* Huge heading */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mb-20"
        >
          <p className="text-xs font-bold tracking-[0.2em] text-[#1d4ed8] uppercase mb-8">
            — КОНТАКТИ
          </p>
          <h2 className="text-[clamp(2.5rem,6vw,5rem)] font-extrabold text-white leading-tight max-w-3xl">
            Свържете се<br />с нас.
          </h2>
          <div className="flex flex-col sm:flex-row gap-6 mt-8 text-white/40 text-sm">
            <a href="mailto:info@abintelligence.org" className="hover:text-white transition-colors">
              info@abintelligence.org
            </a>
            <span className="hidden sm:block text-white/15">|</span>
            <span>София, България</span>
            <span className="hidden sm:block text-white/15">|</span>
            <span>Пон–Пет: 9:00–18:00</span>
          </div>
        </motion.div>

        {/* Form */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-2xl"
        >
          {state.succeeded ? (
            <div className="py-16 text-center">
              <p className="text-4xl font-extrabold text-white mb-4">Благодарим ви!</p>
              <p className="text-white/40">Получихме вашето съобщение. Ще се свържем с вас скоро.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-0">
              {[
                { name: "name", type: "text", placeholder: "Вашето ime", required: true },
                { name: "email", type: "email", placeholder: "email@example.com", required: true },
                { name: "phone", type: "tel", placeholder: "+359...", required: false },
              ].map((field) => (
                <div key={field.name} style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <input
                    name={field.name}
                    type={field.type}
                    required={field.required}
                    placeholder={field.placeholder}
                    className={inputClass}
                    style={{ borderColor: "rgba(255,255,255,0.08)" }}
                    onFocus={(e) => (e.target.style.borderColor = "#1d4ed8")}
                    onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
                  />
                  <ValidationError field={field.name} errors={state.errors} className="text-red-400 text-xs mt-1" />
                </div>
              ))}

              <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <select
                  name="service"
                  className={inputClass}
                  style={{ borderColor: "rgba(255,255,255,0.08)" }}
                  onFocus={(e) => (e.target.style.borderColor = "#1d4ed8")}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
                >
                  <option value="" style={{ background: "#000" }}>Изберете услуга...</option>
                  {serviceOptions.map((opt) => (
                    <option key={opt} value={opt} style={{ background: "#000" }}>{opt}</option>
                  ))}
                </select>
              </div>

              <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <textarea
                  name="message"
                  required
                  rows={4}
                  placeholder="Разкажете ни за вашия проект..."
                  className={inputClass + " resize-none"}
                  style={{ borderColor: "rgba(255,255,255,0.08)" }}
                  onFocus={(e) => (e.target.style.borderColor = "#1d4ed8")}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
                />
                <ValidationError field="message" errors={state.errors} className="text-red-400 text-xs mt-1" />
              </div>

              <div className="pt-8">
                <button
                  type="submit"
                  disabled={state.submitting}
                  className="flex items-center gap-3 px-8 py-4 rounded-full bg-white text-black text-sm font-bold hover:bg-white/90 transition-colors disabled:opacity-40"
                >
                  <Send size={16} />
                  {state.submitting ? "Изпращане..." : "Изпрати съобщение"}
                </button>
              </div>

              <ValidationError errors={state.errors} />
            </form>
          )}
        </motion.div>
      </div>
    </section>
  );
};

export default ContactSection;
```

- [ ] **Step 2: Rewrite Footer.tsx**

Replace entire file with:

```tsx
const Footer = () => (
  <footer
    className="py-8 px-6 md:px-10"
    style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "#000" }}
  >
    <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
      <p className="text-sm font-bold text-white/70">АБИ — AB Intelligence</p>
      <p className="text-xs text-white/25">
        © {new Date().getFullYear()} АБИ. Всички права запазени.
      </p>
      <div className="flex items-center gap-6">
        <a
          href="https://www.facebook.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-white/25 hover:text-white transition-colors"
        >
          Facebook
        </a>
        <a
          href="https://www.instagram.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-white/25 hover:text-white transition-colors"
        >
          Instagram
        </a>
      </div>
    </div>
  </footer>
);

export default Footer;
```

- [ ] **Step 3: Verify build**

```bash
cd "/Users/angelborisov/AB Intelligence/Clients/ab-intelligence-portfolio"
npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
cd "/Users/angelborisov/AB Intelligence/Clients/ab-intelligence-portfolio"
git add src/components/ContactSection.tsx src/components/Footer.tsx
git commit -m "feat: contact huge heading flat form, footer single-row minimal"
```

---

### Task 9: Final — run dev server and visual check

**Files:** none

- [ ] **Step 1: Start dev server**

```bash
cd "/Users/angelborisov/AB Intelligence/Clients/ab-intelligence-portfolio"
npm run dev
```

Expected: server starts at `http://localhost:8080` or `http://localhost:5173`

- [ ] **Step 2: Visual checklist**

Open `http://localhost:5173` and verify:
- [ ] Background is pure black throughout
- [ ] Navbar stays black on scroll, has "Свържете се" CTA button
- [ ] Hero headline animates word-by-word, no mockup card visible
- [ ] Services section shows numbered rows (01–05), hover reveals description
- [ ] About section has two-column layout with bold statement
- [ ] Pricing card has no glow/glass effect, blue hover border
- [ ] Calculator has flat pill buttons, result shown large
- [ ] Contact has huge heading, underline-border inputs
- [ ] Footer is single row
- [ ] Grain texture visible (very subtle) on all sections
- [ ] Mobile menu opens full-screen black overlay

- [ ] **Step 3: Final commit**

```bash
cd "/Users/angelborisov/AB Intelligence/Clients/ab-intelligence-portfolio"
git add -A
git commit -m "feat: complete Metalab-inspired visual overhaul — black theme, editorial typography, horizontal service rows"
```
