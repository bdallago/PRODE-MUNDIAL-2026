"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Flag } from "lucide-react";
import { GROUPS, TEAM_FLAGS } from "../data";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

// Generar el fixture lógicamente
const generateFixture = () => {
  const matchdays = [
    [[0, 1], [2, 3]], // Fecha 1: 1vs2, 3vs4
    [[0, 2], [3, 1]], // Fecha 2: 1vs3, 4vs2
    [[3, 0], [1, 2]]  // Fecha 3: 4vs1, 2vs3
  ];

  const dates = [
    ["Jue 11/06", "Vie 12/06", "Sáb 13/06", "Dom 14/06", "Lun 15/06", "Mar 16/06"],
    ["Mié 17/06", "Jue 18/06", "Vie 19/06", "Sáb 20/06", "Dom 21/06", "Lun 22/06"],
    ["Mar 23/06", "Mié 24/06", "Jue 25/06", "Vie 26/06", "Sáb 27/06", "Dom 28/06"]
  ];

  const times = ["13:00", "16:00", "19:00", "22:00"];

  const fixture: any[] = [[], [], []];

  for (let f = 0; f < 3; f++) {
    let matchCount = 0;
    // Ordenar grupos alfabéticamente
    const sortedGroups = Object.entries(GROUPS).sort(([a], [b]) => a.localeCompare(b));
    
    for (const [group, teams] of sortedGroups) {
      for (const [t1, t2] of matchdays[f]) {
        const dateIdx = Math.floor(matchCount / 4);
        const timeIdx = matchCount % 4;
        
        fixture[f].push({
          group,
          date: dates[f][dateIdx] || dates[f][dates[f].length - 1],
          time: times[timeIdx],
          team1: teams[t1],
          team2: teams[t2]
        });
        
        matchCount++;
      }
    }
  }

  return fixture;
};

const FIXTURE_DATA = generateFixture();

const TeamFlag = ({ teamName }: { teamName: string }) => {
  const code = TEAM_FLAGS[teamName];
  if (code) {
    return (
      <img 
        src={`https://flagcdn.com/w40/${code}.png`} 
        alt={`Bandera de ${teamName}`}
        className="w-6 h-4 object-cover rounded-sm shadow-sm flex-shrink-0"
        referrerPolicy="no-referrer"
      />
    );
  }
  return <Flag className="w-5 h-5 text-gray-400 flex-shrink-0" />;
};

