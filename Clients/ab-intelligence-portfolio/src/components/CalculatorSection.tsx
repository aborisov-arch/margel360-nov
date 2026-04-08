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

const CalculatorSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [pageIdx, setPageIdx] = useState(0);
  const [selectedExtras, setSelectedExtras] = useState<number[]>([]);

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
                  <label className="flex items-center gap-3 cursor-pointer">
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
