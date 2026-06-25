"use client";

import { useMemo, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { BRACKET_TREE } from "../../lib/bracket/tree";
import { R32_FIXED_SEEDS } from "../../lib/bracket/seedTable";
import { buildDisplayBracket, SlotView } from "../../lib/bracket/displayBracket";
import { isSlotLocked } from "../../lib/bracket/lock";
import type { Round } from "../../lib/bracket/types";
import { KnockoutMatchCard } from "./KnockoutMatchCard";

const ROUND_ORDER: Round[] = ["R32", "R16", "QF", "SF", "F"];

// Builds a hybrid R32 seed: real API data where available, provisional standings otherwise.
// Returns null for each side that is genuinely unknown.
function buildHybridR32(
  seedR32: Record<string, [string, string]>,
  knownGroups: Record<string, string[]>,
  finishedGroups: string[]
): Record<string, [string | null, string | null]> {
  const finished = new Set(finishedGroups);
  const result: Record<string, [string | null, string | null]> = {};

  for (const slot of BRACKET_TREE.filter(s => s.round === "R32")) {
    if (seedR32[slot.id]) {
      // Real API fixture: use as-is
      result[slot.id] = [seedR32[slot.id][0], seedR32[slot.id][1]];
    } else {
      // No API fixture yet: derive fixed seed from standings if group is done
      const groupSeed = slot.fixedSeed;
      let fixedTeam: string | null = null;
      if (groupSeed) {
        const pos = parseInt(groupSeed[0], 10) - 1;
        const group = groupSeed.slice(1);
        if (finished.has(group)) {
          fixedTeam = knownGroups[group]?.[pos] ?? null;
        }
      }
      result[slot.id] = [fixedTeam, null];
    }
  }
  return result;
}

export function KnockoutBracket({
  seedR32,
  userPicks,
  actualWinners,
  kickoffs,
  groupStageFinished,
  knownGroups = {},
  finishedGroups = [],
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

  // --- Group stage not finished: show provisional hybrid bracket (read-only) ---
  if (!groupStageFinished) {
    const hybrid = buildHybridR32(seedR32, knownGroups, finishedGroups);
    const r32Slots = BRACKET_TREE.filter(s => s.round === "R32");
    const hasAny = finishedGroups.length > 0 || Object.keys(seedR32).length > 0;

    return (
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 text-sm font-medium">
          {bannerMessage || t.knockoutUi.availableBannerDefault}
        </div>
        {hasAny && (
          <>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {t.knockoutUi.provisionalR32 ?? "Clasificados confirmados a 16avos"}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {r32Slots.map((s) => {
                const [teamA, teamB] = hybrid[s.id] ?? [null, null];
                const isFull = teamA !== null && teamB !== null;
                return (
                  <div
                    key={s.id}
                    className={`bg-white border rounded-lg overflow-hidden text-sm shadow-sm ${isFull ? "border-green-300" : "border-gray-200"}`}
                  >
                    <div className={`px-3 py-2.5 border-b border-gray-100 ${teamA ? "font-medium text-gray-900" : "text-gray-400 italic"}`}>
                      {teamA ?? t.bracket.tbd}
                    </div>
                    <div className={`px-3 py-2.5 ${teamB ? "font-medium text-gray-900" : "text-gray-400 italic"}`}>
                      {teamB ?? t.bracket.tbd}
                    </div>
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
