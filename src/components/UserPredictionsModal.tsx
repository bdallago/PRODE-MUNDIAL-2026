"use client";

import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { GROUPS, SPECIAL_QUESTIONS, TEAM_FLAGS } from "../data";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { X, Lock, Unlock, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "./ui/button";

interface UserPredictionsModalProps {
  userId: string;
  userName: string;
  onClose: () => void;
}

export function UserPredictionsModal({ userId, userName, onClose }: UserPredictionsModalProps) {
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

        if (predSnap.exists()) {
          setPredictions(predSnap.data());
        }
        if (resSnap.exists()) {
          setResults(resSnap.data());
        }
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

  const getGroupStatus = (groupLetter: string, predictedTeams: string[]) => {
    if (!results || !results.groups || !results.groups[groupLetter]) return null;
    const actualTeams = results.groups[groupLetter];
    
    // Check if actual results are actually filled
    if (!actualTeams || actualTeams.length === 0 || actualTeams.every((t: string) => !t)) return null;
    
    let exactMatches = 0;
    for (let i = 0; i < 4; i++) {
      if (predictedTeams[i] === actualTeams[i]) {
        exactMatches++;
      }
    }

    const isPerfect = exactMatches === 4;
    const totalPoints = exactMatches + (isPerfect ? 2 : 0);
    
    return {
      isPerfect,
      exactMatches,
      totalPoints,
      actualTeams
    };
  };

  const getSpecialStatus = (questionId: string, answer: string) => {
    if (!results || !results.specials || !results.specials[questionId]) return null;
    const actualAnswer = results.specials[questionId];
    if (!actualAnswer || !answer) return null;
    
    // Simple string matching (case insensitive)
    if (answer.trim().toLowerCase() === actualAnswer.trim().toLowerCase()) {
      return { correct: true, points: 10 }; 
    }
    return { correct: false, points: 0 };
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full shadow-xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b shrink-0 bg-white z-10 sticky top-0">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">Predicciones de {userName}</h3>
            <div className="flex items-center gap-2 mt-1">
              {isLocked ? (
                <span className="flex items-center gap-1 text-sm text-green-700 bg-green-50 px-2 py-1 rounded-md border border-green-200">
                  <Lock className="w-3 h-3" /> Fijadas
                </span>
              ) : (
                <span className="flex items-center gap-1 text-sm text-blue-700 bg-blue-50 px-2 py-1 rounded-md border border-blue-200">
                  <Unlock className="w-3 h-3" /> Borrador
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 p-2 bg-gray-100 rounded-full"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 overflow-y-auto space-y-8">
          <div>
            <h4 className="text-xl font-bold text-blue-900 mb-4">Fase de Grupos</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(groups)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([groupLetter, teams]) => {
                const groupStatus = getGroupStatus(groupLetter, teams as string[]);
                
                return (
                  <Card key={groupLetter} className="overflow-hidden border-t-4 border-t-blue-600">
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
                                <span className={`font-bold w-5 text-center shrink-0 ${index < 2 ? 'text-blue-600' : 'text-gray-400'}`}>
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
                              {icon && (
                                <div className="flex items-center gap-2">
                                  {icon}
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                      {groupStatus && groupStatus.isPerfect && (
                         <div className="bg-green-100 p-2 text-center text-sm font-bold text-green-800 border-t border-green-200">
                           ¡Grupo Perfecto! (+2 pts)
                         </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          <div>
            <h4 className="text-xl font-bold text-blue-900 mb-4">Preguntas Especiales</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SPECIAL_QUESTIONS.map((q) => {
                const answer = specials[q.id] || "Sin respuesta";
                const status = getSpecialStatus(q.id, answer);
                let bgColor = "bg-gray-50";
                let borderColor = "border-gray-200";
                
                if (status) {
                  bgColor = status.correct ? "bg-green-50" : "bg-red-50";
                  borderColor = status.correct ? "border-green-200" : "border-red-200";
                }

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
                            {status.correct ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-500" />}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
