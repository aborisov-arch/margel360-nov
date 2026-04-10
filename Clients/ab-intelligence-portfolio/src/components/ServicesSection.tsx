import { motion, useInView, AnimatePresence } from "framer-motion";
import { useRef, useState } from "react";
import { useLang } from "../context/LangContext";

const GOLD = "#c9a84c";

type ServiceItem = {
  num: string;
  title: string;
  sub: string;
  desc: string;
};

const ServiceRow = ({
  service,
  index,
  inView,
}: {
  service: ServiceItem;
  index: number;
  inView: boolean;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="border-t"
      style={{ borderColor: "rgba(255,255,255,0.08)" }}
    >
      {/* Header row — clickable */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-7 md:py-9 text-left group"
        style={{ background: "transparent" }}
      >
        {/* Left: number + title */}
        <div className="flex items-center gap-5 md:gap-10 flex-1 min-w-0">
          <span
            className="text-xs font-bold tracking-widest shrink-0 transition-colors duration-300"
            style={{ color: open ? GOLD : "rgba(255,255,255,0.25)" }}
          >
            {service.num}
          </span>
          <div className="min-w-0">
            <h3
              className="text-2xl md:text-4xl font-bold leading-tight transition-colors duration-300"
              style={{ color: open ? "#fff" : "rgba(255,255,255,0.85)" }}
            >
              {service.title}
            </h3>
            <p
              className="text-xs mt-1 tracking-widest uppercase"
              style={{ color: GOLD, opacity: open ? 1 : 0.6 }}
            >
              {service.sub}
            </p>
          </div>
        </div>

        {/* Right: plus/minus icon */}
        <div
          className="shrink-0 ml-6 w-8 h-8 flex items-center justify-center rounded-full border transition-all duration-300"
          style={{
            borderColor: open ? GOLD : "rgba(255,255,255,0.15)",
            background: open ? GOLD : "transparent",
          }}
        >
          <motion.span
            animate={{ rotate: open ? 45 : 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="text-white font-light text-lg leading-none"
            style={{ color: open ? "#000" : "#fff" }}
          >
            +
          </motion.span>
        </div>
      </button>

      {/* Expandable content */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div className="pb-8 pl-[calc(1rem+20px+20px)] md:pl-[calc(1rem+40px+20px)]">
              <div
                className="w-8 h-px mb-5"
                style={{ background: GOLD }}
              />
              <p className="text-base text-white/50 leading-relaxed max-w-2xl">
                {service.desc}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const ServicesSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const { tr } = useLang();

  return (
    <section id="services" className="section-padding" ref={ref} style={{ background: "#000" }}>
      <div className="container mx-auto px-6 md:px-10">
        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5 }}
          className="text-xs font-bold tracking-[0.2em] uppercase mb-16"
          style={{ color: GOLD }}
        >
          {tr.services.label}
        </motion.p>

        <div>
          {tr.services.items.map((s, i) => (
            <ServiceRow key={s.num} service={s} index={i} inView={inView} />
          ))}
          <div className="border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }} />
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;
