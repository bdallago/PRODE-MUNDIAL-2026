import axios from "axios";
import { GROUPS } from "../data";
import { adminDb } from "./firebaseAdmin";
import { TEAM_NAME_MAP as TEAM_NAME_MAPPING } from "./bracket/teamNames";

const GAMES_PER_GROUP = 12;

export async function syncStandings(apiKey: string): Promise<void> {
  const response = await axios.get("https://v3.football.api-sports.io/standings", {
    params: { league: 1, season: 2026 },
    headers: { "x-apisports-key": apiKey },
  });

  const data = response.data;
  if (!data?.response?.length) return;

  const standings = data.response[0].league.standings;
  const newGroups: Record<string, string[]> = {};
  const newStandings: Record<string, Record<string, { pts: number; played: number; gf: number; ga: number; gd: number; w: number; d: number; l: number }>> = {};
  const finishedGroups: string[] = [];
  const qualifiedTeams: string[] = [];

  standings.forEach((groupStandings: any[]) => {
    if (!groupStandings?.length) return;
    const groupLetter = groupStandings[0].group.replace("Group ", "").trim();
    if (!(groupLetter in GROUPS)) return;

    const totalPlayed = groupStandings.reduce((sum: number, s: any) => sum + (s.all?.played ?? 0), 0);

    if (totalPlayed === 0) return;

    groupStandings.sort((a: any, b: any) => a.rank - b.rank);
    newGroups[groupLetter] = groupStandings.map((s: any) => TEAM_NAME_MAPPING[s.team.name] ?? s.team.name);

    // Track teams confirmed for R32 via API description field
    for (const s of groupStandings) {
      if (s.description === "Round of 32") {
        const name = TEAM_NAME_MAPPING[s.team.name] ?? s.team.name;
        if (!qualifiedTeams.includes(name)) qualifiedTeams.push(name);
      }
    }

    newStandings[groupLetter] = {};
    for (const s of groupStandings) {
      const teamName = TEAM_NAME_MAPPING[s.team.name] ?? s.team.name;
      newStandings[groupLetter][teamName] = {
        pts: s.points ?? 0,
        played: s.all?.played ?? 0,
        gf: s.all?.goals?.for ?? 0,
        ga: s.all?.goals?.against ?? 0,
        gd: s.goalsDiff ?? 0,
        w: s.all?.win ?? 0,
        d: s.all?.draw ?? 0,
        l: s.all?.lose ?? 0,
      };
    }

    if (totalPlayed >= GAMES_PER_GROUP) finishedGroups.push(groupLetter);
  });

  if (Object.keys(newGroups).length > 0) {
    await adminDb.collection("results").doc("actual").set({
      groups: newGroups,
      standings: newStandings,
      finishedGroups,
      qualifiedTeams,
    }, { merge: true });
  }
}
