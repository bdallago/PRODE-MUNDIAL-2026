"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { es } from "./es";
import { en } from "./en";

export type Language = "es" | "en";
// Use typeof es as the canonical Translations type
export type Translations = typeof es;

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "es",
  setLang: () => {},
  t: es,
});

function detectLanguage(): Language {
  if (typeof window === "undefined") return "es";
  const saved = localStorage.getItem("prode-lang");
  if (saved === "es" || saved === "en") return saved;
  const browserLang = navigator.language || "";
  return browserLang.toLowerCase().startsWith("es") ? "es" : "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>("es");

  useEffect(() => {
    setLangState(detectLanguage());
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (l: Language) => {
    setLangState(l);
    if (typeof window !== "undefined") {
      localStorage.setItem("prode-lang", l);
    }
  };

  const t = (lang === "es" ? es : en) as unknown as Translations;

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
