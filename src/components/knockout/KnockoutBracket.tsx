"use client";

import { useMemo, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { BRACKET_TREE } from "../../lib/bracket/tree";
import { buildDisplayBracket, SlotView } from "../../lib/bracket/displayBracket";
import { isSlotLocked } from "../../lib/bracket/lock";
import type { Round } from "../../lib/bracket/types";
import { KnockoutMatchCard } from "./KnockoutMatchCard";
import { TEAM_FLAGS } from "../../data";

const ROUND_ORDER: Round[] = ["R32", "R16", "QF", "SF", "F"];

const DAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function formatKickoff(ms: number): string {
  const art = new Date(ms - 3 * 60 * 60 * 1000);
  const day = DAYS_ES[art.getUTCDay()];
  const date = `${art.getUTCDate()}/${art.getUTCMonth() + 1}`;
  const hh = String(art.getUTCHours()).padStart(2, "0");
  const mm = String(art.getUTCMinutes()).padStart(2, "0");
  return `${day} ${date} · ${hh}:${mm}`;
}

// Calendario completo R32 del Mundial 2026 (fechas en UTC, equipos conocidos al 25/6).
// Cuando los grupos cierren y la API publique los fixtures reales, groupStageFinished
// se vuelve true y esta vista es reemplazada por el bracket interactivo.
const R32_SCHEDULE: { kickoffMs: number; teamA: string | null; teamB: string | null }[] = [
  { kickoffMs: Date.UTC(2026, 5, 28, 19,  0), teamA: "Sudáfrica",      teamB: "Canadá"               },
  { kickoffMs: Date.UTC(2026, 5, 29, 17,  0), teamA: "Brasil",         teamB: "Japón"                },
  { kickoffMs: Date.UTC(2026, 5, 29, 20, 30), teamA: "Alemania",       teamB: null                   },
  { kickoffMs: Date.UTC(2026, 5, 30,  1,  0), teamA: "Países Bajos",   teamB: "Marruecos"            },
  { kickoffMs: Date.UTC(2026, 5, 30, 17,  0), teamA: "Costa de Marfil", teamB: null                  },
  { kickoffMs: Date.UTC(2026, 5, 30, 21,  0), teamA: null,             teamB: null                   },
  { kickoffMs: Date.UTC(2026, 6,  1,  1,  0), teamA: "México",         teamB: null                   },
  { kickoffMs: Date.UTC(2026, 6,  1, 16,  0), teamA: null,             teamB: null                   },
  { kickoffMs: Date.UTC(2026, 6,  1, 20,  0), teamA: null,             teamB: null                   },
  { kickoffMs: Date.UTC(2026, 6,  2,  0,  0), teamA: "Estados Unidos", teamB: "Bosnia y Herzegovina" },
  { kickoffMs: Date.UTC(2026, 6,  2, 19,  0), teamA: null,             teamB: null                   },
  { kickoffMs: Date.UTC(2026, 6,  2, 23,  0), teamA: null,             teamB: null                   },
  { kickoffMs: Date.UTC(2026, 6,  3,  3,  0), teamA: "Suiza",          teamB: null                   },
  { kickoffMs: Date.UTC(2026, 6,  3, 18,  0), teamA: "Australia",      teamB: null                   },
  { kickoffMs: Date.UTC(2026, 6,  3, 22,  0), teamA: "Argentina",      teamB: null                   },
  { kickoffMs: Date.UTC(2026, 6,  4,  1, 30), teamA: null,             teamB: null                   },
];

function TeamRow({ name }: { name: string | null }) {
  const flagCode = name ? (TEAM_FLAGS[name] ?? null) : null;
  return (
    <div className={`flex items-center gap-2 px-3 py-2.5 ${name ? "font-medium text-gray-900" : "text-gray-400 italic"}`}>
      {name ? (
        <>
          {flagCode
            ? <img src={`https://flagcdn.com/w40/${flagCode}.png`} alt={name} className="w-6 h-4 object-cover rounded-sm flex-shrink-0" />
            : <span className="w-6 h-4 flex-shrink-0" />
          }
          <span>{name}</span>
        </>
      ) : (
        <span>Por definir</span>
      )}
    </div>
  );
}

export function KnockoutBracket({
  seedR32,
  userPicks,
  actualWinners,
  kickoffs,
  groupStageFinished,
  knownGroups = {},
  finishedGroups = [],
  qualifiedTeams = [],
  bannerMessage,
  onPick,
}: {
  seedR32: Record<string, [string, string]>;
  userPicks: Record<string, string>;
  actualWinners: Record<string, string>;
  kickoffs: Record<string, number>;
  groupStageFinished: boolean;
  knownGroups?: Record<string, string[]>;
  finishedGroups?: string[];
  qualifiedTeams?: string[];
  bannerMessage?: string;
  onPick: (slotId: string, team: string) => void;
}) {
  const { t } = useLanguage();
  const [round, setRound] = useState<Round>("R32");
  const [showTree, setShowTree] = useState(false);
  const now = Date.now();

  const view = useMemo(
    () => buildDisplayBracket(seedR32, userPicks, actualWinners),
    [seedR32, userPicks, actualWinners]
  );

  const slotsOfRound = (r: Round): SlotView[] =>
    BRACKET_TREE.filter((s) => s.round === r).map((s) => view[s.id]);

  // Cards de una ronda ordenadas cronológicamente por kickoff (los sin horario van al
  // final). El cuadro completo (árbol) mantiene el orden posicional.
  const slotsByKickoff = (r: Round): SlotView[] =>
    slotsOfRound(r).slice().sort(
      (a, b) => (kickoffs[a.id] ?? Infinity) - (kickoffs[b.id] ?? Infinity));

  // --- Group stage not finished: mostrar calendario R32 completo (read-only) ---
  if (!groupStageFinished) {
    // Merge real API data (seedR32 + kickoffs) over the hardcoded schedule.
    // Match by kickoff time first, then by team name as fallback.
    const apiFixtures = Object.entries(seedR32).map(([slotId, [a, b]]) => ({
      teamA: a, teamB: b, kickoffMs: kickoffs[slotId] ?? null,
    }));

    const merged = R32_SCHEDULE.map(slot => {
      // 1. Match by kickoff (exact ms match from API timestamp)
      const byKickoff = apiFixtures.find(f => f.kickoffMs === slot.kickoffMs);
      if (byKickoff) return { ...slot, teamA: byKickoff.teamA, teamB: byKickoff.teamB };

      // 2. Match by known team name (fills in the opponent when API publishes the fixture)
      const knownTeam = slot.teamA ?? slot.teamB;
      if (knownTeam) {
        const byTeam = apiFixtures.find(f => f.teamA === knownTeam || f.teamB === knownTeam);
        if (byTeam) return { ...slot, teamA: byTeam.teamA, teamB: byTeam.teamB };
      }

      return slot;
    });

    return (
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 text-sm font-medium">
          {bannerMessage || t.knockoutUi.availableBannerDefault}
        </div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {t.knockoutUi.provisionalR32 ?? "Clasificados a 16avos"}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {merged.map(({ kickoffMs, teamA, teamB }, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg overflow-hidden text-sm shadow-sm">
              <div className="px-3 pt-2 pb-1 text-[11px] text-gray-400 font-medium border-b border-gray-50">
                {formatKickoff(kickoffMs)}
              </div>
              <div className="border-b border-gray-100"><TeamRow name={teamA} /></div>
              <TeamRow name={teamB} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- Group stage finished: full interactive bracket ---
  if (showTree) {
    return (
      <div className="space-y-3">
        <button onClick={() => setShowTree(false)} className="text-sm font-semibold" style={{ color: "var(--brand-color, #1e3a8a)" }}>
          ← {t.knockoutUi.backToRounds}
        </button>
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-[760px]">
            {ROUND_ORDER.map((r) => (
              <div key={r} className="flex flex-col justify-around gap-2 flex-1">
                <h4 className="text-xs font-bold text-gray-500 text-center">{t.knockoutUi.rounds[r]}</h4>
                {slotsOfRound(r).map((s) => (
                  <div key={s.id} className="bg-white border border-gray-200 rounded-md text-[11px]">
                    {[s.teamA, s.teamB].map((tm, i) => (
                      <div
                        key={i}
                        className={`px-2 py-1 ${i === 0 ? "border-b border-gray-100" : ""} ${
                          s.resolved && s.pick === tm
                            ? s.status === "correct"
                              ? "text-green-700 font-bold"
                              : "text-red-600 line-through"
                            : ""
                        }`}
                      >
                        {tm ?? t.bracket.tbd}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1 overflow-x-auto">
          {ROUND_ORDER.map((r) => (
            <button
              key={r}
              onClick={() => setRound(r)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${round === r ? "text-white" : "bg-gray-100 text-gray-700"}`}
              style={round === r ? { backgroundColor: "var(--brand-color, #1e3a8a)" } : {}}
            >
              {t.knockoutUi.rounds[r]}
            </button>
          ))}
        </div>
        <button onClick={() => setShowTree(true)} className="text-xs font-semibold whitespace-nowrap" style={{ color: "var(--brand-color, #1e3a8a)" }}>
          {t.knockoutUi.fullBracket}
        </button>
      </div>
      <p className="text-xs text-gray-500">{t.knockoutUi.tapToPick}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {slotsByKickoff(round).map((s) => (
          <KnockoutMatchCard
            key={s.id}
            slot={s}
            locked={isSlotLocked(kickoffs[s.id], now)}
            kickoffLabel={kickoffs[s.id] ? formatKickoff(kickoffs[s.id]) : undefined}
            onPick={onPick}
          />
        ))}
      </div>
    </div>
  );
}
