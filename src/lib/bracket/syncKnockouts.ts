import { adminDb } from "../firebaseAdmin";
import { placeKnockoutFixtures, seedBracketFromStandings } from "./placeFixtures";
import { toKnockoutFixtures } from "./apiMapping";
import { winnerOf } from "./winner";
import { identifySlotByTeams } from "./identify";
import { propagateWinners } from "./propagate";
import { recalculatePoints } from "../recalculate-points";
import { TEAM_NAME_MAP } from "./teamNames";
import type { SlotId, Standings } from "./types";

const API_BASE = process.env.FOOTBALL_API_BASE_URL || "https://v3.football.api-sports.io";
const API_KEY = process.env.FOOTBALL_API_KEY || "";
const LEAGUE = process.env.FOOTBALL_WORLD_CUP_LEAGUE_ID || "1";
const SEASON = process.env.FOOTBALL_WORLD_CUP_SEASON || "2026";

const LIVE_OR_DONE = new Set(["FT", "AET", "PEN"]);

export async function syncKnockouts(): Promise<{
  seededSlots: number;
  resultsApplied: number;
  skipped?: string;
}> {
  // 1. Leer resultados actuales (funciona con grupos parcialmente cerrados).
  const resultsSnap = await adminDb.doc("results/actual").get();
  const data = resultsSnap.data() || {};

  // 2. Standings ya sincronizados (results/actual.groups: {grupo: [equipos ordenados]}).
  const standings: Standings = data.groups || {};

  // 3. Traer fixtures y filtrar KO.
  const res = await fetch(`${API_BASE}/fixtures?league=${LEAGUE}&season=${SEASON}`, {
    headers: { "x-apisports-key": API_KEY },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API-Football responded ${res.status}`);
  const json = await res.json();
  const apiFixtures: any[] = json.response ?? [];

  const { fixtures: koFixtures, unmapped } = toKnockoutFixtures(apiFixtures, TEAM_NAME_MAP);

  // 4. Sembrar R32: base desde standings con el cuadro oficial (no depende de que
  //    la API publique todos los fixtures KO), refinada por los fixtures de la API.
  const seed = placeKnockoutFixtures(koFixtures, standings);
  let matchups: Record<SlotId, [string, string]> = {
    ...seedBracketFromStandings(standings),
    ...seed.placements,
  };

  // 5. Recolectar ganadores de fixtures KO finalizados, identificando el slot
  //    por identidad de equipos contra los matchups conocidos (en cascada).
  const winners: Record<SlotId, string> = { ...(data.knockouts || {}) };
  const kickoffs: Record<SlotId, number> = { ...(data.bracketKickoffs || {}) };

  for (let pass = 0; pass < 5; pass++) {
    matchups = propagateWinners(matchups, winners);
    for (const fx of apiFixtures) {
      const status = fx.fixture?.status?.short as string;
      const homeRaw = fx.teams?.home?.name ?? "";
      const awayRaw = fx.teams?.away?.name ?? "";
      const home = TEAM_NAME_MAP[homeRaw] ?? homeRaw;
      const away = TEAM_NAME_MAP[awayRaw] ?? awayRaw;
      const slotId = identifySlotByTeams(matchups, home, away);
      if (!slotId) continue;
      const ts = fx.fixture?.timestamp;
      if (typeof ts === "number") kickoffs[slotId] = ts * 1000;
      if (!LIVE_OR_DONE.has(status)) continue;
      const w = winnerOf({
        teams: {
          home: { name: home, winner: fx.teams?.home?.winner },
          away: { name: away, winner: fx.teams?.away?.winner },
        },
        goals: fx.goals,
      });
      if (w) winners[slotId] = w;
    }
  }
  matchups = propagateWinners(matchups, winners);

  // 6. Escribir resultados + meta + doc de salud.
  await adminDb.doc("results/actual").set(
    {
      knockouts: winners,
      bracketMatchups: matchups,
      bracketKickoffs: kickoffs,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
  await adminDb.doc("results/knockoutSync").set({
    ranAt: new Date().toISOString(),
    seededSlots: Object.keys(seed.placements).length,
    resultsApplied: Object.keys(winners).length,
    unmappedTeamNames: Array.from(new Set(unmapped)),
    seedWarnings: seed.warnings,
  });

  // 7. Recalcular puntos.
  await recalculatePoints();

  return {
    seededSlots: Object.keys(seed.placements).length,
    resultsApplied: Object.keys(winners).length,
  };
}
