"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Flag } from "lucide-react";
import { GROUPS, MATCHES, TEAM_FLAGS } from "../data";
import { doc, getDocFromCache, getDocFromServer } from "firebase/firestore";
import { db } from "../firebase";
import { useLanguage } from "../i18n/LanguageContext";

const MONTHS_ES_IDX: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
};
const DAY_SHORT_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function parseDateStr(dateStr: string): Date {
  const parts = dateStr.split(" ");
  return new Date(2026, MONTHS_ES_IDX[parts[2].toLowerCase()], parseInt(parts[0]));
}

function formatDisplayDate(dateStr: string): string {
  const d = parseDateStr(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${DAY_SHORT_ES[d.getDay()]} ${day}/${month}`;
}

const FIXTURE_DATA = (() => {
  const result: Array<Array<{ group: string; date: string; displayDate: string; time: string; team1: string; team2: string }>> = [[], [], []];
  for (const m of MATCHES) {
    const day = parseDateStr(m.date).getDate();
    const fecha = day <= 17 ? 0 : day <= 23 ? 1 : 2;
    result[fecha].push({ group: m.group, date: m.date, displayDate: formatDisplayDate(m.date), time: m.time, team1: m.home, team2: m.away });
  }
  for (const f of result) {
    f.sort((a, b) => {
      const diff = parseDateStr(a.date).getTime() - parseDateStr(b.date).getTime();
      return diff !== 0 ? diff : a.time.localeCompare(b.time);
    });
  }
  return result;
})();

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
  const { t } = useLanguage();
  const tTeams = t.teams as Record<string, string>;
  const tDays = t.fixture.days as Record<string, string>;
  const translateDate = (date: string) => {
    const [day, num] = date.split(' ');
    return `${tDays[day] || day} ${num}`;
  };
  const [currentFecha, setCurrentFecha] = useState(0);
  const [actualGroups, setActualGroups] = useState<Record<string, string[]>>(GROUPS);
  const [groupStandings, setGroupStandings] = useState<Record<string, Record<string, { pts: number; played: number; gf: number; ga: number; gd: number; w: number; d: number; l: number }>>>({});

  useEffect(() => {
    const fetchActualResults = async () => {
      try {
        const docRef = doc(db, "results", "actual");
        let docSnap;
        try {
          docSnap = await getDocFromCache(docRef);
        } catch (e) {
          docSnap = await getDocFromServer(docRef);
        }
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.standings) {
            setGroupStandings(data.standings);
          }
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
    if (!groupedMatches[match.displayDate]) {
      groupedMatches[match.displayDate] = [];
    }
    groupedMatches[match.displayDate].push(match);
  });

  return (
    <div className="w-full max-w-6xl mx-auto mt-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Fixture Column */}
        <div className="bg-white rounded-xl overflow-hidden shadow-lg border border-slate-200">
          {/* Header */}
          <div className="bg-brand text-white p-4 text-center">
            <h2 className="text-lg font-bold tracking-wider mb-4 text-white">{t.fixture.title}</h2>
            <div className="flex items-center justify-between px-4">
              <button onClick={handlePrev} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="font-bold text-base">{t.fixture.matchday} {currentFecha + 1}</span>
              <button onClick={handleNext} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Matches */}
          <div className="bg-white">
            {Object.entries(groupedMatches).map(([date, dayMatches]) => (
              <div key={date}>
                <div className="bg-slate-100 text-slate-700 text-center py-1.5 text-sm font-bold border-y border-slate-200 uppercase tracking-wide">
                  {translateDate(date)}
                </div>
                <div className="divide-y divide-slate-100">
                  {dayMatches.map((match, idx) => (
                    <div key={idx} className="flex items-center text-slate-800 hover:bg-slate-50 transition-colors">
                      <div className="w-14 sm:w-16 text-center py-3 text-xs sm:text-sm font-semibold text-slate-500 border-r border-slate-100 flex-shrink-0">
                        {match.time}
                      </div>
                      <div className="flex-1 grid grid-cols-[1fr_24px_16px_24px_1fr] sm:grid-cols-[1fr_28px_20px_28px_1fr] items-center py-2 sm:py-3 px-2 sm:px-4 gap-1 sm:gap-2">
                        <div className="text-center font-semibold text-xs sm:text-sm truncate px-1">{tTeams[match.team1] || match.team1}</div>
                        <div className="flex justify-center"><TeamFlag teamName={match.team1} /></div>
                        <div className="text-center text-slate-400 font-bold text-xs sm:text-sm">-</div>
                        <div className="flex justify-center"><TeamFlag teamName={match.team2} /></div>
                        <div className="text-center font-semibold text-xs sm:text-sm truncate px-1">{tTeams[match.team2] || match.team2}</div>
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
            <h2 className="text-lg font-bold tracking-wider mb-4 text-white">{t.fixture.groupStage}</h2>
            <div className="flex items-center justify-center px-4 h-7">
              <span className="font-bold text-base">{t.fixture.standings}</span>
            </div>
          </div>

          {/* Groups */}
          <div className="bg-white p-0">
            {Object.entries(actualGroups)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([groupLetter, teams]) => (
              <div key={groupLetter} className="border-b border-slate-200 last:border-b-0">
                <div className="bg-brand text-white text-left py-2 px-3 text-sm font-bold tracking-wide flex justify-between">
                  <span>{t.fixture.group} {groupLetter}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm text-left table-fixed">
                    <thead className="text-[10px] sm:text-xs text-slate-500 bg-slate-50 border-b border-slate-200 uppercase">
                      <tr>
                        <th className="w-8 sm:w-10 py-2 text-center">#</th>
                        <th className="py-2 text-left">{t.fixture.teams}</th>
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
                              <span className="truncate">{tTeams[team] || team}</span>
                            </div>
                          </td>
                          {(() => {
                            const s = groupStandings[groupLetter]?.[team];
                            return s ? (
                              <>
                                <td className="py-2 text-center font-bold text-slate-800">{s.pts}</td>
                                <td className="py-2 text-center text-slate-500">{s.played}</td>
                                <td className="py-2 text-center text-slate-500">{s.gf}:{s.ga}</td>
                                <td className="py-2 text-center text-slate-500">{s.gd > 0 ? `+${s.gd}` : s.gd}</td>
                                <td className="py-2 text-center text-slate-500">{s.w}</td>
                                <td className="py-2 text-center text-slate-500">{s.d}</td>
                                <td className="py-2 text-center text-slate-500">{s.l}</td>
                              </>
                            ) : (
                              <>
                                <td className="py-2 text-center font-bold text-slate-800">0</td>
                                <td className="py-2 text-center text-slate-500">0</td>
                                <td className="py-2 text-center text-slate-500">0:0</td>
                                <td className="py-2 text-center text-slate-500">0</td>
                                <td className="py-2 text-center text-slate-500">0</td>
                                <td className="py-2 text-center text-slate-500">0</td>
                                <td className="py-2 text-center text-slate-500">0</td>
                              </>
                            );
                          })()}
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
