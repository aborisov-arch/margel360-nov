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
            <div className="py-16">
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
