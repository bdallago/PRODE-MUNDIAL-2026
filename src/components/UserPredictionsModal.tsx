"use client";

import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { GROUPS, MATCHES, SPECIAL_QUESTIONS, TEAM_FLAGS } from "../data";
import { useAppContext } from "./Providers";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { X, Lock, Unlock, CheckCircle2, XCircle, Minus } from "lucide-react";
import { Button } from "./ui/button";

interface UserPredictionsModalProps {
  userId: string;
  userName: string;
  onClose: () => void;
}

type MatchOutcome = "exact" | "correct" | "wrong" | "no_prediction" | "pending";

function getMatchOutcome(
  predicted: { home: number | string; away: number | string } | undefined,
  actual: { home: any; away: any } | undefined
): MatchOutcome {
  const hasActual = actual && actual.home !== undefined && actual.away !== undefined &&
    !isNaN(parseInt(String(actual.home))) && !isNaN(parseInt(String(actual.away)));
  if (!hasActual) return "pending";
  const hasPred = predicted && predicted.home !== '' && predicted.away !== '' &&
    !isNaN(parseInt(String(predicted.home))) && !isNaN(parseInt(String(predicted.away)));
  if (!hasPred) return "no_prediction";
  const ah = parseInt(String(actual.home));
  const aa = parseInt(String(actual.away));
  const ph = parseInt(String(predicted.home));
  const pa = parseInt(String(predicted.away));
  if (ph === ah && pa === aa) return "exact";
  const ao = ah > aa ? "home" : ah < aa ? "away" : "draw";
  const po = ph > pa ? "home" : ph < pa ? "away" : "draw";
  return ao === po ? "correct" : "wrong";
}

