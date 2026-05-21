"use client";

import { useState, useRef, useEffect } from "react";
import { Settings } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";

export function LanguageSelector({ light = false }: { light?: boolean }) {
  const { lang, setLang, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const textClass = light
    ? "text-white hover:bg-white/20"
    : "text-gray-700 hover:bg-gray-100";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-semibold transition-colors ${textClass}`}
        title={t.language.label}
      >
        <Settings className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{t.language.label}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-[200] min-w-[130px] bg-white border border-gray-200 rounded-lg shadow-lg py-1 overflow-hidden">
          <button
            onClick={() => { setLang("es"); setOpen(false); }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors ${lang === "es" ? "font-bold text-brand" : "text-gray-700"}`}
          >
            <span>🇦🇷</span> {t.language.spanish}
            {lang === "es" && <span className="ml-auto text-brand text-xs">✓</span>}
          </button>
          <button
            onClick={() => { setLang("en"); setOpen(false); }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors ${lang === "en" ? "font-bold text-brand" : "text-gray-700"}`}
          >
            <span>🇺🇸</span> {t.language.english}
            {lang === "en" && <span className="ml-auto text-brand text-xs">✓</span>}
          </button>
        </div>
      )}
    </div>
  );
}
