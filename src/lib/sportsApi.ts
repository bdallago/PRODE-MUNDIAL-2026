import { MATCHES } from "../data";
import { adminDb } from "./firebaseAdmin";
import { recalculatePoints } from "./recalculate-points";

const API_BASE = process.env.FOOTBALL_API_BASE_URL || "https://v3.football.api-sports.io";
const API_KEY  = process.env.FOOTBALL_API_KEY || "";
const LEAGUE   = process.env.FOOTBALL_WORLD_CUP_LEAGUE_ID || "1";
const SEASON   = process.env.FOOTBALL_WORLD_CUP_SEASON || "2026";

// Maps API-Football English names → Spanish names used in data.ts
const TEAM_MAP: Record<string, string> = {
  "Mexico": "México",
  "South Africa": "Sudáfrica",
  "South Korea": "Corea del Sur",
  "Czech Republic": "República Checa",
  "Czechia": "República Checa",
  "Canada": "Canadá",
  "Bosnia and Herzegovina": "Bosnia y Herzegovina",
  "Bosnia & Herzegovina": "Bosnia y Herzegovina",
  "Bosnia": "Bosnia y Herzegovina",
  "Qatar": "Qatar",
  "Switzerland": "Suiza",
  "Brazil": "Brasil",
  "Morocco": "Marruecos",
  "Haiti": "Haití",
  "Scotland": "Escocia",
  "United States": "Estados Unidos",
  "United States of America": "Estados Unidos",
  "USA": "Estados Unidos",
  "Paraguay": "Paraguay",
  "Australia": "Australia",
  "Turkey": "Turquía",
  "Türkiye": "Turquía",
  "Germany": "Alemania",
  "Curacao": "Curazao",
  "Curaçao": "Curazao",
  "Ivory Coast": "Costa de Marfil",
  "Côte d'Ivoire": "Costa de Marfil",
  "Ecuador": "Ecuador",
  "Netherlands": "Países Bajos",
  "Japan": "Japón",
  "Sweden": "Suecia",
  "Tunisia": "Túnez",
  "Belgium": "Bélgica",
  "Egypt": "Egipto",
  "Iran": "Irán",
  "New Zealand": "Nueva Zelanda",
  "Spain": "España",
  "Cape Verde": "Cabo Verde",
  "Cape Verde Islands": "Cabo Verde",
  "Saudi Arabia": "Arabia Saudita",
  "Uruguay": "Uruguay",
  "France": "Francia",
  "Senegal": "Senegal",
  "Iraq": "Irak",
  "Norway": "Noruega",
  "Argentina": "Argentina",
  "Algeria": "Argelia",
  "Austria": "Austria",
  "Jordan": "Jordania",
  "Portugal": "Portugal",
  "DR Congo": "Rep. Dem. Congo",
  "Congo DR": "Rep. Dem. Congo",
  "Democratic Republic of Congo": "Rep. Dem. Congo",
  "Uzbekistan": "Uzbekistán",
  "Colombia": "Colombia",
  "England": "Inglaterra",
  "Croatia": "Croacia",
  "Ghana": "Ghana",
  "Panama": "Panamá",
};

const MONTH_ES: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
};

// Converts "11 de junio" + "16:00" to a UTC timestamp.
// Match times are stored in ART (UTC-3).
function kickoffUTC(dateStr: string, timeStr: string): number {
  const [day, , monthStr] = dateStr.split(" ");
  const month = MONTH_ES[monthStr.toLowerCase()];
  const [h, m] = timeStr.split(":").map(Number);
  return Date.UTC(2026, month, parseInt(day), h + 3, m);
}

// Returns true if at least one match might be finishing or recently finished.
// Window starts at +80 min (earliest a match can end) and ends at +180 min
// (covers 90 min regulation + extra time + penalties + buffer).
function hasActiveWindow(): boolean {
  const now = Date.now();
  return MATCHES.some((match) => {
    const ko = kickoffUTC(match.date, match.time);
    return now >= ko + 80 * 60_000 && now <= ko + 180 * 60_000;
  });
}

