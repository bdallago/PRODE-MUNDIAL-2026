"use client";

import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { Button } from './ui/button';
import { useRouter, usePathname } from 'next/navigation';

interface TutorialModalProps {
  onComplete: () => void;
}

export function TutorialModal({ onComplete }: TutorialModalProps) {
  const [step, setStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Check if the user has already seen the tutorial
    const hasSeenTutorial = localStorage.getItem('hasSeenTutorial');
    if (!hasSeenTutorial) {
      setIsVisible(true);
    }
  }, []);

  const tutorialSteps = [
    {
      path: '/',
      title: "¡Bienvenido a El Prode Mundial 2026!",
      content: "Te vamos a dar un recorrido rápido por las pestañas para que sepas cómo jugar. Estás en el Inicio, donde verás el resumen de tu empresa.",
      image: "🏠"
    },
    {
      path: '/instructions',
      title: "Reglas del Juego",
      content: "Acá te explicamos detalladamente cómo se suman los puntos. ¡Leelas con atención para planear tu estrategia!",
      image: "📖"
    },
    {
      path: '/predictions',
      title: "Tus Predicciones",
      content: "Acá ocurre la magia. Vas a completar:\n• Fase de Grupos\n• Preguntas Especiales\n• Resultados por partido\n• Fase Eliminatoria",
      image: "✍️"
    },
    {
      path: '/predictions',
      title: "Guardar vs. Fijar",
      content: "Podés 'Guardar Borrador' mientras pensás. Pero para participar oficialmente tenés que 'Fijar Predicciones'. ¡Una vez fijadas no se pueden cambiar!",
      image: "🔒"
    },
    {
      path: '/dashboard',
      title: "El Ranking",
      content: "Acá vas a ver la tabla de posiciones en vivo, buscar a tus compañeros y ver quién es el experto. ¡Que gane el mejor!",
      image: "📊"
    }
  ];

  // Sync route when step changes
  useEffect(() => {
    if (isVisible && tutorialSteps[step]) {
      if (pathname !== tutorialSteps[step].path) {
        router.push(tutorialSteps[step].path);
      }
    }
  }, [step, isVisible, router, pathname]);

  const handleClose = () => {
    setIsVisible(false);
    localStorage.setItem('hasSeenTutorial', 'true');
    onComplete();
    router.push('/'); // Return to home when finished
  };

  const nextStep = () => {
    if (step < tutorialSteps.length - 1) {
      setStep(step + 1);
    } else {
      handleClose();
    }
  };

  const prevStep = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 left-4 md:left-auto md:w-[400px] z-[100] animate-in slide-in-from-bottom-8 duration-300">
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-200">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-blue-600 text-white">
          <div className="flex gap-1">
            {tutorialSteps.map((_, idx) => (
              <div 
                key={idx} 
                className={`h-1.5 rounded-full transition-all duration-300 ${idx === step ? 'w-6 bg-white' : 'w-2 bg-white/30'}`}
              />
            ))}
          </div>
          <button onClick={handleClose} className="text-white/70 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-3">
            <div className="text-3xl">{tutorialSteps[step].image}</div>
            <h2 className="text-xl font-bold text-gray-900">{tutorialSteps[step].title}</h2>
          </div>
          <p className="text-gray-600 whitespace-pre-line text-sm leading-relaxed">
            {tutorialSteps[step].content}
          </p>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 text-xs"
          >
            Omitir
          </Button>
          
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={prevStep}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
            )}
            <Button 
              size="sm"
              onClick={nextStep}
              className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1"
            >
              {step === tutorialSteps.length - 1 ? (
                <>Finalizar <Check className="w-3 h-3" /></>
              ) : (
                <>Siguiente <ChevronRight className="w-3 h-3" /></>
              )}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
