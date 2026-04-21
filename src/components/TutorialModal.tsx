"use client";

import React, { useState, useEffect } from 'react';
import { Joyride, CallBackProps, STATUS, Step, EVENTS } from 'react-joyride';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { User } from 'firebase/auth';

interface TutorialModalProps {
  onComplete: () => void;
  user: User | null;
  userData?: any;
}

// Global variable to ensure it only runs once per session regardless of localStorage
let sessionTutorialSeen = false;

export function TutorialModal({ onComplete, user, userData }: TutorialModalProps) {
  const [run, setRun] = useState(false);

  useEffect(() => {
    const checkTutorialStatus = async () => {
      if (!user) return;
      if (sessionTutorialSeen) return;

      // Check local storage first for quick response
      const localStatus = localStorage.getItem(`hasSeenTutorialV7_${user.uid}`);
      if (localStatus === 'true' || userData?.hasSeenTutorial) {
        sessionTutorialSeen = true;
        if (!localStatus) localStorage.setItem(`hasSeenTutorialV7_${user.uid}`, 'true');
        return;
      }

      try {

        // If not seen, show tutorial
        setTimeout(() => {
          if (!sessionTutorialSeen) {
            setRun(true);
            sessionTutorialSeen = true;
            localStorage.setItem(`hasSeenTutorialV7_${user.uid}`, 'true');
            // Also save to Firestore immediately
            const userRef = doc(db, 'users', user.uid);
            setDoc(userRef, { hasSeenTutorial: true }, { merge: true }).catch(e => console.error(e));
          }
        }, 500);
      } catch (error) {
        console.error("Error checking tutorial status:", error);
        // Fallback to showing it if we can't check
        setTimeout(() => {
          if (!sessionTutorialSeen) {
            setRun(true);
            sessionTutorialSeen = true;
            localStorage.setItem(`hasSeenTutorialV7_${user.uid}`, 'true');
          }
        }, 500);
      }
    };

    checkTutorialStatus();
  }, [user]);

  const steps: Step[] = [
    {
      target: 'body',
      placement: 'center',
      title: '¡Bienvenido a El Prode Mundial 2026!',
      content: 'Recorrido rápido por las secciones principales.',
      disableBeacon: true,
    },
    {
      target: '#tutorial-reglas',
      title: '1. Reglas',
      content: 'Conocé cómo se suman los puntos.',
      disableBeacon: true,
    },
    {
      target: '#tutorial-predicciones',
      title: '2. Mis Predicciones',
      content: 'Completá tus pronósticos del torneo.',
      disableBeacon: true,
    },
    {
      target: '#tutorial-ranking',
      title: '3. Ranking',
      content: 'Tabla de posiciones en vivo.',
      disableBeacon: true,
    },
    {
      target: '#tutorial-reportes',
      title: '4. Reportes y Sugerencias',
      content: 'Envianos tus sugerencias o reportá errores.',
      disableBeacon: true,
    }
  ];

  const handleJoyrideCallback = async (data: CallBackProps) => {
    const { status, action, type } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    // Catch any event that indicates the tour is ending or closed
    if (finishedStatuses.includes(status) || action === 'close' || type === EVENTS.TOUR_END) {
      setRun(false);
      sessionTutorialSeen = true;
      
      if (user) {
        // Save locally immediately
        localStorage.setItem(`hasSeenTutorialV7_${user.uid}`, 'true');
        
        // Save to Firestore
        try {
          const userRef = doc(db, 'users', user.uid);
          await setDoc(userRef, { hasSeenTutorial: true }, { merge: true });
        } catch (error) {
          console.error("Error saving tutorial status to Firestore:", error);
        }
      }
      
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
