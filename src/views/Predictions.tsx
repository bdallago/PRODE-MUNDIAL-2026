"use client";

import { useState, useEffect, useRef } from "react";
import { User } from "firebase/auth";
import { doc, getDoc, getDocFromCache, getDocFromServer, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { SortableItem } from "../components/SortableItem";
import { DndContext, closestCenter, KeyboardSensor, TouchSensor, MouseSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Save, Lock, AlertCircle, CheckCircle2, Calendar, Clock, Bell, Plus, Minus } from "lucide-react";
import { CountdownBanner } from "../components/CountdownBanner";
import { Fixture } from "../components/Fixture";
import { Bracket } from "../components/Bracket";
import { GROUPS, SPECIAL_QUESTIONS, KNOCKOUT_STAGES, ALL_TEAMS, MATCHES, TEAM_FLAGS } from "../data";

const DEFAULT_DEADLINE = new Date('2026-06-11T00:00:00').getTime();

export default function Predictions({ user }: { user: User }) {
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
  const [knockoutPredictions, setKnockoutPredictions] = useState<Record<string, string[]>>({});
  const [matchPredictions, setMatchPredictions] = useState<Record<string, {home: number | '', away: number | ''}>>({});
  
  const savePredictionsRef = useRef<(lock?: boolean, matchesOnly?: boolean) => Promise<void>>(async () => {});

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 2,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 0,
        tolerance: 5,
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
        let docSnap;
        try {
          docSnap = await getDocFromCache(docRef);
        } catch (cacheError) {
          docSnap = await getDocFromServer(docRef);
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
      } catch (error) {
        console.error("Error fetching predictions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user.uid]);

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = deadline - Date.now();
      setTimeLeft(remaining);

      if (remaining <= 0 && !isLocked && !loading) {
        setIsLocked(true);
        savePredictionsRef.current(true);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [deadline, isLocked, loading]);

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

  const handleMatchScoreIncrement = (matchId: string, team: 'home' | 'away', delta: number, matchDate: string, matchTime: string) => {
    const current = matchPredictions[matchId]?.[team];
    let newVal = typeof current === 'number' ? current + delta : (delta > 0 ? 1 : 0);
    if (newVal < 0) newVal = 0;
    if (newVal > 20) newVal = 20;
    handleMatchChange(matchId, team, newVal.toString(), matchDate, matchTime);
  };

  const handleMatchChange = (matchId: string, team: 'home' | 'away', value: string, matchDate: string, matchTime: string) => {
    if (checkMatchLocked(matchDate, matchTime)) {
      setMessage({ type: 'error', text: 'El tiempo para editar este partido ha expirado (1 hora antes).' });
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

  // Keep ref always pointing to the latest savePredictions (fixes stale closure in auto-lock)
  useEffect(() => {
    savePredictionsRef.current = savePredictions;
  });

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
      await setDoc(docRef, {
        uid: user.uid,
        groups: groupPredictions,
        specials: specialPredictions,
        knockouts: knockoutPredictions,
        matches: matchesToSave || matchPredictions,
        confirmedGroups: confirmedGroups,
        isLocked: lock || effectiveIsLocked,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
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
        setMessage({ type: 'success', text: lock ? 'Predicciones guardadas y fijadas con éxito.' : 'Predicciones guardadas con éxito.' });
      }
    } catch (error: any) {
      console.error("Error saving predictions:", error);
      if (!isAutoSave) {
        if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
          setMessage({ type: 'error', text: 'El tiempo para enviar predicciones generales ha terminado.' });
        } else {
          setMessage({ type: 'error', text: 'Hubo un error al guardar. Intenta de nuevo.' });
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
    return <div className="text-center py-10">Cargando tus predicciones...</div>;
  }

  const totalGroups = Object.keys(GROUPS).length;
  
  // Calculate progress
  const groupsFilled = confirmedGroups.length;
  const specialsFilled = Object.values(specialPredictions).filter(v => v && v.trim() !== '').length;
  const matchesFilled = Object.values(matchPredictions).filter(m => m.home !== '' && m.away !== '').length;

  const totalSpecials = SPECIAL_QUESTIONS.length;
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
              <h1 className="text-3xl font-bold text-gray-900 text-center md:text-left">Mis Predicciones</h1>
              {saving && (
                <div className="flex items-center gap-2 text-brand animate-pulse">
                  <div className="w-2 h-2 bg-brand rounded-full"></div>
                  <span className="text-[10px] font-bold uppercase tracking-widest">Sincronizando...</span>
                </div>
              )}
            </div>
            <p className="text-gray-700 mt-2 text-justify md:text-left">
              {effectiveIsLocked 
                ? "Tus predicciones están fijadas y no pueden ser modificadas." 
                : "Podés 'Guardar Borrador' cuantas veces quieras. El sistema también guarda tus cambios automáticamente. Las elecciones solo se van a fijar permanentemente al hacer clic en 'Fijar Predicciones'."}
            </p>
          </div>
        </div>
      </div>

      {!effectiveIsLocked && (
        <div className="sticky top-[56px] md:top-[64px] z-40 bg-white py-4 px-4 sm:px-6 border-b border-gray-200 sm:border-none shadow-sm sm:shadow-none flex flex-col sm:flex-row justify-between items-center gap-3 transition-all mb-8">
          <div className="text-sm font-medium text-gray-700 hidden sm:block">
            Progreso: Grupos {groupsFilled}/{totalGroups} | Especiales {specialsFilled}/{totalSpecials}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button 
              variant="outline" 
              onClick={() => savePredictions(false)}
              disabled={saving}
              className="flex-1 sm:w-auto flex items-center justify-center gap-2 bg-white"
            >
              <Save className="w-4 h-4" /> {saving ? "Guardando..." : "Guardar Borrador"}
            </Button>
            <Button 
              onClick={() => setConfirmLock(true)}
              disabled={saving}
              className="flex-1 sm:w-auto flex items-center justify-center gap-2 text-white bg-green-600 hover:bg-green-700 border border-green-600"
            >
              <Lock className="w-4 h-4" /> Fijar Predicciones
            </Button>
          </div>
        </div>
      )}

      <div className="px-4 sm:px-6 space-y-8">
      {effectiveIsLocked ? (
        <div className="flex items-center gap-2 text-green-800 bg-green-50 px-4 py-3 rounded-md border border-green-200 justify-center w-full shadow-sm font-medium">
          <Lock className="w-4 h-4" /> Predicciones Fijadas
        </div>
      ) : null}

      {/* Progress Section */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-gray-800">Progreso de tus Predicciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-800">Fase de Grupos</span>
              <span className="font-medium text-brand">{groupsFilled} / {totalGroups}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-brand h-2 rounded-full transition-all duration-500" style={{ width: `${(groupsFilled / totalGroups) * 100}%` }}></div>
            </div>
          </div>
          
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-800">Preguntas Especiales</span>
              <span className="font-medium text-brand">{specialsFilled} / {totalSpecials}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-brand h-2 rounded-full transition-all duration-500" style={{ width: `${(specialsFilled / totalSpecials) * 100}%` }}></div>
            </div>
          </div>
          
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-800">Partidos Individuales</span>
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
          Fase de Grupos
        </Button>
        <Button 
          variant={activeTab === 'specials' ? 'default' : 'outline'} 
          onClick={() => setActiveTab('specials')}
          className={`flex-1 whitespace-nowrap ${activeTab === 'specials' ? 'text-white border-transparent' : 'text-gray-900 bg-white border-gray-300 hover:bg-gray-50'}`}
          style={activeTab === 'specials' ? { backgroundColor: 'var(--brand-color, #1e3a8a)' } : {}}
        >
          Preguntas Especiales
        </Button>
        <Button 
          variant={activeTab === 'matches' ? 'default' : 'outline'} 
          onClick={() => setActiveTab('matches')}
          className={`flex-1 whitespace-nowrap ${activeTab === 'matches' ? 'text-white border-transparent' : 'text-gray-900 bg-white border-gray-300 hover:bg-gray-50'}`}
          style={activeTab === 'matches' ? { backgroundColor: 'var(--brand-color, #1e3a8a)' } : {}}
        >
          Partidos Individuales
        </Button>
        <Button 
          variant={activeTab === 'knockouts' ? 'default' : 'outline'} 
          onClick={() => setActiveTab('knockouts')}
          className={`flex-1 whitespace-nowrap ${activeTab === 'knockouts' ? 'text-white border-transparent' : 'text-gray-900 bg-white border-gray-300 hover:bg-gray-50'}`}
          style={activeTab === 'knockouts' ? { backgroundColor: 'var(--brand-color, #1e3a8a)' } : {}}
        >
          Fase Eliminatoria
        </Button>
      </div>

      {activeTab === 'groups' && (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold pb-2" style={{ borderBottom: '2px solid var(--brand-color, #1e3a8a)', color: 'var(--brand-color, #1e3a8a)' }}>Fase de Grupos</h2>
        <p className="text-sm text-gray-800 mb-4 text-justify">Arrastrá los equipos para ordenarlos del 1º al 4º puesto. Los dos primeros y los 8 mejores terceros avanzan a 16avos.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10">
          {Object.entries(groupPredictions)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([groupLetter, teams]) => (
            <Card key={groupLetter} className="overflow-hidden border-t-4" style={{ borderTopColor: 'var(--brand-color, #2563eb)' }}>
              <CardHeader className="bg-gray-50 py-3 px-4 border-b flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-lg">Grupo {groupLetter}</CardTitle>
                {confirmedGroups.includes(groupLetter) ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" title="Confirmado" />
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
                    Confirmar
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-4">
                <DndContext 
                  sensors={sensors}
                  collisionDetection={closestCenter}
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
        <h2 className="text-2xl font-bold pb-2" style={{ borderBottom: '2px solid var(--brand-color, #1e3a8a)', color: 'var(--brand-color, #1e3a8a)' }}>Preguntas Especiales</h2>
        <p className="text-sm text-gray-800 mb-4 text-justify">Por favor, escribí el nombre completo del jugador o selección elegida para evitar confusiones en la corrección.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {SPECIAL_QUESTIONS.map((q) => (
            <Card key={q.id}>
              <CardContent className="p-5">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {q.label}
                </label>
                <input
                  type="text"
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500 transition-colors"
                  placeholder="Escribí tu respuesta..."
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
        <h2 className="text-2xl font-bold pb-2" style={{ borderBottom: '2px solid var(--brand-color, #1e3a8a)', color: 'var(--brand-color, #1e3a8a)' }}>Partidos Individuales</h2>
        <div className="bg-[#f0f9ff] border border-[var(--brand-color,#1e3a8a)] p-5 rounded-lg text-gray-900 text-sm mb-4 shadow-sm">
          <p className="font-bold mb-2 text-base">¿Le tuviste demasiada fe a un equipo? ¿Lesión de último minuto? ¡No pasa nada!</p>
          <p>Podés predecir hasta 1 hora antes de cada partido. <br className="hidden sm:block"/>Acertar ganador/empate = <strong className="text-green-700">1 punto</strong>. Resultado exacto = <strong className="text-green-700">+1 punto extra</strong>.</p>
        </div>

        <div className="space-y-3">
          {sortedDates.map(date => {
            const dateMatches = matchesByDate[date];
            const savedCount = dateMatches.filter(m => matchPredictions[m.id]?.home !== undefined && matchPredictions[m.id]?.away !== undefined && matchPredictions[m.id]?.home !== '' && matchPredictions[m.id]?.away !== '').length;
            const isToday = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long' }) === date.toLowerCase();
            return (
            <details key={date} className="group bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden" open={isToday}>
              <summary className="flex items-center justify-between px-4 py-3 cursor-pointer list-none select-none hover:bg-gray-50/80 transition-colors" style={{ background: isToday ? 'color-mix(in srgb, var(--brand-color, #1e3a8a) 6%, white)' : undefined }}>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg shrink-0" style={{ backgroundColor: 'color-mix(in srgb, var(--brand-color, #1e3a8a) 12%, white)' }}>
                    <Calendar className="w-4 h-4" style={{ color: 'var(--brand-color, #1e3a8a)' }} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 capitalize">{date}</h3>
                    <p className="text-xs text-gray-400">{savedCount}/{dateMatches.length} predicciones guardadas</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {savedCount === dateMatches.length && dateMatches.length > 0 && (
                    <span className="hidden sm:inline text-xs font-semibold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">Completo</span>
                  )}
                  <div className="text-gray-400 group-open:rotate-180 transition-transform duration-200">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </div>
                </div>
              </summary>

              <div className="p-4 pt-3 space-y-3 border-t border-gray-100">
                {matchesByDate[date].sort((a, b) => a.time.localeCompare(b.time)).map(match => (
                  <div key={match.id} className="bg-gray-50/50 rounded-xl p-4 border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-8">
                    {/* Time (Desktop) / Label (Mobile) */}
                    <div className="flex md:flex-col items-center justify-between md:justify-center md:items-start shrink-0 min-w-[60px]">
                      <div className="flex items-center gap-1 text-sm uppercase font-black text-black bg-gray-100 px-2 py-0.5 rounded shadow-sm border border-gray-200">
                        <Clock className="w-4 h-4" /> {match.time}
                      </div>
                      <div className="md:mt-1">
                        {matchPredictions[match.id]?.home !== undefined && matchPredictions[match.id]?.away !== undefined && matchPredictions[match.id]?.home !== '' && matchPredictions[match.id]?.away !== '' ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" title="Guardado" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-orange-500 animate-pulse" title="Pendiente" />
                        )}
                      </div>
                    </div>

                    {/* Modern Match Grid */}
                    <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-2 w-full overflow-hidden">
                      
                      {/* Home */}
                      <div className="flex items-center justify-between gap-2 w-full md:w-auto md:flex-1 bg-white md:bg-transparent p-2 md:p-0 rounded-md border md:border-transparent border-gray-200">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="shrink-0 w-6 h-4 sm:w-8 sm:h-6 bg-gray-100 rounded overflow-hidden flex items-center justify-center border border-gray-200">
                            {TEAM_FLAGS[match.home] ? <img src={`https://flagcdn.com/w40/${TEAM_FLAGS[match.home]}.png`} alt={match.home} className="w-full h-full object-cover" /> : <span>🏳️</span>}
                          </div>
                          <span className="font-bold text-gray-900 uppercase text-xs sm:text-sm truncate">{match.home}</span>
                        </div>
                        
                        <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-0.5 sm:p-1 border border-gray-200 shrink-0">
                          <Button disabled={checkMatchLocked(match.date, match.time)} onClick={() => handleMatchScoreIncrement(match.id, 'home', -1, match.date, match.time)} variant="ghost" size="icon" className="h-6 w-6 sm:h-8 sm:w-8 text-gray-600 hover:text-black hover:bg-gray-200"><Minus className="w-3 h-3 sm:w-4 sm:h-4"/></Button>
                          <div className="w-5 sm:w-8 text-center font-black text-sm sm:text-lg">{matchPredictions[match.id]?.home || 0}</div>
                          <Button disabled={checkMatchLocked(match.date, match.time)} onClick={() => handleMatchScoreIncrement(match.id, 'home', 1, match.date, match.time)} variant="ghost" size="icon" className="h-6 w-6 sm:h-8 sm:w-8 text-gray-600 hover:text-black hover:bg-gray-200"><Plus className="w-3 h-3 sm:w-4 sm:h-4"/></Button>
                        </div>
                      </div>

                      {/* VS */}
                      <div className="hidden md:flex font-bold text-gray-300 text-sm px-2 shrink-0">-</div>

                      {/* Away */}
                      <div className="flex items-center justify-between gap-2 w-full md:w-auto md:flex-1 bg-white md:bg-transparent p-2 md:p-0 rounded-md border md:border-transparent border-gray-200">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="shrink-0 w-6 h-4 sm:w-8 sm:h-6 bg-gray-100 rounded overflow-hidden flex items-center justify-center border border-gray-200">
                            {TEAM_FLAGS[match.away] ? <img src={`https://flagcdn.com/w40/${TEAM_FLAGS[match.away]}.png`} alt={match.away} className="w-full h-full object-cover" /> : <span>🏳️</span>}
                          </div>
                          <span className="font-bold text-gray-900 uppercase text-xs sm:text-sm truncate">{match.away}</span>
                        </div>

                        <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-0.5 sm:p-1 border border-gray-200 shrink-0">
                          <Button disabled={checkMatchLocked(match.date, match.time)} onClick={() => handleMatchScoreIncrement(match.id, 'away', -1, match.date, match.time)} variant="ghost" size="icon" className="h-6 w-6 sm:h-8 sm:w-8 text-gray-600 hover:text-black hover:bg-gray-200"><Minus className="w-3 h-3 sm:w-4 sm:h-4"/></Button>
                          <div className="w-5 sm:w-8 text-center font-black text-sm sm:text-lg">{matchPredictions[match.id]?.away || 0}</div>
                          <Button disabled={checkMatchLocked(match.date, match.time)} onClick={() => handleMatchScoreIncrement(match.id, 'away', 1, match.date, match.time)} variant="ghost" size="icon" className="h-6 w-6 sm:h-8 sm:w-8 text-gray-600 hover:text-black hover:bg-gray-200"><Plus className="w-3 h-3 sm:w-4 sm:h-4"/></Button>
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
        <h2 className="text-2xl font-bold pb-2" style={{ borderBottom: '2px solid var(--brand-color, #1e3a8a)', color: 'var(--brand-color, #1e3a8a)' }}>Fase Eliminatoria</h2>
        <p className="text-sm text-gray-800 mb-4 text-justify">El cuadro final se irá armando a medida que avance el torneo. ¡Preparate para los cruces decisivos!</p>
        <Bracket />
      </div>
      )}

      {confirmLock && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Confirmar Fijación</h3>
            
            {(groupsFilled < totalGroups || specialsFilled < totalSpecials) ? (
              <div className="bg-red-50 text-red-900 p-4 rounded-md mb-6 border border-red-200">
                <div className="font-bold flex items-center gap-2 mb-2"><AlertCircle className="w-5 h-5 text-red-600"/> ¡Atención! Te faltan completar secciones:</div>
                <ul className="list-disc pl-6 space-y-1 text-sm text-red-800">
                  {groupsFilled < totalGroups && <li>Te faltan ordenar {totalGroups - groupsFilled} grupos.</li>}
                  {specialsFilled < totalSpecials && <li>Te faltan responder {totalSpecials - specialsFilled} preguntas especiales.</li>}
                </ul>
                <p className="mt-3 text-sm font-medium">¿Estás seguro de que querés fijarlas así? No podrás modificarlas después.</p>
              </div>
            ) : (
              <div className="bg-green-50 text-green-900 p-4 rounded-md mb-6 border border-green-200 text-sm">
                <div className="font-bold flex items-center gap-2 mb-1"><CheckCircle2 className="w-5 h-5 text-green-600"/> ¡Excelente! Completaste todo.</div>
                Una vez fijadas, las opciones ya no se pueden modificar. ¿Estás seguro de continuar?
              </div>
            )}
            
            <div className="flex justify-end gap-3 mt-2">
              <Button variant="outline" onClick={() => setConfirmLock(false)} className="bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100">Cancelar</Button>
              <Button 
                className={groupsFilled < totalGroups || specialsFilled < totalSpecials ? "bg-red-600 hover:bg-red-700 text-white" : "bg-green-600 hover:bg-green-700 text-white"} 
                onClick={() => { 
                  setConfirmLock(false); 
                  savePredictions(true); 
                }}
                disabled={saving}
              >
                <Lock className="w-4 h-4 mr-2" />
                {saving ? "Fijando..." : "Sí, fijar predicciones"}
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
