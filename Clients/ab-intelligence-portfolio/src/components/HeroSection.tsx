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
          <span className="text-xs text-white/30 tracking-widest uppercase">Scroll</span>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
