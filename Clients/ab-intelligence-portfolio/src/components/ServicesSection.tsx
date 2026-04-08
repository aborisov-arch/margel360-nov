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
      className="group border-t cursor-default"
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
          <h3
            className="text-2xl md:text-4xl font-bold leading-tight transition-colors duration-300"
            style={{ color: hovered ? "#fff" : "rgba(255,255,255,0.85)" }}
          >
            {service.title}
          </h3>
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