// Resolves API team names to our internal match ID.
// Returns the match id and whether home/away were swapped vs the API order.
function resolveMatchId(
  homeApi: string,
  awayApi: string
): { id: string; swapped: boolean } | null {
  const home = TEAM_MAP[homeApi] ?? homeApi;
  const away = TEAM_MAP[awayApi] ?? awayApi;
  const direct = MATCHES.find((m) => m.home === home && m.away === away);
  if (direct) return { id: direct.id, swapped: false };
  // API sometimes lists teams in the opposite order from data.ts
  const inverted = MATCHES.find((m) => m.home === away && m.away === home);
  if (inverted) return { id: inverted.id, swapped: true };
  return null;
}

// Only record scores when the match is definitively over
const LIVE_OR_DONE = new Set(["FT", "AET", "PEN"]);

export async function syncMatchResults(force = false): Promise<{
  synced: number;
  skipped?: string;
}> {
  // 1. Skip if no match is expected to be active right now
  if (!force && !hasActiveWindow()) {
    return { synced: 0, skipped: "no_active_window" };
  }

  // 2. Throttle: don't hit the API more than once every 90 seconds
  const lastRunRef = adminDb.doc("sync/lastRun");
  const lastRunSnap = await lastRunRef.get();
  if (lastRunSnap.exists) {
    const lastRun = (lastRunSnap.data()?.runAt as number) || 0;
    if (Date.now() - lastRun < 90_000) {
      return { synced: 0, skipped: "throttled" };
    }
  }
  await lastRunRef.set({ runAt: Date.now() });

  // 3. Fetch ALL tournament fixtures from API-Football.
  // We sync every finished match (not just today's) so a result that was
  // missed on its match day — e.g. the sync window was throttled — still gets
  // backfilled on the next run instead of being lost forever.
  const res = await fetch(
    `${API_BASE}/fixtures?league=${LEAGUE}&season=${SEASON}`,
    {
      headers: { "x-apisports-key": API_KEY },
      cache: "no-store",
    }
  );

  if (!res.ok) throw new Error(`API-Football responded ${res.status}`);

  const json = await res.json();
  const fixtures: any[] = json.response ?? [];

  // 4. Build Firestore dot-notation updates for each scored match
  const updates: Record<string, any> = {};

  for (const fixture of fixtures) {
    const status = fixture.fixture?.status?.short as string;
    if (!LIVE_OR_DONE.has(status)) continue;

    const homeGoals = fixture.goals?.home;
    const awayGoals = fixture.goals?.away;
    if (homeGoals == null || awayGoals == null) continue;

    const resolved = resolveMatchId(
      fixture.teams?.home?.name,
      fixture.teams?.away?.name
    );
    if (!resolved) continue;

    const { id: matchId, swapped } = resolved;
    // Dot-notation key → updates only this match, leaves others untouched
    updates[`matches.${matchId}`] = {
      home: String(swapped ? awayGoals : homeGoals),
      away: String(swapped ? homeGoals : awayGoals),
    };
  }

  if (Object.keys(updates).length === 0) return { synced: 0 };

  updates.updatedAt = new Date().toISOString();

  // 5. Write to Firestore (Admin SDK bypasses security rules)
  const resultsRef = adminDb.doc("results/actual");
  try {
    await resultsRef.update(updates);
  } catch (err: any) {
    // Document doesn't exist yet — create a minimal one
    if (err.code === 5) {
      await resultsRef.set({
        groups: {}, specials: {}, knockouts: {}, matches: {},
        updatedAt: new Date().toISOString(),
      });
      await resultsRef.update(updates);
    } else {
      throw err;
    }
  }

  await recalculatePoints();

  return { synced: Object.keys(updates).length - 1 }; // -1 for updatedAt
}
