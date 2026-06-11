"use client";

import { useState, useEffect } from "react";
import { Clock, Lock } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import { useAppContext } from "./Providers";

// 2026-06-11 00:00 ART — matches config/tournament.deadline in Firestore
const DEFAULT_DEADLINE = 1781146800000;

export function CountdownBanner() {
  const { t, lang } = useLanguage();
  const appContext = useAppContext();
  const deadline: number = appContext?.deadline ?? DEFAULT_DEADLINE;
  const [timeLeft, setTimeLeft] = useState(deadline - Date.now());

  useEffect(() => {
    setTimeLeft(deadline - Date.now());
    const interval = setInterval(() => {
      setTimeLeft(deadline - Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  const isTimeUp = timeLeft <= 0;

  // Last fully-available day: one minute before the deadline, in ART
  const lastDay = new Intl.DateTimeFormat(lang === 'es' ? 'es-AR' : 'en-US', {
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date(deadline - 60000));
  const deadlineDateText = lang === 'es' ? `${lastDay} inclusive` : `${lastDay} (inclusive)`;

  const formatTime = (ms: number) => {
    if (ms <= 0) return `00 ${t.countdown.days} 00h 00m 00s`;
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    return `${days} ${t.countdown.days} ${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
  };

  if (isTimeUp) {
    return (
      <div className="bg-red-50 text-red-900 p-4 rounded-lg shadow-sm flex items-center gap-3 border border-red-200 mb-6">
        <Lock className="w-6 h-6 text-red-600 shrink-0" />
        <div>
          <h3 className="font-bold">{t.countdown.timeUp}</h3>
          <p className="text-sm">{t.countdown.timeUpDesc}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="text-white p-4 rounded-lg shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 border-l-4 mb-6"
      style={{ backgroundColor: 'var(--brand-color, #1e3a8a)', borderColor: 'rgba(255,255,255,0.3)' }}
    >
      <div className="flex items-center gap-3">
        <Clock className="w-6 h-6 text-white/80 shrink-0" />
        <div>
          <h3 className="font-bold text-lg">{t.countdown.title}</h3>
          <p className="text-white/70 text-sm">
            {t.countdown.deadlineText} <strong className="text-white">{deadlineDateText}</strong> {t.countdown.deadlineRest}
          </p>
        </div>
      </div>
      <div suppressHydrationWarning className="text-2xl font-mono font-bold bg-black/20 px-4 py-2 rounded-md border border-white/10 text-center shrink-0">
        {formatTime(timeLeft)}
      </div>
    </div>
  );
}
