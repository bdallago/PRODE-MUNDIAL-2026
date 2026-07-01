import { adminDb } from "./firebaseAdmin";
import { GROUPS } from "../data";
import { scoreBracket } from "./bracket/score";
import { isSpecialCorrect } from "./specials";

export async function recalculatePoints(): Promise<void> {
  const resultsDoc = await adminDb.collection("results").doc("actual").get();
  if (!resultsDoc.exists) return;

  const actualData = resultsDoc.data()!;
  const finishedGroups: string[] = actualData.finishedGroups || [];

  // Only score groups explicitly marked as finished (all 12 matches played).
  const rawGroups: Record<string, string[]> = actualData.groups ?? {};
  const actualG: Record<string, string[]> = {};
  for (const letter of finishedGroups) {
    if (rawGroups[letter]) actualG[letter] = rawGroups[letter];
  }

  const actualS: Record<string, string> = actualData.specials || {};
  const actualK: Record<string, string> = actualData.knockouts || {};
  const actualM: Record<string, any> = actualData.matches || {};

  const predictionsSnap = await adminDb.collection("predictions").get();
  const usersSnap = await adminDb.collection("users").get();

  const existingUserPoints = new Map<string, number>();
  usersSnap.docs.forEach(d => {
    const u = d.data();
    existingUserPoints.set(d.id, typeof u.totalPoints === "number" ? u.totalPoints : -1);
  });

  const predictions = predictionsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

  const chunks: any[][] = [];
  for (let i = 0; i < predictions.length; i += 450) {
    chunks.push(predictions.slice(i, i + 450));
  }

  for (const chunk of chunks) {
    const batch = adminDb.batch();
    let hasWrites = false;

    for (const pred of chunk) {
      if (!existingUserPoints.has(pred.id)) continue;

      let totalPoints = 0;

      // Groups — sanitize prediction side only; actual already guards via finishedGroups
      const pGroupsRaw = pred.groups || {};
      const sanitizedPGroups: Record<string, string[]> = {};
      for (const [letter, validTeams] of Object.entries(GROUPS)) {
        const saved = (pGroupsRaw[letter] || []) as string[];
        const valid = saved.filter(t => (validTeams as string[]).includes(t));
        const missing = (validTeams as string[]).filter(t => !valid.includes(t));
        sanitizedPGroups[letter] = [...valid, ...missing];
      }

      for (const [letter, rawActualTeams] of Object.entries(actualG)) {
        const predictedTeams = sanitizedPGroups[letter];
        if (!predictedTeams) continue;
        // Defensa adicional: deduplicar equipos del lado real por si llegaran
        // standings con filas repetidas (la API duplicaba equipos y corría las
        // posiciones). El fix primario está en sync-standings, esto es red de seguridad.
        const actualTeams = rawActualTeams.filter((t, i) => rawActualTeams.indexOf(t) === i);
        let exact = 0;
        for (let i = 0; i < 4; i++) {
          if (actualTeams[i] && predictedTeams[i] === actualTeams[i]) { exact++; totalPoints++; }
        }
        if (exact === 4) totalPoints += 3;
      }

      // Specials — la respuesta oficial puede traer varias opciones separadas por coma.
      for (const [qId, actualAnswer] of Object.entries(actualS)) {
        if (isSpecialCorrect((pred.specials || {})[qId], actualAnswer)) totalPoints += 10;
      }

      // Knockouts — nuevo formato { slotId: equipo }, puntúa por ronda
      totalPoints += scoreBracket(pred.knockouts || {}, actualK as Record<string, string>);

      // Matches
      const pMatches = pred.matches || {};
      for (const [matchId, actualMatch] of Object.entries(actualM) as [string, any][]) {
        const pm = pMatches[matchId];
        if (!pm || !actualMatch) continue;
        const homeActual = parseInt(actualMatch.home);
        const awayActual = parseInt(actualMatch.away);
        const homePred = parseInt(pm.home);
        const awayPred = parseInt(pm.away);
        if (isNaN(homeActual) || isNaN(awayActual) || isNaN(homePred) || isNaN(awayPred)) continue;
        if (homeActual === homePred && awayActual === awayPred) {
          totalPoints += 2;
        } else {
          const actualOutcome = homeActual > awayActual ? "home" : homeActual < awayActual ? "away" : "draw";
          const predOutcome = homePred > awayPred ? "home" : homePred < awayPred ? "away" : "draw";
          if (actualOutcome === predOutcome) totalPoints += 1;
        }
      }

      if (existingUserPoints.get(pred.id) === totalPoints) continue;

      batch.set(adminDb.collection("users").doc(pred.id), { totalPoints }, { merge: true });
      hasWrites = true;
    }

    if (hasWrites) await batch.commit();
  }

  // Update area stats per company
  const updatedUsersSnap = await adminDb.collection("users").get();
  const companyStats: Record<string, Record<string, { totalPoints: number; count: number }>> = {};
  updatedUsersSnap.docs.forEach(d => {
    const u = d.data();
    if (u.companyId && u.area) {
      if (!companyStats[u.companyId]) companyStats[u.companyId] = {};
      if (!companyStats[u.companyId][u.area]) companyStats[u.companyId][u.area] = { totalPoints: 0, count: 0 };
      companyStats[u.companyId][u.area].totalPoints += u.totalPoints || 0;
      companyStats[u.companyId][u.area].count += 1;
    }
  });

  for (const [cid, areas] of Object.entries(companyStats)) {
    const areaStats = Object.entries(areas)
      .map(([name, stat]) => ({ name, average: Math.round(stat.totalPoints / stat.count), count: stat.count }))
      .sort((a, b) => b.average - a.average);
    await adminDb.collection("companies").doc(cid).set(
      { areaStats, statsUpdatedAt: new Date().toISOString() },
      { merge: true }
    );
  }
}
