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
