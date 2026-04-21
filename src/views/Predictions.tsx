"use client";

import { useState, useEffect } from "react";
import { User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { SortableItem } from "../components/SortableItem";
import { DndContext, closestCenter, KeyboardSensor, TouchSensor, MouseSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Save, Lock, AlertCircle, CheckCircle2, Calendar, Clock, Bell } from "lucide-react";
import { CountdownBanner } from "../components/CountdownBanner";
import { Fixture } from "../components/Fixture";
import { Bracket } from "../components/Bracket";
import { GROUPS, SPECIAL_QUESTIONS, KNOCKOUT_STAGES, ALL_TEAMS, MATCHES, TEAM_FLAGS } from "../data";

const DEADLINE = new Date('2026-06-08T00:00:00').getTime();

export default function Predictions({ user }: { user: User }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [confirmLock, setConfirmLock] = useState(false);
  const [activeTab, setActiveTab] = useState<'groups' | 'specials' | 'matches' | 'knockouts'>('groups');
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null);
  const [timeLeft, setTimeLeft] = useState(DEADLINE - Date.now());
  const [hasSavedDoc, setHasSavedDoc] = useState(false);

  // State for predictions
  const [groupPredictions, setGroupPredictions] = useState<Record<string, string[]>>(GROUPS);
  const [specialPredictions, setSpecialPredictions] = useState<Record<string, string>>({});
  const [knockoutPredictions, setKnockoutPredictions] = useState<Record<string, string[]>>({});
  const [matchPredictions, setMatchPredictions] = useState<Record<string, {home: number | '', away: number | ''}>>({});
  
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const fetchPredictions = async () => {
      try {
        const docRef = doc(db, "predictions", user.uid);
        const docSnap = await getDoc(docRef);

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

    fetchPredictions();
  }, [user.uid]);

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = DEADLINE - Date.now();
      setTimeLeft(remaining);
      
      // Auto-lock if time is up and it wasn't locked before
      if (remaining <= 0 && !isLocked && !loading) {
        setIsLocked(true);
        savePredictions(true); // Auto-save as locked
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isLocked, loading]);

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
    
    const { active, over } = event;

    if (active.id !== over.id) {
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

  const handleMatchChange = (matchId: string, team: 'home' | 'away', value: string, matchDate: string, matchTime: string) => {
    if (checkMatchLocked(matchDate, matchTime)) {
      setMessage({ type: 'error', text: 'El tiempo para editar este partido ha expirado (1 hora antes).' });
      return;
    }
    
    const numValue = value === '' ? '' : parseInt(value, 10);
    if (value !== '' && (isNaN(numValue as number) || (numValue as number) < 0)) return;
    
    setMatchPredictions(prev => {
      const newPredictions = {
        ...prev,
        [matchId]: {
          ...(prev[matchId] || { home: '', away: '' }),
          [team]: numValue
        }
      };
      
      // Auto-save just matches when editing
      // Using a timeout allows state to settle if needed, but we pass the new state directly to setDoc
      setTimeout(() => {
        savePredictionsState(newPredictions, false, true);
      }, 500);

      return newPredictions;
    });
  };

  const savePredictionsState = async (matchesToSave: any, lock: boolean = false, matchesOnly: boolean = false) => {
    setSaving(true);
    if (!matchesOnly) setMessage(null);
    
    try {
      const docRef = doc(db, "predictions", user.uid);
      await setDoc(docRef, {
        uid: user.uid,
        groups: groupPredictions,
        specials: specialPredictions,
        knockouts: knockoutPredictions,
        matches: matchesToSave || matchPredictions,
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
      
      if (lock || (effectiveIsLocked && !matchesOnly)) {
        setIsLocked(true);
      }
      setHasSavedDoc(true);
      
      if (!matchesOnly) {
        setMessage({ type: 'success', text: lock ? 'Predicciones guardadas y fijadas con éxito.' : 'Predicciones guardadas con éxito.' });
      }
    } catch (error: any) {
      console.error("Error saving predictions:", error);
      if (!matchesOnly) {
        if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
          setMessage({ type: 'error', text: 'El tiempo para enviar predicciones generales ha terminado.' });
        } else {
          setMessage({ type: 'error', text: 'Hubo un error al guardar. Intenta de nuevo.' });
        }
      }
    } finally {
      setSaving(false);
      if (!matchesOnly) setTimeout(() => setMessage(null), 5000);
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
  const groupsFilled = hasSavedDoc ? totalGroups : Object.keys(GROUPS).filter(g => JSON.stringify(groupPredictions[g]) !== JSON.stringify(GROUPS[g])).length;
  const specialsFilled = Object.values(specialPredictions).filter(v => v && v.trim() !== '').length;
  const matchesFilled = Object.values(matchPredictions).filter(m => m.home !== '' && m.away !== '').length;

  const totalSpecials = SPECIAL_QUESTIONS.length;
  const totalMatches = MATCHES.length;

  return (
    <div className="max-w-4xl mx-auto space-y-8 px-4 sm:px-6 py-6 md:py-8">
      <CountdownBanner />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <div className="w-full md:w-auto flex-1">
          <h1 className="text-3xl font-bold text-gray-900 text-center md:text-left">Mis Predicciones</h1>
          <p className="text-gray-500 mt-2 text-justify md:text-left">
            {effectiveIsLocked 
              ? "Tus predicciones están fijadas y no pueden ser modificadas." 
              : "Podés 'Guardar Borrador' cuantas veces quieras. Las elecciones solo se van a fijar permanentemente al hacer clic en 'Fijar Predicciones' (esta acción se puede hacer solo una vez)."}
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto mt-4 md:mt-0 shrink-0">
          {!effectiveIsLocked && (
            <>
              <Button 
                variant="outline" 
                onClick={() => savePredictions(false)}
                disabled={saving}
                className="w-full sm:w-auto flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" /> {saving ? "Guardando..." : "Guardar Borrador"}
              </Button>
              <Button 
                onClick={() => setConfirmLock(true)}
                disabled={saving}
                className="w-full sm:w-auto flex items-center justify-center gap-2 text-white"
                style={{ backgroundColor: 'var(--brand-color, #16a34a)', borderColor: 'var(--brand-color, #16a34a)' }}
              >
                <Lock className="w-4 h-4" /> Fijar Predicciones
              </Button>
            </>
          )}
          {effectiveIsLocked && (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 px-4 py-2 rounded-md border border-green-200 w-full justify-center">
              <Lock className="w-4 h-4" /> Predicciones Fijadas
            </div>
          )}
        </div>
      </div>

      {/* Progress Section */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-gray-800">Progreso de tus Predicciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Fase de Grupos</span>
              <span className="font-medium text-brand">{groupsFilled} / {totalGroups}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-brand h-2 rounded-full transition-all duration-500" style={{ width: `${(groupsFilled / totalGroups) * 100}%` }}></div>
            </div>
          </div>
          
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Preguntas Especiales</span>
              <span className="font-medium text-brand">{specialsFilled} / {totalSpecials}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-brand h-2 rounded-full transition-all duration-500" style={{ width: `${(specialsFilled / totalSpecials) * 100}%` }}></div>
            </div>
          </div>
          
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Partidos Individuales</span>
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
      <div className="flex flex-wrap gap-2 justify-center">
        <Button 
          variant={activeTab === 'groups' ? 'default' : 'outline'} 
          onClick={() => setActiveTab('groups')}
          className={activeTab === 'groups' ? 'text-white border-transparent' : 'text-gray-700 bg-white'}
          style={activeTab === 'groups' ? { backgroundColor: 'var(--brand-color, #1e3a8a)' } : {}}
        >
          Fase de Grupos
        </Button>
        <Button 
          variant={activeTab === 'specials' ? 'default' : 'outline'} 
          onClick={() => setActiveTab('specials')}
          className={activeTab === 'specials' ? 'text-white border-transparent' : 'text-gray-700 bg-white'}
          style={activeTab === 'specials' ? { backgroundColor: 'var(--brand-color, #1e3a8a)' } : {}}
        >
          Preguntas Especiales
        </Button>
        <Button 
          variant={activeTab === 'matches' ? 'default' : 'outline'} 
          onClick={() => setActiveTab('matches')}
          className={activeTab === 'matches' ? 'text-white border-transparent' : 'text-gray-700 bg-white'}
          style={activeTab === 'matches' ? { backgroundColor: 'var(--brand-color, #1e3a8a)' } : {}}
        >
          Partidos Individuales
        </Button>
        <Button 
          variant={activeTab === 'knockouts' ? 'default' : 'outline'} 
          onClick={() => setActiveTab('knockouts')}
          className={activeTab === 'knockouts' ? 'text-white border-transparent' : 'text-gray-700 bg-white'}
          style={activeTab === 'knockouts' ? { backgroundColor: 'var(--brand-color, #1e3a8a)' } : {}}
        >
          Fase Eliminatoria
        </Button>
      </div>

      {activeTab === 'groups' && (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold pb-2" style={{ borderBottom: '2px solid var(--brand-color, #1e3a8a)', color: 'var(--brand-color, #1e3a8a)' }}>Fase de Grupos</h2>
        <p className="text-sm text-gray-600 mb-4 text-justify">Arrastrá los equipos para ordenarlos del 1º al 4º puesto. Los dos primeros y los 8 mejores terceros avanzan a 16avos.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10">
          {Object.entries(groupPredictions)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([groupLetter, teams]) => (
            <Card key={groupLetter} className="overflow-hidden border-t-4" style={{ borderTopColor: 'var(--brand-color, #2563eb)' }}>
              <CardHeader className="bg-gray-50 py-3 px-4 border-b">
                <CardTitle className="text-lg">Grupo {groupLetter}</CardTitle>
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
        <p className="text-sm text-gray-600 mb-4 text-justify">Por favor, escribí el nombre completo del jugador o selección elegida para evitar confusiones en la corrección.</p>
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
        <div className="bg-brand/10 border border-brand/20 p-4 rounded-lg text-brand text-sm mb-4">
          <p className="font-bold mb-1 italic">¿Le tuviste demasiada fe a un equipo? ¿Lesión de último minuto? ¡No pasa nada!</p>
          <p>Podés predecir hasta 1 hora antes de cada partido. Acertar ganador/empate = <strong className="text-green-700">1 punto</strong>. Resultado exacto = <strong className="text-green-700">+1 punto extra</strong>.</p>
        </div>

        <div className="space-y-3">
          {sortedDates.map(date => (
            <details key={date} className="group bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden" open={new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long' }) === date.toLowerCase()}>
              <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors list-none">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-yellow-50">
                    <Calendar className="w-5 h-5 text-yellow-600" />
                  </div>
                  <h3 className="font-bold text-gray-800">{date}</h3>
                </div>
                <div className="text-gray-400 group-open:rotate-180 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </div>
              </summary>
              
              <div className="p-4 pt-0 space-y-4 border-t border-gray-100">
                {matchesByDate[date].sort((a, b) => a.time.localeCompare(b.time)).map(match => (
                  <div key={match.id} className="bg-gray-50/50 rounded-xl p-4 border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-8">
                    {/* Time (Desktop) / Label (Mobile) */}
                    <div className="flex md:flex-col items-center justify-between md:justify-center md:items-start shrink-0 min-w-[60px]">
                      <div className="flex items-center gap-1 text-[10px] uppercase font-black text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                        <Clock className="w-3 h-3" /> {match.time}
                      </div>
                      <div className="md:mt-1">
                        {matchPredictions[match.id]?.home !== undefined && matchPredictions[match.id]?.away !== undefined && matchPredictions[match.id]?.home !== '' && matchPredictions[match.id]?.away !== '' ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" title="Guardado" />
                        ) : (
                          <Bell className="w-4 h-4 text-blue-400 animate-pulse" title="Pendiente" />
                        )}
                      </div>
                    </div>

                    {/* Match Grid */}
                    <div className="flex-1 flex items-center justify-center gap-2 sm:gap-6">
                      {/* Home */}
                      <div className="flex flex-col sm:flex-row items-center gap-2 flex-1 justify-end min-w-0">
                        <span className="font-bold text-gray-800 uppercase text-xs sm:text-sm truncate order-2 sm:order-1">{match.home}</span>
                        <div className="shrink-0 w-10 h-7 bg-white rounded shadow-sm overflow-hidden flex items-center justify-center border border-gray-100 order-1 sm:order-2">
                          {TEAM_FLAGS[match.home] ? (
                            <img src={`https://flagcdn.com/w40/${TEAM_FLAGS[match.home]}.png`} alt={match.home} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xl">🏳️</span>
                          )}
                        </div>
                      </div>

                      {/* Inputs */}
                      <div className="flex items-center gap-1 shrink-0">
                        <input 
                          type="number" 
                          min="0" 
                          max="20"
                          value={matchPredictions[match.id]?.home ?? ''}
                          onChange={(e) => handleMatchChange(match.id, 'home', e.target.value, match.date, match.time)}
                          disabled={checkMatchLocked(match.date, match.time)}
                          className="w-10 sm:w-12 h-10 text-center font-black text-lg bg-white border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 transition-all"
                        />
                        <span className="font-bold text-gray-400">-</span>
                        <input 
                          type="number" 
                          min="0" 
                          max="20"
                          value={matchPredictions[match.id]?.away ?? ''}
                          onChange={(e) => handleMatchChange(match.id, 'away', e.target.value, match.date, match.time)}
                          disabled={checkMatchLocked(match.date, match.time)}
                          className="w-10 sm:w-12 h-10 text-center font-black text-lg bg-white border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 transition-all"
                        />
                      </div>

                      {/* Away */}
                      <div className="flex flex-col sm:flex-row items-center gap-2 flex-1 justify-start min-w-0">
                        <div className="shrink-0 w-10 h-7 bg-white rounded shadow-sm overflow-hidden flex items-center justify-center border border-gray-100">
                          {TEAM_FLAGS[match.away] ? (
                            <img src={`https://flagcdn.com/w40/${TEAM_FLAGS[match.away]}.png`} alt={match.away} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xl">🏳️</span>
                          )}
                        </div>
                        <span className="font-bold text-gray-800 uppercase text-xs sm:text-sm truncate">{match.away}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      </div>
      )}

      {activeTab === 'knockouts' && (
      <div className="space-y-6 pb-12">
        <h2 className="text-2xl font-bold pb-2" style={{ borderBottom: '2px solid var(--brand-color, #1e3a8a)', color: 'var(--brand-color, #1e3a8a)' }}>Fase Eliminatoria</h2>
        <p className="text-sm text-gray-600 mb-4 text-justify">El cuadro final se irá armando a medida que avance el torneo. ¡Preparate para los cruces decisivos!</p>
        <Bracket />
      </div>
      )}

      {confirmLock && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 mb-2">¿Fijar predicciones?</h3>
            <p className="text-gray-600 mb-6">Una vez fijadas, no vas a poder modificarlas. ¿Estás seguro de que querés continuar?</p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setConfirmLock(false)}>Cancelar</Button>
              <Button 
                className="bg-green-600 hover:bg-green-700 text-white" 
                onClick={() => { 
                  setConfirmLock(false); 
                  savePredictions(true); 
                }}
                disabled={saving}
              >
                {saving ? "Fijando..." : "Sí, fijar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-12">
        <Fixture />
      </div>
    </div>
  );
}
