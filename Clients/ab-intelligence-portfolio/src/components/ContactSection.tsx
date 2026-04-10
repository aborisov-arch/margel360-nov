import { motion, useInView, AnimatePresence } from "framer-motion";
import { useRef, useState } from "react";
import { Send, ChevronDown } from "lucide-react";
import { useForm, ValidationError } from "@formspree/react";
import { useLang } from "../context/LangContext";

const GOLD = "#c9a84c";

const inputClass =
  "w-full px-0 py-4 bg-transparent border-b text-white text-sm placeholder-white/20 focus:outline-none transition-colors duration-200";

const ContactSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [state, handleSubmit] = useForm("xvzvdero");
  const { tr } = useLang();
  const [serviceOpen, setServiceOpen] = useState(false);
  const [selectedService, setSelectedService] = useState("");

  return (
    <section id="contact" className="section-padding" ref={ref} style={{ background: "#000" }}>
      <div className="container mx-auto px-6 md:px-10">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mb-20"
        >
          <p className="text-xs font-bold tracking-[0.2em] uppercase mb-8" style={{ color: GOLD }}>
            {tr.contact.label}
          </p>
          <h2 className="text-[clamp(2.5rem,6vw,5rem)] font-extrabold leading-tight max-w-3xl" style={{ color: GOLD }}>
            {tr.contact.heading1}<br />
            {tr.contact.heading2}
          </h2>

          {/* Contact info — gold */}
          <div className="flex flex-col sm:flex-row gap-6 mt-8 text-sm" style={{ color: GOLD }}>
            <a
              href="mailto:info@abintelligence.org"
              className="hover:opacity-70 transition-opacity"
              style={{ color: GOLD }}
            >
              info@abintelligence.org
            </a>
            <span className="hidden sm:block opacity-20">|</span>
            <span>{tr.contact.city}</span>
            <span className="hidden sm:block opacity-20">|</span>
            <span>{tr.contact.hours}</span>
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
              <p className="text-4xl font-extrabold text-white mb-4">{tr.contact.successTitle}</p>
              <p className="text-white/40">{tr.contact.successBody}</p>
            </div>
          ) : (
            <form onSubmit={(e) => {
              // inject selected service before submit
              handleSubmit(e);
            }} className="space-y-0">
              {/* Hidden input for custom select value */}
              <input type="hidden" name="service" value={selectedService} />

              {[
                { name: "name", type: "text", placeholder: tr.contact.namePlaceholder, required: true },
                { name: "email", type: "email", placeholder: tr.contact.emailPlaceholder, required: true },
                { name: "phone", type: "tel", placeholder: tr.contact.phonePlaceholder, required: false },
              ].map((field) => (
                <div key={field.name} style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <input
                    name={field.name}
                    type={field.type}
                    required={field.required}
                    placeholder={field.placeholder}
                    className={inputClass}
                    onFocus={(e) => (e.target.style.borderColor = GOLD)}
                    onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
                  />
                  <ValidationError field={field.name} errors={state.errors} className="text-red-400 text-xs mt-1" />
                </div>
              ))}

              {/* Custom service selector */}
              <div className="relative" style={{ borderBottom: `1px solid ${serviceOpen ? GOLD : "rgba(255,255,255,0.08)"}`, transition: "border-color 0.2s" }}>
                <button
                  type="button"
                  onClick={() => setServiceOpen(!serviceOpen)}
                  className="w-full flex items-center justify-between py-4 text-sm text-left focus:outline-none"
                  style={{ background: "transparent", color: selectedService ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.2)" }}
                >
                  <span>{selectedService || tr.contact.serviceDefault}</span>
                  <motion.span animate={{ rotate: serviceOpen ? 180 : 0 }} transition={{ duration: 0.25 }}>
                    <ChevronDown size={14} style={{ color: serviceOpen ? GOLD : "rgba(255,255,255,0.2)" }} />
                  </motion.span>
                </button>

                <AnimatePresence>
                  {serviceOpen && (
                    <motion.ul
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                      className="absolute left-0 right-0 z-20 mt-1 overflow-hidden"
                      style={{
                        background: "#0a0a0a",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: "12px",
                      }}
                    >
                      {tr.contact.serviceOptions.map((opt, i) => (
                        <motion.li
                          key={opt}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04, duration: 0.2 }}
                        >
                          <button
                            type="button"
                            onClick={() => { setSelectedService(opt); setServiceOpen(false); }}
                            className="w-full text-left px-5 py-3.5 text-sm transition-all duration-150 group flex items-center gap-3"
                            style={{
                              color: selectedService === opt ? "#fff" : "rgba(255,255,255,0.4)",
                              background: selectedService === opt ? "rgba(201,168,76,0.08)" : "transparent",
                              borderBottom: i < tr.contact.serviceOptions.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = "#fff";
                              e.currentTarget.style.background = "rgba(201,168,76,0.06)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = selectedService === opt ? "#fff" : "rgba(255,255,255,0.4)";
                              e.currentTarget.style.background = selectedService === opt ? "rgba(201,168,76,0.08)" : "transparent";
                            }}
                          >
                            <span
                              className="w-1 h-1 rounded-full shrink-0"
                              style={{ background: selectedService === opt ? GOLD : "rgba(255,255,255,0.15)" }}
                            />
                            {opt}
                          </button>
                        </motion.li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>

              <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <textarea
                  name="message"
                  required
                  rows={4}
                  placeholder={tr.contact.messagePlaceholder}
                  className={inputClass + " resize-none"}
                  onFocus={(e) => (e.target.style.borderColor = GOLD)}
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
                  {state.submitting ? tr.contact.submitting : tr.contact.submit}
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
