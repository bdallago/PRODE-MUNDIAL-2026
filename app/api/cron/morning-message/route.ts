import { NextRequest, NextResponse } from "next/server";
import {
  getTodayMatches,
  getEarlyNextDayMatches,
  getTodayKoMatches,
  getEarlyNextDayKoMatches,
  formatMorningMessage,
  sendNotification,
  getEnabledCompanies,
  todayART,
} from "../../../../src/lib/notifications";
import { adminDb } from "../../../../src/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Partidos del día: fase de grupos (matches.json) + eliminatorias (results/actual.koSchedule).
  // En fase KO ya no hay partidos de grupo, así que en la práctica salen solo los cruces.
  const [koToday, koTrasnochados] = await Promise.all([
    getTodayKoMatches(),
    getEarlyNextDayKoMatches(),
  ]);
  const allTodayMatches = [...getTodayMatches(), ...koToday];
  // Exclude matches at 00:00–02:00 — those were already shown as "trasnochados" in yesterday's message
  const todayMatches = allTodayMatches.filter((m) => {
    const h = parseInt(m.time.split(":")[0], 10);
    return h > 2;
  });
  const trasnochados = [...getEarlyNextDayMatches(), ...koTrasnochados];
  if (todayMatches.length === 0 && trasnochados.length === 0) {
    return NextResponse.json({ ok: true, skipped: "no_matches" });
  }

  const message = formatMorningMessage(todayMatches, trasnochados);
  const companies = await getEnabledCompanies("morningMessage");

  const today = todayART();
  let sent = 0;
  for (const company of companies) {
    try {
      await sendNotification(company.webhookUrl, company.channel, message);
      await adminDb.collection("companies").doc(company.id).set(
        { notifications: { morningMessageSentDate: today } },
        { merge: true }
      );
      sent++;
    } catch (err: any) {
      console.error(`[morning-message] Failed for company ${company.id}:`, err.message);
    }
  }

  return NextResponse.json({ ok: true, sent, total: companies.length });
}
