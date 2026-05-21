"use client";

import React, { useState, useEffect } from 'react';
import { Joyride, CallBackProps, STATUS, Step, EVENTS } from 'react-joyride';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { User } from 'firebase/auth';
import { useLanguage } from '../i18n/LanguageContext';

interface TutorialModalProps {
  onComplete: () => void;
  user: User | null;
  userData?: any;
}

// Global variable to ensure it only runs once per session regardless of localStorage
let sessionTutorialSeen = false;

export function TutorialModal({ onComplete, user, userData }: TutorialModalProps) {
  const { t } = useLanguage();
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
            const userRef = doc(db, 'users', user.uid);
            setDoc(userRef, { hasSeenTutorial: true }, { merge: true }).catch(e => console.error(e));
          }
        }, 500);
      } catch (error) {
        console.error("Error checking tutorial status:", error);
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
      title: t.tutorial.welcomeTitle,
      content: t.tutorial.welcomeContent,
      disableBeacon: true,
    },
    {
      target: '#tutorial-reglas',
      title: t.tutorial.rulesTitle,
      content: t.tutorial.rulesContent,
      disableBeacon: true,
    },
    {
      target: '#tutorial-predicciones',
      title: t.tutorial.predictionsTitle,
      content: t.tutorial.predictionsContent,
      disableBeacon: true,
    },
    {
      target: '#tutorial-ranking',
      title: t.tutorial.rankingTitle,
      content: t.tutorial.rankingContent,
      disableBeacon: true,
    },
    {
      target: '#tutorial-reportes',
      title: t.tutorial.reportsTitle,
      content: t.tutorial.reportsContent,
      disableBeacon: true,
    }
  ];

  const handleJoyrideCallback = async (data: CallBackProps) => {
    const { status, action, type } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status) || action === 'close' || type === EVENTS.TOUR_END) {
      setRun(false);
      sessionTutorialSeen = true;

      if (user) {
        localStorage.setItem(`hasSeenTutorialV7_${user.uid}`, 'true');
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
        back: t.tutorial.back,
        close: t.tutorial.close,
        last: t.tutorial.last,
        next: t.tutorial.next,
        skip: t.tutorial.skip,
      }}
    />
  );
}
