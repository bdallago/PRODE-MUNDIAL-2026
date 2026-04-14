"use client";

import { useState, useEffect } from "react";
import { Clock, Lock } from "lucide-react";

const DEADLINE = new Date('2026-06-08T00:00:00').getTime();

export function CountdownBanner() {
  const [timeLeft, setTimeLeft] = useState(DEADLINE - Date.now());
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = DEADLINE - Date.now();
      setTimeLeft(remaining);
      if (remaining <= 0 && !isLocked) {
        setIsLocked(true);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isLocked]);

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
    return (
      <div className="bg-red-50 text-red-900 p-4 rounded-lg shadow-sm flex items-center gap-3 border border-red-200 mb-6">
        <Lock className="w-6 h-6 text-red-600" />
        <div>
          <h3 className="font-bold">¡Tiempo Agotado!</h3>
          <p className="text-sm">La fecha límite ha pasado. Todas las predicciones han sido fijadas automáticamente.</p>
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
        <Clock className="w-6 h-6 text-white/80" />
        <div>
          <h3 className="font-bold text-lg">Tiempo restante para fijar predicciones</h3>
          <p className="text-white/70 text-sm">El 7 de Junio de 2026 es el último día para fijar elecciones.</p>
        </div>
      </div>
      <div suppressHydrationWarning className="text-2xl font-mono font-bold bg-black/20 px-4 py-2 rounded-md border border-white/10 text-center">
        {formatTime(timeLeft)}
      </div>
    </div>
  );
}
