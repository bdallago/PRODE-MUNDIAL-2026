"use client";

import { useState, useEffect } from "react";
import { User } from "firebase/auth";
import { doc, getDoc, getDocFromCache, getDocFromServer, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { SortableItem } from "../components/SortableItem";
import { DndContext, closestCenter, KeyboardSensor, TouchSensor, MouseSensor, useSensor, useSensors } from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Save, Lock, AlertCircle, CheckCircle2, Calendar, Clock, Bell, Plus, Minus } from "lucide-react";
import { CountdownBanner } from "../components/CountdownBanner";
import { Fixture } from "../components/Fixture";
import { KnockoutBracket } from "../components/knockout/KnockoutBracket";
import { GROUPS, SPECIAL_QUESTIONS, KNOCKOUT_STAGES, ALL_TEAMS, MATCHES, TEAM_FLAGS } from "../data";
import { useLanguage } from "../i18n/LanguageContext";
import { useAppContext } from "../components/Providers";

// 2026-06-11 00:00 ART — matches config/tournament.deadline in Firestore
const DEFAULT_DEADLINE = 1781146800000;

export default function Predictions({ user, companyDetails }: { user: User; companyDetails?: any }) {
  const { t, lang } = useLanguage();
  const { userData } = useAppContext() ?? {};
  const disabledSpecials: string[] = companyDetails?.disabledSpecials ?? [];
  const activeSpecialQuestions = SPECIAL_QUESTIONS.filter(q => !disabledSpecials.includes(q.id));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [confirmLock, setConfirmLock] = useState(false);
  const [activeTab, setActiveTab] = useState<'groups' | 'specials' | 'matches' | 'knockouts'>('groups');
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null);
  const [deadline, setDeadline] = useState(DEFAULT_DEADLINE);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_DEADLINE - Date.now());
  const [hasSavedDoc, setHasSavedDoc] = useState(false);
  const [confirmedGroups, setConfirmedGroups] = useState<string[]>([]);

  // State for predictions
  const [groupPredictions, setGroupPredictions] = useState<Record<string, string[]>>(GROUPS);
  const [specialPredictions, setSpecialPredictions] = useState<Record<string, string>>({});
  const [knockoutPredictions, setKnockoutPredictions] = useState<Record<string, string>>({});
  const [matchPredictions, setMatchPredictions] = useState<Record<string, {home: number | '', away: number | ''}>>({});
  const [actualBracket, setActualBracket] = useState<{
    seedR32: Record<string, [string, string]>;
    winners: Record<string, string>;
    kickoffs: Record<string, number>;
    finishedGroups: string[];
  }>({ seedR32: {}, winners: {}, kickoffs: {}, finishedGroups: [] });
  const [knockoutBanner, setKnockoutBanner] = useState<string | undefined>(undefined);
  
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 4,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch Tournament Config
        const configSnap = await getDoc(doc(db, "config", "tournament"));
        let currentDeadline = DEFAULT_DEADLINE;
        if (configSnap.exists() && configSnap.data().deadline) {
          currentDeadline = configSnap.data().deadline;
          setDeadline(currentDeadline);
        }

        // 2. Fetch User Predictions
        const docRef = doc(db, "predictions", user.uid);
        // Server-first: a stale cached doc must never drive lock state
        let docSnap;
        try {
          docSnap = await getDocFromServer(docRef);
        } catch (serverError) {
          docSnap = await getDocFromCache(docRef);
        }

        if (docSnap.exists()) {
          setHasSavedDoc(true);
          const data = docSnap.data();
          
          // Sanitize groups to ensure they match current GROUPS
          const sanitizedGroups: Record<string, string[]> = {};
          const savedGroups = data.groups || {};
          
          for (const [groupLetter, currentTeams] of Object.entries(GROUPS)) {
            const savedTeams = savedGroups[groupLetter] || [];
            const validSavedTeams = (savedTeams as string[]).filter(t => currentTeams.includes(t));
            const missingTeams = currentTeams.filter(t => !validSavedTeams.includes(t));
            sanitizedGroups[groupLetter] = [...validSavedTeams, ...missingTeams];
          }
          
          setGroupPredictions(sanitizedGroups);
          setSpecialPredictions(data.specials || {});
          setKnockoutPredictions(data.knockouts || {});
          setMatchPredictions(data.matches || {});
          setIsLocked(data.isLocked || false);
          setConfirmedGroups(data.confirmedGroups || Object.keys(GROUPS).filter(g => JSON.stringify(data.groups[g]) !== JSON.stringify(GROUPS[g])));
        } else {
          // Initialize with default order if no prediction exists
          setGroupPredictions(GROUPS);
        }

        // Knockout bracket structure (seeded by the sync)
        try {
          const resultsSnap = await getDoc(doc(db, "results", "actual"));
          if (resultsSnap.exists()) {
            const r = resultsSnap.data();
            const allMatchups: Record<string, [string, string]> = r.bracketMatchups || {};
            const seedR32: Record<string, [string, string]> = {};
            for (const [slotId, pair] of Object.entries(allMatchups)) {
              if (slotId.startsWith("R32-")) seedR32[slotId] = pair as [string, string];
            }
            setActualBracket({
              seedR32,
              winners: r.knockouts || {},
              kickoffs: r.bracketKickoffs || {},
              finishedGroups: r.finishedGroups || [],
            });
          }
          if (configSnap.exists() && configSnap.data().knockoutBanner) {
            setKnockoutBanner(configSnap.data().knockoutBanner);
          }
        } catch (e) {
          console.error("Error fetching bracket structure:", e);
        }
      } catch (error) {
        console.error("Error fetching predictions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user.uid]);

  // Deadline priority: per-user override > per-company override > global deadline
  const effectiveDeadline = userData?.deadlineOverride ?? companyDetails?.deadlineOverride ?? deadline;

  // The countdown only drives the UI lock (isTimeUp); the client never writes
  // isLocked on its own — the Firestore rules enforce the deadline server-side.
  useEffect(() => {
    setTimeLeft(effectiveDeadline - Date.now());
    const interval = setInterval(() => {
      setTimeLeft(effectiveDeadline - Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [effectiveDeadline]);

  const checkMatchLocked = (matchDateStr: string, matchTimeStr: string) => {
    // Note: This relies on matching browser timezone handling to target time, 
    // ideally parsing the date explicitly. We parse the '11 de junio' format and current year.
    // However, given the prompt: "el sistema fija su elección automaticamente cuando falte 1 hora para que se juegue ese partido"
    // We only enforce this on client side inputs. Match format is e.g. "11 de junio", time "16:00".
    const monthMap: Record<string, number> = { 'junio': 5, 'julio': 6 };
    const [dayStr, _, monthStr] = matchDateStr.split(' ');
    const day = parseInt(dayStr, 10);
    const month = monthMap[monthStr?.toLowerCase()] || 5; 
    const [hours, minutes] = matchTimeStr.split(':').map(Number);
    
    // Assuming tournament is 2026 UTC-X, but here we just construct a local date for the time.
    const matchTimestamp = new Date(2026, month, day, hours, minutes).getTime();
    const oneHourBefore = matchTimestamp - (60 * 60 * 1000);
    return Date.now() >= oneHourBefore;
  };
  
  const isTimeUp = timeLeft <= 0;
  const effectiveIsLocked = isLocked || isTimeUp;

  const handleDragEnd = (event: any, groupLetter: string) => {
    if (effectiveIsLocked) return;
    
    // Auto confirm group on drag
    if (!confirmedGroups.includes(groupLetter)) {
      setConfirmedGroups(prev => [...prev, groupLetter]);
    }

    const { active, over } = event;

    if (active && over && active.id !== over.id) {
      setGroupPredictions((prev) => {
        const items = prev[groupLetter];
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        
        return {
          ...prev,
          [groupLetter]: arrayMove(items, oldIndex, newIndex),
        };
      });
    }
  };

  const handleSpecialChange = (id: string, value: string) => {
    if (effectiveIsLocked) return;
    setSpecialPredictions(prev => ({ ...prev, [id]: value }));
  };

  const handleKnockoutPick = (slotId: string, team: string) => {
    setKnockoutPredictions(prev => ({ ...prev, [slotId]: team }));
  };

  const handleMatchScoreIncrement = (matchId: string, team: 'home' | 'away', delta: number, matchDate: string, matchTime: string) => {
    const current = matchPredictions[matchId]?.[team];
    let newVal = typeof current === 'number' ? current + delta : (delta > 0 ? 1 : 0);
    if (newVal < 0) newVal = 0;
    if (newVal > 20) newVal = 20;
    handleMatchChange(matchId, team, newVal.toString(), matchDate, matchTime);
  };

  const handleMatchChange = (matchId: string, team: 'home' | 'away', value: string, matchDate: string, matchTime: string) => {
    if (checkMatchLocked(matchDate, matchTime)) {
      setMessage({ type: 'error', text: t.predictions.errMatchExpired });
      return;
    }
    
    const numValue = value === '' ? '' : parseInt(value, 10);
    if (value !== '' && (isNaN(numValue as number) || (numValue as number) < 0)) return;
    
    setMatchPredictions(prev => {
      const existing = prev[matchId] || { home: '', away: '' };
      const otherTeam = team === 'home' ? 'away' : 'home';
      return {
        ...prev,
        [matchId]: {
          ...existing,
          [team]: numValue,
          [otherTeam]: existing[otherTeam] === '' || existing[otherTeam] === undefined ? 0 : existing[otherTeam],
        }
      };
    });
  };

  // Unified auto-save for all prediction types
  useEffect(() => {
    if (loading) return;

    const timer = setTimeout(() => {
      savePredictionsState(matchPredictions, false, true);
    }, 2000);

    return () => clearTimeout(timer);
  }, [matchPredictions, groupPredictions, specialPredictions, confirmedGroups, knockoutPredictions]);

  const savePredictionsState = async (matchesToSave: any, lock: boolean = false, isAutoSave: boolean = false) => {
    setSaving(true);
    if (!isAutoSave) setMessage(null);
    
    try {
      const docRef = doc(db, "predictions", user.uid);
      const payload: any = {
        uid: user.uid,
        groups: groupPredictions,
        specials: specialPredictions,
        knockouts: knockoutPredictions,
        matches: matchesToSave || matchPredictions,
        confirmedGroups: confirmedGroups,
        updatedAt: new Date().toISOString()
      };
      // Auto-saves never touch isLocked on an existing doc — a stale tab must not
      // re-lock a user the admin unlocked. Only explicit user actions (or the
      // initial doc creation) set the flag.
      if (!isAutoSave) {
        payload.isLocked = lock || effectiveIsLocked;
      } else if (!hasSavedDoc) {
        payload.isLocked = false;
      }
      await setDoc(docRef, payload, { merge: true });
      
      try {
        const userRef = doc(db, "users", user.uid);
        const newStatus = (lock || effectiveIsLocked) ? 'complete' : 'incomplete';
        await setDoc(userRef, { hasSavedPredictions: true, predictionStatus: newStatus }, { merge: true });
      } catch (err) {
        console.error("Error setting hasSavedPredictions flag on user:", err);
      }
      
      if (lock || (effectiveIsLocked && !isAutoSave)) {
        setIsLocked(true);
      }
      setHasSavedDoc(true);
      
      if (!isAutoSave) {
        setMessage({ type: 'success', text: lock ? t.predictions.successLocked : t.predictions.successSaved });
      }
    } catch (error: any) {
      console.error("Error saving predictions:", error);
      if (!isAutoSave) {
        if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
          setMessage({ type: 'error', text: t.predictions.errDeadline });
        } else {
          setMessage({ type: 'error', text: t.predictions.errSave });
        }
      }
    } finally {
      setSaving(false);
      if (!isAutoSave) {
        const timer = setTimeout(() => setMessage(null), 5000);
        return () => clearTimeout(timer);
      }
    }
  };

  const savePredictions = async (lock: boolean = false, matchesOnly: boolean = false) => {
    return savePredictionsState(matchPredictions, lock, matchesOnly);
  };

  const matchesByDate = MATCHES.reduce((acc, match) => {
    if (!acc[match.date]) acc[match.date] = [];
    acc[match.date].push(match);
    return acc;
  }, {} as Record<string, typeof MATCHES[0][]>);

  const sortedDates = Object.keys(matchesByDate).sort();

  if (loading) {
    return <div className="text-center py-10">{t.predictions.loading}</div>;
  }

  const totalGroups = Object.keys(GROUPS).length;
  
  // Calculate progress
  const groupsFilled = confirmedGroups.length;
  const specialsFilled = Object.values(specialPredictions).filter(v => v && v.trim() !== '').length;
  const matchesFilled = Object.values(matchPredictions).filter(m => m.home !== '' && m.away !== '').length;

  const totalSpecials = activeSpecialQuestions.length;
  const totalMatches = MATCHES.length;

  return (
    <div className="max-w-4xl mx-auto py-6 md:py-8">
      <div className="px-4 sm:px-6 mb-8">
        <CountdownBanner />
      </div>

      <div className="px-4 sm:px-6 mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="w-full flex-1">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-gray-900 text-center md:text-left">{t.predictions.title}</h1>
              {saving && (
                <div className="flex items-center gap-2 text-brand animate-pulse">
                  <div className="w-2 h-2 bg-brand rounded-full"></div>
                  <span className="text-[10px] font-bold uppercase tracking-widest">{t.predictions.syncing}</span>
                </div>
              )}
            </div>
            <p className="text-gray-700 mt-2 text-justify md:text-left">
              {effectiveIsLocked ? t.predictions.lockedMsg : t.predictions.draftMsg}
            </p>
          </div>
        </div>
      </div>

      {!effectiveIsLocked && (
        <div className="sticky top-[56px] md:top-[64px] z-40 bg-white py-4 px-4 sm:px-6 border-b border-gray-200 sm:border-none shadow-sm sm:shadow-none flex flex-col sm:flex-row justify-between items-center gap-3 transition-all mb-8">
          <div className="text-sm font-medium text-gray-700 hidden sm:block">
            {t.predictions.progressLabel} {t.predictions.groupsLabel} {groupsFilled}/{totalGroups} | {t.predictions.specialsLabel} {specialsFilled}/{totalSpecials}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button 
              variant="outline" 
              onClick={() => savePredictions(false)}
              disabled={saving}
              className="flex-1 sm:w-auto flex items-center justify-center gap-2 bg-white"
            >
              <Save className="w-4 h-4" /> {saving ? t.predictions.saving : t.predictions.saveDraft}
            </Button>
            <Button 
              onClick={() => setConfirmLock(true)}
              disabled={saving}
              className="flex-1 sm:w-auto flex items-center justify-center gap-2 text-white bg-green-600 hover:bg-green-700 border border-green-600"
            >
              <Lock className="w-4 h-4" /> {t.predictions.lockPredictions}
            </Button>
          </div>
        </div>
      )}

      <div className="px-4 sm:px-6 space-y-8">
      {effectiveIsLocked ? (
        <div className="flex items-center gap-2 text-green-800 bg-green-50 px-4 py-3 rounded-md border border-green-200 justify-center w-full shadow-sm font-medium">
          <Lock className="w-4 h-4" /> {t.predictions.predictionsLocked}
        </div>
      ) : null}

      {/* Progress Section */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-gray-800">{t.predictions.progressTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-800">{t.predictions.groupStage}</span>
              <span className="font-medium text-brand">{groupsFilled} / {totalGroups}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-brand h-2 rounded-full transition-all duration-500" style={{ width: `${(groupsFilled / totalGroups) * 100}%` }}></div>
            </div>
          </div>
          
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-800">{t.predictions.specialQuestions}</span>
              <span className="font-medium text-brand">{specialsFilled} / {totalSpecials}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-brand h-2 rounded-full transition-all duration-500" style={{ width: `${(specialsFilled / totalSpecials) * 100}%` }}></div>
            </div>
          </div>
          
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-800">{t.predictions.individualMatches}</span>
              <span className="font-medium text-brand">{matchesFilled} / {totalMatches}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-brand h-2 rounded-full transition-all duration-500" style={{ width: `${(matchesFilled / totalMatches) * 100}%` }}></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {message && (
        <div className={`p-4 rounded-md flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {/* Tabs Menu */}
      <div className="flex flex-col sm:flex-row gap-2 w-full justify-between">
        <Button 
          variant={activeTab === 'groups' ? 'default' : 'outline'} 
          onClick={() => setActiveTab('groups')}
          className={`flex-1 whitespace-nowrap ${activeTab === 'groups' ? 'text-white border-transparent' : 'text-gray-900 bg-white border-gray-300 hover:bg-gray-50'}`}
          style={activeTab === 'groups' ? { backgroundColor: 'var(--brand-color, #1e3a8a)' } : {}}
        >
          {t.predictions.groupStage}
        </Button>
        <Button
          variant={activeTab === 'specials' ? 'default' : 'outline'}
          onClick={() => setActiveTab('specials')}
          className={`flex-1 whitespace-nowrap ${activeTab === 'specials' ? 'text-white border-transparent' : 'text-gray-900 bg-white border-gray-300 hover:bg-gray-50'}`}
          style={activeTab === 'specials' ? { backgroundColor: 'var(--brand-color, #1e3a8a)' } : {}}
        >
          {t.predictions.specialQuestions}
        </Button>
        <Button
          variant={activeTab === 'matches' ? 'default' : 'outline'}
          onClick={() => setActiveTab('matches')}
          className={`flex-1 whitespace-nowrap ${activeTab === 'matches' ? 'text-white border-transparent' : 'text-gray-900 bg-white border-gray-300 hover:bg-gray-50'}`}
          style={activeTab === 'matches' ? { backgroundColor: 'var(--brand-color, #1e3a8a)' } : {}}
        >
          {t.predictions.individualMatches}
        </Button>
        <Button
          variant={activeTab === 'knockouts' ? 'default' : 'outline'}
          onClick={() => setActiveTab('knockouts')}
          className={`flex-1 whitespace-nowrap ${activeTab === 'knockouts' ? 'text-white border-transparent' : 'text-gray-900 bg-white border-gray-300 hover:bg-gray-50'}`}
          style={activeTab === 'knockouts' ? { backgroundColor: 'var(--brand-color, #1e3a8a)' } : {}}
        >
          {t.predictions.knockoutStage}
        </Button>
      </div>

      {activeTab === 'groups' && (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold pb-2" style={{ borderBottom: '2px solid var(--brand-color, #1e3a8a)', color: 'var(--brand-color, #1e3a8a)' }}>{t.predictions.groupStage}</h2>
        <p className="text-sm text-gray-800 mb-4 text-justify">{t.predictions.groupStageDesc}</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10">
          {Object.entries(groupPredictions)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([groupLetter, teams]) => (
            <Card key={groupLetter} className="overflow-hidden border-t-4" style={{ borderTopColor: 'var(--brand-color, #2563eb)' }}>
              <CardHeader className="bg-gray-50 py-3 px-4 border-b flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-lg">{t.predictions.group} {groupLetter}</CardTitle>
                {confirmedGroups.includes(groupLetter) ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" title={t.predictions.confirmed} />
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs bg-white hover:bg-green-50 hover:text-green-700 hover:border-green-300 transition-colors"
                    onClick={() => {
                        if (!effectiveIsLocked) {
                            setConfirmedGroups(prev => [...prev, groupLetter]);
                        }
                    }}
                    disabled={effectiveIsLocked}
                  >
                    {t.predictions.confirm}
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-4">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  modifiers={[restrictToParentElement, restrictToVerticalAxis]}
                  onDragEnd={(e) => handleDragEnd(e, groupLetter)}
                >
                  <SortableContext 
                    items={(teams as string[]) as any}
                    strategy={verticalListSortingStrategy}
                  >
                    {(teams as string[]).map((team, index) => (
                      <SortableItem key={team} id={team} team={team} index={index} disabled={effectiveIsLocked} />
                    ))}
                  </SortableContext>
                </DndContext>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      )}

      {activeTab === 'specials' && (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold pb-2" style={{ borderBottom: '2px solid var(--brand-color, #1e3a8a)', color: 'var(--brand-color, #1e3a8a)' }}>{t.predictions.specialQuestions}</h2>
        <p className="text-sm text-gray-800 mb-4 text-justify">{t.predictions.specialsDesc}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {activeSpecialQuestions.map((q) => (
            <Card key={q.id}>
              <CardContent className="p-5">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {(t.specialQuestions as Record<string, string>)[q.id] || q.label}
                </label>
                <input
                  type="text"
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500 transition-colors"
                  placeholder={t.predictions.answerPlaceholder}
                  value={specialPredictions[q.id] || ""}
                  onChange={(e) => handleSpecialChange(q.id, e.target.value)}
                  disabled={effectiveIsLocked}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      )}

      {activeTab === 'matches' && (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold pb-2" style={{ borderBottom: '2px solid var(--brand-color, #1e3a8a)', color: 'var(--brand-color, #1e3a8a)' }}>{t.predictions.individualMatches}</h2>
        <div className="border p-5 rounded-lg text-sm mb-4 shadow-sm" style={{ backgroundColor: 'color-mix(in srgb, var(--brand-color) 8%, var(--page-bg, white))', borderColor: 'var(--brand-color)', color: 'inherit' }}>
          <p className="font-bold mb-2 text-base">{t.predictions.matchesInfoTitle}</p>
          <p>{t.predictions.matchesInfoDesc} <br className="hidden sm:block"/>{t.predictions.winnerDraw} <strong className="text-green-700">{t.predictions.pointLabel}</strong>. {t.predictions.exactResult} <strong className="text-green-700">{t.predictions.extraPoint}</strong>.</p>
        </div>

        <div className="space-y-3">
          {sortedDates.map(date => {
            const dateMatches = matchesByDate[date];
            const savedCount = dateMatches.filter(m => matchPredictions[m.id]?.home !== undefined && matchPredictions[m.id]?.away !== undefined && matchPredictions[m.id]?.home !== '' && matchPredictions[m.id]?.away !== '').length;
            const spanishMonths: Record<string, number> = { enero:1, febrero:2, marzo:3, abril:4, mayo:5, junio:6, julio:7, agosto:8, septiembre:9, octubre:10, noviembre:11, diciembre:12 };
            const dateParts = date.toLowerCase().split(' de ');
            const parsedDay = dateParts.length === 2 ? parseInt(dateParts[0]) : NaN;
            const parsedMonth = dateParts.length === 2 ? spanishMonths[dateParts[1]] : NaN;
            const today = new Date();
            const isToday = !isNaN(parsedDay) && !isNaN(parsedMonth) && today.getDate() === parsedDay && today.getMonth() + 1 === parsedMonth;
            const tMonths = t.months as Record<string, string>;
            const displayDate = dateParts.length === 2
              ? (lang === 'en' ? `${tMonths[dateParts[1]] || dateParts[1]} ${parsedDay}` : `${parsedDay} de ${tMonths[dateParts[1]] || dateParts[1]}`)
              : date;
            return (
            <details key={date} className="group bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden" open={isToday}>
              <summary className="flex items-center justify-between px-4 py-3 cursor-pointer list-none select-none" style={{ background: isToday ? 'color-mix(in srgb, var(--brand-color, #1e3a8a) 10%, transparent)' : undefined }}>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg shrink-0" style={{ backgroundColor: 'color-mix(in srgb, var(--brand-color, #1e3a8a) 12%, white)' }}>
                    <Calendar className="w-4 h-4" style={{ color: 'var(--brand-color, #1e3a8a)' }} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 capitalize">{displayDate}</h3>
                    <p className="text-xs text-gray-400">{savedCount}/{dateMatches.length} {t.predictions.predictionsSaved}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {savedCount === dateMatches.length && dateMatches.length > 0 && (
                    <span className="hidden sm:inline text-xs font-semibold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">{t.predictions.complete}</span>
                  )}
                  <div className="text-gray-400 group-open:rotate-180 transition-transform duration-200">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </div>
                </div>
              </summary>

              <div className="p-4 pt-3 space-y-3 border-t border-gray-100">
                {matchesByDate[date].sort((a, b) => a.time.localeCompare(b.time)).map(match => (
                  <div key={match.id} className="rounded-xl p-4 border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-8" style={{ backgroundColor: 'color-mix(in srgb, var(--brand-color) 6%, var(--page-bg, white))' }}>
                    {/* Time (Desktop) / Label (Mobile) */}
                    <div className="flex md:flex-col items-center justify-between md:justify-center md:items-start shrink-0 min-w-[60px]">
                      <div className="flex items-center gap-1 text-sm uppercase font-black px-2 py-0.5 rounded">
                        <Clock className="w-4 h-4" /> {match.time}
                      </div>
                      <div className="md:mt-1">
                        {matchPredictions[match.id]?.home !== undefined && matchPredictions[match.id]?.away !== undefined && matchPredictions[match.id]?.home !== '' && matchPredictions[match.id]?.away !== '' ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" title={t.predictions.saved} />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-orange-500 animate-pulse" title={t.predictions.pending} />
                        )}
                      </div>
                    </div>

                    {/* Modern Match Grid */}
                    <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-2 w-full overflow-hidden">
                      
                      {/* Home */}
                      <div className="flex items-center justify-between gap-2 w-full md:w-auto md:flex-1">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="shrink-0 w-6 h-4 sm:w-8 sm:h-6 rounded overflow-hidden flex items-center justify-center border border-gray-200">
                            {TEAM_FLAGS[match.home] ? <img src={`https://flagcdn.com/w40/${TEAM_FLAGS[match.home]}.png`} alt={match.home} className="w-full h-full object-cover" /> : <span>🏳️</span>}
                          </div>
                          <span translate="no" className="font-bold text-gray-900 uppercase text-xs sm:text-sm truncate">{(t.teams as Record<string, string>)[match.home] || match.home}</span>
                        </div>

                        <div className="flex items-center gap-1 rounded-lg p-0.5 sm:p-1 border border-gray-200 shrink-0">
                          <Button disabled={checkMatchLocked(match.date, match.time)} onClick={() => handleMatchScoreIncrement(match.id, 'home', -1, match.date, match.time)} variant="ghost" size="icon" className="h-6 w-6 sm:h-8 sm:w-8 text-gray-600"><Minus className="w-3 h-3 sm:w-4 sm:h-4"/></Button>
                          <div className="w-5 sm:w-8 text-center font-black text-sm sm:text-lg">{matchPredictions[match.id]?.home || 0}</div>
                          <Button disabled={checkMatchLocked(match.date, match.time)} onClick={() => handleMatchScoreIncrement(match.id, 'home', 1, match.date, match.time)} variant="ghost" size="icon" className="h-6 w-6 sm:h-8 sm:w-8 text-gray-600"><Plus className="w-3 h-3 sm:w-4 sm:h-4"/></Button>
                        </div>
                      </div>

                      {/* VS */}
                      <div className="hidden md:flex font-bold text-gray-300 text-sm px-2 shrink-0">-</div>

                      {/* Away */}
                      <div className="flex items-center justify-between gap-2 w-full md:w-auto md:flex-1">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="shrink-0 w-6 h-4 sm:w-8 sm:h-6 rounded overflow-hidden flex items-center justify-center border border-gray-200">
                            {TEAM_FLAGS[match.away] ? <img src={`https://flagcdn.com/w40/${TEAM_FLAGS[match.away]}.png`} alt={match.away} className="w-full h-full object-cover" /> : <span>🏳️</span>}
                          </div>
                          <span translate="no" className="font-bold text-gray-900 uppercase text-xs sm:text-sm truncate">{(t.teams as Record<string, string>)[match.away] || match.away}</span>
                        </div>

                        <div className="flex items-center gap-1 rounded-lg p-0.5 sm:p-1 border border-gray-200 shrink-0">
                          <Button disabled={checkMatchLocked(match.date, match.time)} onClick={() => handleMatchScoreIncrement(match.id, 'away', -1, match.date, match.time)} variant="ghost" size="icon" className="h-6 w-6 sm:h-8 sm:w-8 text-gray-600"><Minus className="w-3 h-3 sm:w-4 sm:h-4"/></Button>
                          <div className="w-5 sm:w-8 text-center font-black text-sm sm:text-lg">{matchPredictions[match.id]?.away || 0}</div>
                          <Button disabled={checkMatchLocked(match.date, match.time)} onClick={() => handleMatchScoreIncrement(match.id, 'away', 1, match.date, match.time)} variant="ghost" size="icon" className="h-6 w-6 sm:h-8 sm:w-8 text-gray-600"><Plus className="w-3 h-3 sm:w-4 sm:h-4"/></Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          );
          })}
        </div>
      </div>
      )}

      {activeTab === 'knockouts' && (
      <div className="space-y-6 pb-12">
        <h2 className="text-2xl font-bold pb-2" style={{ borderBottom: '2px solid var(--brand-color, #1e3a8a)', color: 'var(--brand-color, #1e3a8a)' }}>{t.predictions.knockoutStage}</h2>
        <p className="text-sm text-gray-800 mb-4 text-justify">{t.predictions.knockoutDesc}</p>
        <KnockoutBracket
          seedR32={actualBracket.seedR32}
          userPicks={knockoutPredictions}
          actualWinners={actualBracket.winners}
          kickoffs={actualBracket.kickoffs}
          groupStageFinished={actualBracket.finishedGroups.length === Object.keys(GROUPS).length}
          bannerMessage={knockoutBanner}
          onPick={handleKnockoutPick}
        />
      </div>
      )}

      {confirmLock && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 mb-4">{t.predictions.confirmLockTitle}</h3>

            {(groupsFilled < totalGroups || specialsFilled < totalSpecials) ? (
              <div className="bg-red-50 text-red-900 p-4 rounded-md mb-6 border border-red-200">
                <div className="font-bold flex items-center gap-2 mb-2"><AlertCircle className="w-5 h-5 text-red-600"/> {t.predictions.warningTitle}</div>
                <ul className="list-disc pl-6 space-y-1 text-sm text-red-800">
                  {groupsFilled < totalGroups && <li>{t.predictions.missingGroupsPre} {totalGroups - groupsFilled} {t.predictions.missingGroupsPost}</li>}
                  {specialsFilled < totalSpecials && <li>{t.predictions.missingSpecialsPre} {totalSpecials - specialsFilled} {t.predictions.missingSpecialsPost}</li>}
                </ul>
                <p className="mt-3 text-sm font-medium">{t.predictions.lockWarning}</p>
              </div>
            ) : (
              <div className="bg-green-50 text-green-900 p-4 rounded-md mb-6 border border-green-200 text-sm">
                <div className="font-bold flex items-center gap-2 mb-1"><CheckCircle2 className="w-5 h-5 text-green-600"/> {t.predictions.allCompleteTitle}</div>
                {t.predictions.allCompleteMsg}
              </div>
            )}

            <div className="flex justify-end gap-3 mt-2">
              <Button variant="outline" onClick={() => setConfirmLock(false)} className="bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100">{t.predictions.cancel}</Button>
              <Button
                className={groupsFilled < totalGroups || specialsFilled < totalSpecials ? "bg-red-600 hover:bg-red-700 text-white" : "bg-green-600 hover:bg-green-700 text-white"}
                onClick={() => {
                  setConfirmLock(false);
                  savePredictions(true);
                }}
                disabled={saving}
              >
                <Lock className="w-4 h-4 mr-2" />
                {saving ? t.predictions.locking : t.predictions.confirmLockBtn}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-12">
        <Fixture />
      </div>
      </div>
    </div>
  );
}
