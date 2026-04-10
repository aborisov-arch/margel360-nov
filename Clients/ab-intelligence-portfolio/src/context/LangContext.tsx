import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { t } from "../lib/translations";
import type { Lang } from "../lib/translations";

interface LangContextType {
  lang: Lang;
  toggle: () => void;
  tr: (typeof t)[Lang];
}

const LangContext = createContext<LangContextType | null>(null);

export const LangProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLang] = useState<Lang>("bg");
  const toggle = () => setLang((l) => (l === "bg" ? "en" : "bg"));
  return (
    <LangContext.Provider value={{ lang, toggle, tr: t[lang] }}>
      {children}
    </LangContext.Provider>
  );
};

export const useLang = () => {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used inside LangProvider");
  return ctx;
};
