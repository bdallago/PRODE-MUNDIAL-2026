"use client";

import React, { useState, useEffect } from 'react';
import { Joyride, CallBackProps, STATUS, Step } from 'react-joyride';

interface TutorialModalProps {
  onComplete: () => void;
}

export function TutorialModal({ onComplete }: TutorialModalProps) {
  const [run, setRun] = useState(false);

  useEffect(() => {
    // Check if the user has already seen the tutorial
    const hasSeenTutorial = localStorage.getItem('hasSeenTutorialV4');
    if (!hasSeenTutorial) {
      // Small delay to ensure elements are rendered
      setTimeout(() => {
        setRun(true);
      }, 500);
    }
  }, []);

  const steps: Step[] = [
    {
      target: 'body',
      placement: 'center',
      title: '¡Bienvenido a El Prode Mundial 2026!',
      content: 'Te vamos a dar un recorrido rápido por las secciones principales para que sepas cómo jugar.',
      disableBeacon: true,
    },
    {
      target: '#tutorial-reglas',
      title: '1. Reglas',
      content: 'Acá te explicamos detalladamente cómo se suman los puntos. ¡Leelas con atención para planear tu estrategia!',
      disableBeacon: true,
    },
    {
      target: '#tutorial-predicciones',
      title: '2. Mis Predicciones',
      content: 'Acá ocurre la magia. Vas a completar la Fase de Grupos, Preguntas Especiales, Resultados por partido y la Fase Eliminatoria.',
      disableBeacon: true,
    },
    {
      target: '#tutorial-ranking',
      title: '3. Ranking',
      content: 'Acá vas a ver la tabla de posiciones en vivo, buscar a tus compañeros y ver quién es el experto. ¡Que gane el mejor!',
      disableBeacon: true,
    },
    {
      target: '#tutorial-reportes',
      title: '4. Reportes y Sugerencias',
      content: 'Si encontrás algún error o tenés una idea para mejorar, podés enviarnos un mensaje desde acá.',
      disableBeacon: true,
    }
  ];

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRun(false);
      localStorage.setItem('hasSeenTutorialV4', 'true');
      onComplete();
    }
  };

  return (
    <Joyride
      callback={handleJoyrideCallback}
      continuous
      hideCloseButton
      run={run}
      scrollToFirstStep
      showProgress
      showSkipButton
      steps={steps}
      styles={{
        options: {
          zIndex: 10000,
          primaryColor: '#2563eb',
        },
      }}
      locale={{
        back: 'Anterior',
        close: 'Cerrar',
        last: 'Finalizar',
        next: 'Siguiente',
        skip: 'Omitir',
      }}
    />
  );
}