export function Fixture() {
  const [currentFecha, setCurrentFecha] = useState(0);
  const [actualGroups, setActualGroups] = useState<Record<string, string[]>>(GROUPS);

  useEffect(() => {
    const fetchActualResults = async () => {
      try {
        const docRef = doc(db, "results", "actual");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.groups) {
            const sanitizedGroups: Record<string, string[]> = {};
            for (const [groupLetter, teams] of Object.entries(data.groups)) {
              const currentTeams = GROUPS[groupLetter as keyof typeof GROUPS];
              if (currentTeams) {
                const validSavedTeams = (teams as string[]).filter(t => currentTeams.includes(t));
                const missingTeams = currentTeams.filter(t => !validSavedTeams.includes(t));
                sanitizedGroups[groupLetter] = [...validSavedTeams, ...missingTeams];
              }
            }
            // Fill in any missing groups
            for (const groupLetter of Object.keys(GROUPS)) {
              if (!sanitizedGroups[groupLetter]) {
                sanitizedGroups[groupLetter] = [...GROUPS[groupLetter as keyof typeof GROUPS]];
              }
            }
            setActualGroups(sanitizedGroups);
          }
        }
      } catch (error) {
        console.error("Error fetching actual results:", error);
      }
    };
    fetchActualResults();
  }, []);

  const handlePrev = () => {
    setCurrentFecha((prev) => (prev > 0 ? prev - 1 : 2));
  };

  const handleNext = () => {
    setCurrentFecha((prev) => (prev < 2 ? prev + 1 : 0));
  };

  const matches = FIXTURE_DATA[currentFecha];

  // Agrupar partidos por fecha
  const groupedMatches: Record<string, any[]> = {};
  matches.forEach(match => {
    if (!groupedMatches[match.date]) {
      groupedMatches[match.date] = [];
    }
    groupedMatches[match.date].push(match);
  });

  return (
    <div className="w-full max-w-6xl mx-auto mt-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Fixture Column */}
        <div className="bg-white rounded-xl overflow-hidden shadow-lg border border-slate-200">
          {/* Header */}
          <div className="bg-brand text-white p-4 text-center">
            <h2 className="text-lg font-bold tracking-wider mb-4 text-white">FIXTURE MUNDIAL</h2>
            <div className="flex items-center justify-between px-4">
              <button onClick={handlePrev} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="font-bold text-base">FECHA {currentFecha + 1}</span>
              <button onClick={handleNext} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Matches */}
          <div className="bg-white max-h-[600px] overflow-y-auto custom-scrollbar">
            {Object.entries(groupedMatches).map(([date, dayMatches]) => (
              <div key={date}>
                <div className="bg-slate-100 text-slate-700 text-center py-1.5 text-sm font-bold border-y border-slate-200 uppercase tracking-wide">
                  {date}
                </div>
                <div className="divide-y divide-slate-100">
                  {dayMatches.map((match, idx) => (
                    <div key={idx} className="flex items-center text-slate-800 hover:bg-slate-50 transition-colors">
                      <div className="w-14 sm:w-16 text-center py-3 text-xs sm:text-sm font-semibold text-slate-500 border-r border-slate-100 flex-shrink-0">
                        {match.time}
                      </div>
                      <div className="flex-1 grid grid-cols-[1fr_24px_16px_24px_1fr] sm:grid-cols-[1fr_28px_20px_28px_1fr] items-center py-2 sm:py-3 px-2 sm:px-4 gap-1 sm:gap-2">
                        <div className="text-center font-semibold text-xs sm:text-sm truncate px-1">{match.team1}</div>
                        <div className="flex justify-center"><TeamFlag teamName={match.team1} /></div>
                        <div className="text-center text-slate-400 font-bold text-xs sm:text-sm">-</div>
                        <div className="flex justify-center"><TeamFlag teamName={match.team2} /></div>
                        <div className="text-center font-semibold text-xs sm:text-sm truncate px-1">{match.team2}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Standings Column */}
        <div className="bg-white rounded-xl overflow-hidden shadow-lg border border-slate-200">
          {/* Header */}
          <div className="bg-brand text-white p-4 text-center">
            <h2 className="text-lg font-bold tracking-wider mb-4 text-white">FASE DE GRUPOS</h2>
            <div className="flex items-center justify-center px-4 h-7">
              <span className="font-bold text-base">POSICIONES</span>
            </div>
          </div>

          {/* Groups */}
          <div className="bg-white max-h-[600px] overflow-y-auto custom-scrollbar p-0">
            {Object.entries(actualGroups)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([groupLetter, teams]) => (
              <div key={groupLetter} className="border-b border-slate-200 last:border-b-0">
                <div className="bg-brand text-white text-left py-2 px-3 text-sm font-bold tracking-wide flex justify-between">
                  <span>GRUPO {groupLetter}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm text-left table-fixed">
                    <thead className="text-[10px] sm:text-xs text-slate-500 bg-slate-50 border-b border-slate-200 uppercase">
                      <tr>
                        <th className="w-8 sm:w-10 py-2 text-center">#</th>
                        <th className="py-2 text-left">Equipos</th>
                        <th className="w-8 sm:w-10 py-2 text-center font-bold text-slate-700">PTS</th>
                        <th className="w-6 sm:w-8 py-2 text-center">J</th>
                        <th className="w-8 sm:w-10 py-2 text-center">Gol</th>
                        <th className="w-8 sm:w-10 py-2 text-center">+/-</th>
                        <th className="w-6 sm:w-8 py-2 text-center">G</th>
                        <th className="w-6 sm:w-8 py-2 text-center">E</th>
                        <th className="w-6 sm:w-8 py-2 text-center">P</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(teams as string[]).map((team, index) => (
                        <tr key={`${groupLetter}-${index}`} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2 text-center">
                            <div className={`w-5 h-5 sm:w-6 sm:h-6 mx-auto flex items-center justify-center rounded text-[10px] sm:text-xs font-bold text-white ${index < 2 ? 'bg-green-500' : index === 2 ? 'bg-brand' : 'bg-slate-400'}`}>
                              {index + 1}
                            </div>
                          </td>
                          <td className="py-2 font-medium text-slate-800">
                            <div className="flex items-center gap-1.5 sm:gap-2">
                              <TeamFlag teamName={team} />
                              <span className="truncate">{team}</span>
                            </div>
                          </td>
                          <td className="py-2 text-center font-bold text-slate-800">0</td>
                          <td className="py-2 text-center text-slate-500">0</td>
                          <td className="py-2 text-center text-slate-500">0:0</td>
                          <td className="py-2 text-center text-slate-500">0</td>
                          <td className="py-2 text-center text-slate-500">0</td>
                          <td className="py-2 text-center text-slate-500">0</td>
                          <td className="py-2 text-center text-slate-500">0</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
