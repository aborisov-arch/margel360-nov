import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";

const testimonials = [
  {
    name: "Иван Петров",
    role: "Собственик на ресторант",
    text: "AB Intelligence ни направиха невероятен сайт! Клиентите ни вече правят резервации онлайн и бизнесът ни расте.",
    stars: 5,
  },
  {
    name: "Мария Георгиева",
    role: "Управител на онлайн магазин",
    text: "Професионализъм и внимание към детайлите. Нашият онлайн магазин работи перфектно благодарение на тях.",
    stars: 5,
  },
  {
    name: "Георги Димитров",
    role: "Основател на стартъп",
    text: "Бързо, качествено и на достъпна цена. Препоръчвам ги на всеки, който търси уеб дизайн в София.",
    stars: 5,
  },
  {
    name: "Елена Тодорова",
    role: "Маркетинг мениджър",
    text: "SEO оптимизацията, която направиха, увеличи трафика ни с 200%. Наистина знаят какво правят!",
    stars: 5,
  },
];

const TestimonialsSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCurrent((c) => (c + 1) % testimonials.length), 5000);
    return () => clearInterval(timer);
  }, []);

  const t = testimonials[current];

  return (
    <section id="testimonials" className="section-padding" ref={ref}>
      <div className="container mx-auto max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-2">Какво казват нашите клиенти</h2>
          <p className="text-muted-foreground">What Our Clients Say</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="border border-white/10 rounded-2xl p-8 md:p-12 text-center relative"
        >
          <div className="flex justify-center gap-1 mb-4">
            {Array.from({ length: t.stars }).map((_, i) => (
              <Star key={i} size={20} className="fill-yellow-400 text-yellow-400" />
            ))}
          </div>
          <p className="text-lg md:text-xl mb-6 leading-relaxed text-foreground/90 min-h-[80px]">
            "{t.text}"
          </p>
          <p className="font-bold">{t.name}</p>
          <p className="text-sm text-muted-foreground">{t.role}</p>

          <div className="flex justify-center gap-4 mt-8">
            <button
              onClick={() => setCurrent((c) => (c - 1 + testimonials.length) % testimonials.length)}
              className="p-2 rounded-full border border-border hover:border-primary transition-colors"
              aria-label="Previous testimonial"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-2">
              {testimonials.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === current ? "bg-primary w-6" : "bg-muted"
                  }`}
                />
              ))}
            </div>
            <button
              onClick={() => setCurrent((c) => (c + 1) % testimonials.length)}
              className="p-2 rounded-full border border-border hover:border-primary transition-colors"
              aria-label="Next testimonial"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
