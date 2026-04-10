import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { useLang } from "../context/LangContext";

const AboutSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const { tr } = useLang();

  return (
    <section id="about" className="section-padding" ref={ref} style={{ background: "#000" }}>
      <div className="container mx-auto px-6 md:px-10">
        {/* Label */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5 }}
          className="text-xs font-bold tracking-[0.2em] text-[#c9a84c] uppercase mb-16"
        >
          {tr.about.label}
        </motion.p>

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-start">
          {/* Left: bold statement */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <h2 className="text-3xl md:text-5xl font-extrabold text-white leading-tight">
              {tr.about.heading1}<br />
              {tr.about.heading2}<br />
              {tr.about.heading3}
            </h2>
          </motion.div>

          {/* Right: divider + text */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="lg:pt-3"
          >
            <div className="w-8 h-px bg-[#c9a84c] mb-8" />
            <p className="text-base md:text-lg text-white/50 leading-relaxed mb-6">
              {tr.about.p1}
            </p>
            <p className="text-base text-white/35 leading-relaxed">
              {tr.about.p2}
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
