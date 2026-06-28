"use client";

import { TEAM_FLAGS } from "../../data";
import { useLanguage } from "../../i18n/LanguageContext";
import { pointsForSlot } from "../../lib/bracket/tree";
import type { SlotView } from "../../lib/bracket/displayBracket";

function Flag({ team }: { team: string | null }) {
  const code = team ? TEAM_FLAGS[team] : undefined;
  return (
    <div className="shrink-0 w-7 h-5 rounded overflow-hidden flex items-center justify-center border border-gray-200 bg-gray-50">
      {code ? (
        <img src={`https://flagcdn.com/w40/${code}.png`} alt={team ?? ""} className="w-full h-full object-cover" />
      ) : (
        <span className="text-xs">🏳️</span>
      )}
    </div>
  );
}

export function KnockoutMatchCard({
  slot,
  locked,
  onPick,
  kickoffLabel,
}: {
  slot: SlotView;
  locked: boolean;
  onPick: (slotId: string, team: string) => void;
  kickoffLabel?: string;
}) {
  const { t } = useLanguage();
  const teamsKnown = !!slot.teamA && !!slot.teamB;

  const rowClass = (team: string | null) => {
    const base =
      "flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 last:border-b-0 font-semibold text-sm transition-colors";
    const isPick = team && slot.pick === team;
    if (slot.resolved && isPick) {
      return `${base} m-1 rounded-md border-2 ${slot.status === "correct" ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"}`;
    }
    if (isPick) return `${base} bg-blue-50`;
    return base;
  };

  const Row = ({ team }: { team: string | null }) => (
    <button
      type="button"
      disabled={!teamsKnown || locked || !team}
      onClick={() => team && onPick(slot.id, team)}
      className={`${rowClass(team)} w-full text-left disabled:cursor-default ${!locked && teamsKnown ? "hover:bg-gray-50" : ""}`}
    >
      <Flag team={team} />
      <span translate="no" className="truncate text-gray-900">
        {team ?? t.bracket.tbd}
      </span>
      {team && slot.pick === team && !slot.resolved && (
        <span className="ml-auto text-[10px] font-bold text-blue-600">✓</span>
      )}
      {team && slot.resolved && slot.pick === team && (
        <span className={`ml-auto text-[10px] font-bold ${slot.status === "correct" ? "text-green-600" : "text-red-600"}`}>
          {slot.status === "correct" ? `${t.knockoutUi.correct} +${pointsForSlot(slot.id)}` : t.knockoutUi.wrong}
        </span>
      )}
    </button>
  );

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      {kickoffLabel && (
        <div className="text-[11px] text-gray-400 font-medium px-3 pt-2 pb-1 border-b border-gray-50">
          {kickoffLabel}
        </div>
      )}
      <Row team={slot.teamA} />
      <Row team={slot.teamB} />
      {locked && (
        <div className="text-[10px] uppercase tracking-wide text-gray-400 px-3 py-1 bg-gray-50 border-t border-gray-100">
          {t.knockoutUi.lockedSlot}
        </div>
      )}
    </div>
  );
}
