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