export function UserPredictionsModal({ userId, userName, onClose }: UserPredictionsModalProps) {
  const { companyDetails } = useAppContext();
  const disabledSpecials: string[] = companyDetails?.disabledSpecials ?? [];
  const activeSpecialQuestions = SPECIAL_QUESTIONS.filter(q => !disabledSpecials.includes(q.id));
  const [loading, setLoading] = useState(true);
  const [predictions, setPredictions] = useState<any>(null);
  const [results, setResults] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [predSnap, resSnap] = await Promise.all([
          getDoc(doc(db, "predictions", userId)),
          getDoc(doc(db, "results", "actual"))
        ]);
        if (predSnap.exists()) setPredictions(predSnap.data());
        if (resSnap.exists()) setResults(resSnap.data());
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userId]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
        <div className="bg-white rounded-lg p-6 max-w-4xl w-full shadow-xl max-h-[90vh] overflow-y-auto">
          <div className="text-center py-10">Cargando predicciones de {userName}...</div>
        </div>
      </div>
    );
  }

  if (!predictions) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
        <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-900">Predicciones de {userName}</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><X className="w-5 h-5" /></button>
          </div>
          <p className="text-gray-600 py-4 text-center">Este usuario aún no ha guardado ninguna predicción.</p>
          <div className="flex justify-end mt-4">
            <Button onClick={onClose}>Cerrar</Button>
          </div>
        </div>
      </div>
    );
  }

  const isLocked = predictions.isLocked;
  const groups = predictions.groups || GROUPS;
  const specials = predictions.specials || {};
  const matchPreds: Record<string, { home: number | string; away: number | string }> = predictions.matches || {};
  const actualMatches: Record<string, any> = results?.matches || {};
  const finishedGroups: string[] = results?.finishedGroups || [];
  const groupScoringEnabled = finishedGroups.length > 0;
  // Las preguntas especiales se ocultan por ahora en esta visualización.
  // Poner en true para volver a mostrarlas.
  const SHOW_SPECIAL_RESULTS = false;

  // Group matches by date for display
  const matchesByDate: Record<string, typeof MATCHES> = {};
  for (const m of MATCHES) {
    if (!matchesByDate[m.date]) matchesByDate[m.date] = [];
    matchesByDate[m.date].push(m);
  }

  const getGroupStatus = (groupLetter: string, predictedTeams: string[]) => {
    if (!results?.groups?.[groupLetter]) return null;
    const actualTeams = results.groups[groupLetter];
    if (!actualTeams?.length || actualTeams.every((t: string) => !t)) return null;

    let exactMatches = 0;
    for (let i = 0; i < 4; i++) {
      if (predictedTeams[i] === actualTeams[i]) exactMatches++;
    }
    const isPerfect = exactMatches === 4;
    return { isPerfect, exactMatches, totalPoints: exactMatches + (isPerfect ? 3 : 0), actualTeams };
  };

  const getSpecialStatus = (questionId: string, answer: string) => {
    if (!results?.specials?.[questionId] || !answer) return null;
    const actualAnswer = results.specials[questionId];
    if (!actualAnswer) return null;
    return answer.trim().toLowerCase() === actualAnswer.trim().toLowerCase()
      ? { correct: true, points: 10 }
      : { correct: false, points: 0 };
  };

  const outcomeStyle: Record<MatchOutcome, { bg: string; border: string; badge: string; pts: string }> = {
    exact:        { bg: "bg-yellow-50", border: "border-yellow-400", badge: "bg-yellow-100 text-yellow-800", pts: "+2 pts" },
    correct:      { bg: "bg-green-50",  border: "border-green-300",  badge: "bg-green-100 text-green-800",   pts: "+1 pt"  },
    wrong:        { bg: "bg-red-50",    border: "border-red-300",    badge: "bg-red-100 text-red-700",       pts: "+0 pts" },
    no_prediction:{ bg: "bg-blue-50",   border: "border-blue-200",   badge: "bg-blue-100 text-blue-700",     pts: "Sin predicción" },
    pending:      { bg: "bg-gray-50",   border: "border-gray-200",   badge: "bg-gray-100 text-gray-500",     pts: ""       },
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full shadow-xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b shrink-0 bg-white z-10">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">Predicciones de {userName}</h3>
            <div className="flex items-center gap-2 mt-1">
              {isLocked ? (
                <span className="flex items-center gap-1 text-sm text-green-700 bg-green-50 px-2 py-1 rounded-md border border-green-200">
                  <Lock className="w-3 h-3" /> Fijadas
                </span>
              ) : (
                <span className="flex items-center gap-1 text-sm text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-200">
                  <Unlock className="w-3 h-3" /> Borrador
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 p-2 bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-8">

          {/* ── Partidos ── */}
          <div>
            <h4 className="text-xl font-bold text-brand mb-4">Partidos</h4>
            <div className="space-y-6">
              {Object.entries(matchesByDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, dayMatches]) => (
                <div key={date}>
                  <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{date}</p>
                  <div className="space-y-2">
                    {[...dayMatches].sort((a, b) => a.time.localeCompare(b.time)).map(match => {
                      const pred = matchPreds[match.id];
                      const actual = actualMatches[match.id];
                      const outcome = getMatchOutcome(pred, actual);
                      const style = outcomeStyle[outcome];
                      const hasPred = pred && pred.home !== '' && pred.away !== '';

                      return (
                        <div
                          key={match.id}
                          className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${style.bg} ${style.border}`}
                        >
                          {/* Teams */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
                              {TEAM_FLAGS[match.home] && (
                                <img src={`https://flagcdn.com/w40/${TEAM_FLAGS[match.home]}.png`} alt={match.home} className="w-5 h-3.5 object-cover rounded-sm shadow-sm shrink-0" referrerPolicy="no-referrer" />
                              )}
                              <span className="hidden sm:inline truncate">{match.home}</span>
                              <span className="text-gray-400 shrink-0">vs</span>
                              {TEAM_FLAGS[match.away] && (
                                <img src={`https://flagcdn.com/w40/${TEAM_FLAGS[match.away]}.png`} alt={match.away} className="w-5 h-3.5 object-cover rounded-sm shadow-sm shrink-0" referrerPolicy="no-referrer" />
                              )}
                              <span className="hidden sm:inline truncate">{match.away}</span>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">{match.time} · Grupo {match.group}</p>
                          </div>

                          {/* Scores */}
                          <div className="flex items-center gap-3 shrink-0">
                            {/* Predicted */}
                            <div className="text-center">
                              <p className="text-xs text-gray-400 mb-0.5">Predicción</p>
                              <span className="text-lg font-bold text-gray-800">
                                {hasPred ? `${pred.home} - ${pred.away}` : <span className="text-sm text-gray-400 italic">—</span>}
                              </span>
                            </div>

                            {/* Actual — show whenever result exists, regardless of prediction */}
                            {actual && !isNaN(parseInt(String(actual.home))) && (
                              <>
                                <div className="text-gray-300 text-lg font-light">|</div>
                                <div className="text-center">
                                  <p className="text-xs text-gray-400 mb-0.5">Real</p>
                                  <span className="text-lg font-bold text-gray-800">{actual.home} - {actual.away}</span>
                                </div>
                              </>
                            )}

                            {/* Outcome badge */}
                            {style.pts && (
                              <span className={`text-sm font-bold px-2 py-1 rounded-full ${style.badge}`}>
                                {style.pts}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Preguntas Especiales (ocultas por ahora) ── */}
          {SHOW_SPECIAL_RESULTS && (
          <div>
            <h4 className="text-xl font-bold text-brand mb-4">Preguntas Especiales</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeSpecialQuestions.map((q) => {
                const answer = specials[q.id] || "Sin respuesta";
                const status = getSpecialStatus(q.id, answer);
                const bgColor = status ? (status.correct ? "bg-green-50" : "bg-red-50") : "bg-gray-50";
                const borderColor = status ? (status.correct ? "border-green-200" : "border-red-200") : "border-gray-200";

                return (
                  <Card key={q.id} className={`border ${borderColor} ${bgColor}`}>
                    <CardContent className="p-4">
                      <p className="text-sm font-semibold text-gray-700 mb-2">{q.label}</p>
                      <div className="flex items-center justify-between bg-white p-2 rounded border">
                        <span className="font-medium text-gray-900">{answer}</span>
                        {status && (
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${status.correct ? 'text-green-600' : 'text-red-500'}`}>
                              +{status.points} pts
                            </span>
                            {status.correct
                              ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                              : <XCircle className="w-4 h-4 text-red-500" />
                            }
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
          )}

          {/* ── Fase de Grupos (solo grupos cerrados) ── */}
          {groupScoringEnabled && (
            <div>
              <h4 className="text-xl font-bold text-brand mb-4">Fase de Grupos</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(groups)
                  .filter(([groupLetter]) => finishedGroups.includes(groupLetter))
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([groupLetter, teams]) => {
                    const groupStatus = getGroupStatus(groupLetter, teams as string[]);
                    return (
                      <Card key={groupLetter} className="overflow-hidden border-t-4 border-brand">
                        <CardHeader className="bg-gray-50 py-2 px-4 border-b flex flex-row justify-between items-center">
                          <CardTitle className="text-md">Grupo {groupLetter}</CardTitle>
                          {groupStatus && (
                            <span className={`text-sm font-bold ${groupStatus.totalPoints > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                              +{groupStatus.totalPoints} pts
                            </span>
                          )}
                        </CardHeader>
                        <CardContent className="p-0">
                          <ul className="divide-y">
                            {(teams as string[]).map((team, index) => {
                              let bgColor = "bg-white";
                              let textColor = "text-gray-900";
                              let icon = null;

                              if (groupStatus) {
                                const exactPosition = groupStatus.actualTeams[index] === team;
                                if (exactPosition) {
                                  bgColor = "bg-green-50";
                                  textColor = "text-green-900";
                                  icon = (
                                    <>
                                      <span className="text-sm font-bold text-green-600">+1 pt</span>
                                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                                    </>
                                  );
                                } else {
                                  bgColor = "bg-red-50";
                                  textColor = "text-red-900";
                                  icon = (
                                    <>
                                      <span className="text-sm font-bold text-red-500">+0 pts</span>
                                      <XCircle className="w-4 h-4 text-red-500" />
                                    </>
                                  );
                                }
                              }

                              return (
                                <li key={`${groupLetter}-${index}`} className={`p-3 flex items-center justify-between ${bgColor}`}>
                                  <div className="flex items-center gap-3">
                                    <span className={`font-bold w-5 text-center shrink-0 ${index < 2 ? 'text-brand' : 'text-gray-400'}`}>
                                      {index + 1}
                                    </span>
                                    {TEAM_FLAGS[team] && (
                                      <img
                                        src={`https://flagcdn.com/w40/${TEAM_FLAGS[team]}.png`}
                                        alt={`Bandera de ${team}`}
                                        className="w-6 h-4 object-cover rounded-sm shadow-sm shrink-0"
                                        referrerPolicy="no-referrer"
                                      />
                                    )}
                                    <span className={`font-medium truncate ${textColor}`}>{team}</span>
                                  </div>
                                  {icon && <div className="flex items-center gap-2">{icon}</div>}
                                </li>
                              );
                            })}
                          </ul>
                          {groupStatus?.isPerfect && (
                            <div className="bg-green-100 p-2 text-center text-sm font-bold text-green-800 border-t border-green-200">
                              ¡Grupo Perfecto! (+3 pts)
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            </div>
          )}

          {/* ── Fases Finales ── */}
          {predictions.knockouts && (
            <div>
              <h4 className="text-xl font-bold text-brand mb-4">Fases Finales (Eliminatorias)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(predictions.knockouts).map(([stage, teams]) => {
                  const items = Array.isArray(teams) ? teams : [];
                  return (
                    <Card key={stage} className="border-brand/20">
                      <CardHeader className="bg-brand/5 py-2 px-4 border-b">
                        <CardTitle className="text-sm uppercase tracking-wider text-brand/80">
                          {stage.replace('octavos', 'Octavos').replace('cuartos', 'Cuartos').replace('semis', 'Semis').replace('final', 'Final').replace('campeon', 'Campeón')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3">
                        <ul className="space-y-1">
                          {items.filter(Boolean).map((t: string) => (
                            <li key={t} className="flex items-center gap-2 text-sm text-gray-700">
                              {TEAM_FLAGS[t] && (
                                <img src={`https://flagcdn.com/w40/${TEAM_FLAGS[t]}.png`} alt="" className="w-4 h-3 object-cover rounded-sm" referrerPolicy="no-referrer" />
                              )}
                              <span className="truncate">{t}</span>
                            </li>
                          ))}
                          {items.filter(Boolean).length === 0 && (
                            <li className="text-xs text-gray-400 italic">Sin clasificados</li>
                          )}
                        </ul>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
