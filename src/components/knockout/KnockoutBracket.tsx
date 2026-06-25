"use client";

import { useMemo, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { BRACKET_TREE } from "../../lib/bracket/tree";
import { R32_FIXED_SEEDS } from "../../lib/bracket/seedTable";
import { buildDisplayBracket, SlotView } from "../../lib/bracket/displayBracket";
import { isSlotLocked } from "../../lib/bracket/lock";
import type { Round } from "../../lib/bracket/types";
import { KnockoutMatchCard } from "./KnockoutMatchCard";
import { TEAM_FLAGS } from "../../data";

const ROUND_ORDER: Round[] = ["R32", "R16", "QF", "SF", "F"];

const DAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

// Format a Unix ms timestamp to ART (UTC-3) readable string
function formatKickoff(ms: number): string {
  const d = new Date(ms);
  // Convert to ART = UTC-3
  const art = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  const day = DAYS_ES[art.getUTCDay()];
  const date = `${art.getUTCDate()}/${art.getUTCMonth() + 1}`;
  const hh = String(art.getUTCHours()).padStart(2, "0");
  const mm = String(art.getUTCMinutes()).padStart(2, "0");
  return `${day} ${date} · ${hh}:${mm}`;
}

// Builds a hybrid R32 seed:
// - Real API fixture if available (both teams known)
// - Otherwise: current standings position for the fixed side, null for the opponent
function buildHybridR32(
  seedR32: Record<string, [string, string]>,
  knownGroups: Record<string, string[]>,
  qualifiedSet: Set<string>
): Record<string, { teamA: string | null; teamB: string | null; fromApi: boolean }> {
  const result: Record<string, { teamA: string | null; teamB: string | null; fromApi: boolean }> = {};

  for (const slot of BRACKET_TREE.filter(s => s.round === "R32")) {
    if (seedR32[slot.id]) {
      result[slot.id] = { teamA: seedR32[slot.id][0], teamB: seedR32[slot.id][1], fromApi: true };
    } else {
      const groupSeed = slot.fixedSeed;
      let fixedTeam: string | null = null;
      if (groupSeed) {
        const pos = parseInt(groupSeed[0], 10) - 1;
        const group = groupSeed.slice(1);
        fixedTeam = knownGroups[group]?.[pos] ?? null;
      }
      result[slot.id] = { teamA: fixedTeam, teamB: null, fromApi: false };
    }
  }
  return result;
}

function TeamRow({ name, qualified }: { name: string | null; qualified: boolean }) {
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
          {!qualified && <span className="text-[10px] text-amber-500 font-normal ml-auto">en curso</span>}
        </>
      ) : (
        <span className="text-gray-400 italic">Por definir</span>
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

  // --- Group stage not finished: provisional hybrid bracket (read-only) ---
  if (!groupStageFinished) {
    const qualifiedSet = new Set(qualifiedTeams);
    const hybrid = buildHybridR32(seedR32, knownGroups, qualifiedSet);
    const r32Slots = BRACKET_TREE.filter(s => s.round === "R32");
    const hasAny = Object.keys(knownGroups).length > 0 || Object.keys(seedR32).length > 0;

    // Sort: API fixtures with kickoff first (by date), then provisional by slot id
    const sorted = [...r32Slots].sort((a, b) => {
      const ka = kickoffs[a.id];
      const kb = kickoffs[b.id];
      if (ka && kb) return ka - kb;
      if (ka) return -1;
      if (kb) return 1;
      return a.id.localeCompare(b.id);
    });

    return (
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 text-sm font-medium">
          {bannerMessage || t.knockoutUi.availableBannerDefault}
        </div>
        {hasAny && (
          <>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {t.knockoutUi.provisionalR32 ?? "Clasificados a 16avos"}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {sorted.map((s) => {
                const { teamA, teamB, fromApi } = hybrid[s.id] ?? { teamA: null, teamB: null, fromApi: false };
                const ko = kickoffs[s.id];
                return (
                  <div key={s.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden text-sm shadow-sm">
                    {ko && (
                      <div className="px-3 pt-2 pb-1 text-[11px] text-gray-400 font-medium border-b border-gray-50">
                        {formatKickoff(ko)}
                      </div>
                    )}
                    <div className="border-b border-gray-100">
                      <TeamRow name={teamA} qualified={teamA ? qualifiedSet.has(teamA) : false} />
                    </div>
                    <TeamRow name={fromApi ? teamB : null} qualified={teamB ? qualifiedSet.has(teamB) : false} />
                  </div>
                );
              })}
            </div>
          </>
        )}
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
        {slotsOfRound(round).map((s) => (
          <KnockoutMatchCard key={s.id} slot={s} locked={isSlotLocked(kickoffs[s.id], now)} onPick={onPick} />
        ))}
      </div>
    </div>
  );
}
