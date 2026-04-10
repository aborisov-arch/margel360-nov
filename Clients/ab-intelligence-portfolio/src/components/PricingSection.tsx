import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Check, X } from "lucide-react";
import { useLang } from "../context/LangContext";

const PricingSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const { tr } = useLang();

  return (
    <section id="pricing" className="section-padding" ref={ref} style={{ background: "#000" }}>
      <div className="container mx-auto px-6 md:px-10 max-w-2xl">
        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5 }}
          className="text-xs font-bold tracking-[0.2em] text-[#c9a84c] uppercase mb-16"
        >
          {tr.pricing.label}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="border rounded-2xl p-8 md:p-12 transition-colors duration-300 hover:border-[#c9a84c]/50"
          style={{ borderColor: "rgba(255,255,255,0.08)", background: "#000" }}
        >
          <p className="text-xs font-bold tracking-widest text-white/30 mb-6 uppercase">
            {tr.pricing.packageName}
          </p>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-5xl md:text-6xl font-extrabold text-white">€200</span>
            <span className="text-white/30 text-sm">{tr.pricing.priceNote}</span>
          </div>
          <p className="text-white/40 text-sm mb-10">
            {tr.pricing.tagline}
          </p>

          <div className="space-y-4 mb-10">
            {tr.pricing.features.map((f) => (
              <div key={f.text} className="flex items-center gap-3">
                {f.included ? (
                  <Check size={15} className="shrink-0" style={{ color: "#c9a84c" }} />
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
            {tr.pricing.maintenance}
          </p>

          <button
            onClick={() => document.querySelector("#contact")?.scrollIntoView({ behavior: "smooth" })}
            className="w-full py-4 rounded-full border border-white/15 text-white text-sm font-semibold hover:bg-white hover:text-black transition-all duration-300"
          >
            {tr.pricing.cta}
          </button>
        </motion.div>
      </div>
    </section>
  );
};

export default PricingSection;
