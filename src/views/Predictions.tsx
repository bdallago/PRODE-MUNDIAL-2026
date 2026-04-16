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

  const handleMatchChange = (matchId: string, team: 'home' | 'away', value: string) => {
    if (effectiveIsLocked) return;
    const numValue = value === '' ? '' : parseInt(value, 10);
    if (value !== '' && (isNaN(numValue as number) || (numValue as number) < 0)) return;
    
    setMatchPredictions(prev => ({
      ...prev,
      [matchId]: {
        ...(prev[matchId] || { home: '', away: '' }),
        [team]: numValue
      }
    }));
  };

  const savePredictions = async (lock: boolean = false) => {
    setSaving(true);
    setMessage(null);
    
    try {
      const docRef = doc(db, "predictions", user.uid);
      await setDoc(docRef, {
        uid: user.uid,
        groups: groupPredictions,
        specials: specialPredictions,
        knockouts: knockoutPredictions,
        matches: matchPredictions,
        isLocked: lock || effectiveIsLocked,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      if (lock || effectiveIsLocked) {
        setIsLocked(true);
      }
      
      setMessage({ type: 'success', text: lock ? 'Predicciones guardadas y fijadas con éxito.' : 'Predicciones guardadas con éxito.' });
    } catch (error) {
      console.error("Error saving predictions:", error);
      setMessage({ type: 'error', text: 'Hubo un error al guardar. Intenta de nuevo.' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 5000);
    }
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

  // Calculate progress
  const groupsFilled = Object.keys(GROUPS).filter(g => JSON.stringify(groupPredictions[g]) !== JSON.stringify(GROUPS[g])).length;
  const specialsFilled = Object.values(specialPredictions).filter(v => v && v.trim() !== '').length;
  const matchesFilled = Object.values(matchPredictions).filter(m => m.home !== '' && m.away !== '').length;

  const totalGroups = Object.keys(GROUPS).length;
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
              <span className="font-medium text-purple-600">{specialsFilled} / {totalSpecials}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-purple-600 h-2 rounded-full transition-all duration-500" style={{ width: `${(specialsFilled / totalSpecials) * 100}%` }}></div>
            </div>
          </div>
          
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Partidos Individuales</span>
              <span className="font-medium text-green-600">{matchesFilled} / {totalMatches}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-green-600 h-2 rounded-full transition-all duration-500" style={{ width: `${(matchesFilled / totalMatches) * 100}%` }}></div>
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
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-blue-800 text-sm mb-8">
          <p className="font-bold mb-1">¿Le tuviste demasiada fe a un equipo en la previa? ¿Una lesión de última hora? ¡No pasa nada!</p>
          <p>Podés hacer tu predicción del resultado final hasta 1 hora antes de cada partido. Si acertás el resultado (quién gana o si empatan) te llevás <strong>1 punto</strong>. Si además lo hacés con el resultado exacto, te llevás <strong>1 punto extra</strong> (Total: 2 puntos).</p>
        </div>

        <div className="space-y-12">
          {sortedDates.map(date => (
            <div key={date} className="space-y-4">
              <div className="text-center flex items-center justify-center gap-2 mb-6">
                <Calendar className="w-5 h-5 text-yellow-600" />
                <h3 className="text-lg font-bold text-yellow-600">{date}</h3>
              </div>

              <div className="space-y-3">
                {matchesByDate[date].sort((a, b) => a.time.localeCompare(b.time)).map(match => (
                  <div key={match.id} className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4">
                    {/* Time */}
                    <div className="hidden md:flex w-20 justify-end text-sm text-gray-500 font-bold items-center gap-1">
                      <Clock className="w-4 h-4" /> {match.time}
                    </div>
                    
                    {/* Pill */}
                    <div className="w-full md:flex-1 max-w-4xl bg-white rounded-3xl shadow-sm hover:shadow-md transition-shadow border border-gray-200 flex flex-col md:flex-row items-center justify-between p-4 relative">
                      {/* Mobile Time */}
                      <div className="md:hidden absolute top-3 left-4 text-xs text-gray-400 font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {match.time}
                      </div>

                      {/* Home Team */}
                      <div className="flex items-center justify-between w-full md:w-[45%] mt-6 md:mt-0 md:pl-2">
                        <div className="flex items-center gap-3">
                          {TEAM_FLAGS[match.home] ? (
                            <img src={`https://flagcdn.com/w40/${TEAM_FLAGS[match.home]}.png`} alt={match.home} className="w-8 h-auto rounded-sm shadow-sm" />
                          ) : (
                            <span className="text-2xl">🏳️</span>
                          )}
                          <span className="font-bold text-gray-800 uppercase text-sm md:text-base truncate">{match.home}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-gray-300 font-bold hidden md:inline">-</span>
                          <input 
                            type="number" 
                            min="0" 
                            max="20"
                            value={matchPredictions[match.id]?.home ?? ''}
                            onChange={(e) => handleMatchChange(match.id, 'home', e.target.value)}
                            disabled={effectiveIsLocked}
                            className="w-12 h-12 text-center font-bold text-lg bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                          />
                        </div>
                      </div>

                      {/* Center Divider */}
                      <div className="hidden md:flex items-center justify-center w-[10%]">
                        <div className="w-px h-8 border-l-2 border-dashed border-gray-300"></div>
                      </div>
                      <div className="md:hidden w-full flex justify-center my-2">
                         <div className="h-px w-8 border-t-2 border-dashed border-gray-300"></div>
                      </div>

                      {/* Away Team */}
                      <div className="flex items-center justify-between w-full md:w-[45%] mb-2 md:mb-0 md:pr-2">
                        <div className="flex items-center gap-3">
                          <input 
                            type="number" 
                            min="0" 
                            max="20"
                            value={matchPredictions[match.id]?.away ?? ''}
                            onChange={(e) => handleMatchChange(match.id, 'away', e.target.value)}
                            disabled={effectiveIsLocked}
                            className="w-12 h-12 text-center font-bold text-lg bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                          />
                          <span className="text-gray-300 font-bold hidden md:inline">-</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-gray-800 uppercase text-sm md:text-base truncate">{match.away}</span>
                          {TEAM_FLAGS[match.away] ? (
                            <img src={`https://flagcdn.com/w40/${TEAM_FLAGS[match.away]}.png`} alt={match.away} className="w-8 h-auto rounded-sm shadow-sm" />
                          ) : (
                            <span className="text-2xl">🏳️</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="hidden md:flex w-32 justify-start">
                      {matchPredictions[match.id]?.home !== undefined && matchPredictions[match.id]?.away !== undefined && matchPredictions[match.id]?.home !== '' && matchPredictions[match.id]?.away !== '' ? (
                        <div className="flex items-center gap-1 text-xs font-bold bg-green-100 text-green-700 px-3 py-1.5 rounded-full">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Guardado
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-xs font-bold bg-red-100 text-red-600 px-3 py-1.5 rounded-full">
                          <Bell className="w-3.5 h-3.5" /> Predecir
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
