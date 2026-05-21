"use client";

import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { BookOpen, Trophy, Target, AlertCircle, Save, Lock } from "lucide-react";
import { CountdownBanner } from "../components/CountdownBanner";
import { useLanguage } from "../i18n/LanguageContext";

export default function Instructions() {
  const { t } = useLanguage();

  const steps = [
    { icon: Target, title: t.instructions.step1Title, text: t.instructions.step1Text },
    { icon: Save, title: t.instructions.step2Title, text: t.instructions.step2Text },
    { icon: Lock, title: t.instructions.step3Title, text: t.instructions.step3Text },
  ];

  const scoring = [
    { label: t.instructions.score1Label, pts: t.instructions.score1Pts, desc: t.instructions.score1Desc },
    { label: t.instructions.score2Label, pts: t.instructions.score2Pts, desc: t.instructions.score2Desc },
    { label: t.instructions.score3Label, pts: t.instructions.score3Pts, desc: t.instructions.score3Desc },
    { label: t.instructions.score4Label, pts: t.instructions.score4Pts, desc: t.instructions.score4Desc },
    { label: t.instructions.score5Label, pts: t.instructions.score5Pts, desc: t.instructions.score5Desc },
    { label: t.instructions.score6Label, pts: t.instructions.score6Pts, desc: t.instructions.score6Desc },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 px-4 sm:px-6 py-6 md:py-8">
      <CountdownBanner />
      <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-6 rounded-lg shadow-sm border border-gray-100 text-center md:text-left">
        <div className="p-3 rounded-full shrink-0" style={{ backgroundColor: 'color-mix(in srgb, var(--brand-color, #2563eb) 10%, white)' }}>
          <BookOpen className="w-8 h-8" style={{ color: 'var(--brand-color, #2563eb)' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.instructions.title}</h1>
          <p className="text-gray-900 mt-1">{t.instructions.subtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {steps.map((step, i) => (
          <Card key={i} className="border-none shadow-sm bg-white">
            <CardContent className="p-4 flex flex-col items-center text-center">
              <step.icon className="w-6 h-6 mb-2 text-brand" />
              <h3 className="font-bold text-gray-800">{step.title}</h3>
              <p className="text-xs text-gray-900 mt-1">{step.text}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-none shadow-lg overflow-hidden">
        <CardHeader className="bg-brand text-white py-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="w-5 h-5" /> {t.instructions.pointsTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-gray-100">
            {scoring.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                <div className="flex-1">
                  <h4 className="font-bold text-gray-800 text-sm">{item.label}</h4>
                  <p className="text-xs text-gray-900 whitespace-pre-wrap">{item.desc}</p>
                </div>
                <span className="font-black text-brand bg-brand/10 px-3 py-1 rounded-full text-sm ml-4">
                  {item.pts}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl flex gap-3 items-start">
        <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
        <div className="text-sm text-yellow-800 space-y-2">
          <p className="font-bold">{t.instructions.deadlineTitle}</p>
          <div className="flex flex-col gap-1">
            <p>
              {t.instructions.deadline1Icon} <strong>{t.instructions.deadline1Bold}</strong>{' '}
              {t.instructions.deadline1Text} <strong>{t.instructions.deadline1Date}</strong>{' '}
              {t.instructions.deadline1Rest}
            </p>
            <p>
              {t.instructions.deadline2Icon} <strong>{t.instructions.deadline2Bold}</strong>{' '}
              {t.instructions.deadline2Text} <strong>{t.instructions.deadline2Date}</strong>{' '}
              {t.instructions.deadline2Rest}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
