"use client";

import { useState, useEffect } from "react";
import { Trophy } from "lucide-react";

const WORLD_CUP_START = new Date('2026-06-11T00:00:00').getTime();

export function WorldCupBanner() {
  const [timeLeft, setTimeLeft] = useState(WORLD_CUP_START - Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(WORLD_CUP_START - Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const isTimeUp = timeLeft <= 0;

  const formatTime = (ms: number) => {
    if (ms <= 0) return "00 Días 00h 00m 00s";
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    return `${days} Días ${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
  };

  if (isTimeUp) {
    return null; // Don't show anything once it started, or maybe show a "¡El Mundial ha comenzado!" banner. For now, hide it.
  }

  return (
    <div 
      className="text-white p-4 rounded-lg shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 border-l-4 mb-6"
      style={{ backgroundColor: 'var(--brand-color, #312e81)', borderColor: 'rgba(255,255,255,0.3)' }}
    >
      <div className="flex items-center gap-3">
        <Trophy className="w-6 h-6 text-white/80" />
        <div>
          <h3 className="font-bold text-lg">Tiempo restante para el Mundial</h3>
          <p className="text-white/70 text-sm">El 11 de Junio de 2026 comienza la Copa del Mundo.</p>
        </div>
      </div>
      <div suppressHydrationWarning className="text-2xl font-mono font-bold bg-black/20 px-4 py-2 rounded-md border border-white/10 text-center">
        {formatTime(timeLeft)}
      </div>
    </div>
  );
}
