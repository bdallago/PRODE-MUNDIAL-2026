import { NextRequest, NextResponse } from "next/server";
import {
  getTodayMatches,
  getUpcomingMatchGroups,
  formatPreMatchMessage,
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

  const todayMatches = getTodayMatches();
  if (todayMatches.length === 0) {
    return NextResponse.json({ ok: true, skipped: "no_matches" });
  }

  const matchGroups = getUpcomingMatchGroups(todayMatches);
  if (matchGroups.length === 0) {
    return NextResponse.json({ ok: true, skipped: "no_upcoming" });
  }

  const companies = await getEnabledCompanies("preMatchReminder");
  const today = todayART();
  let sent = 0;

  for (const group of matchGroups) {
    const message = formatPreMatchMessage(group);
    const dedupeKey = group.map((m) => m.id).sort().join("_");

    for (const company of companies) {
      if (company.sentReminders?.[dedupeKey] === today) continue;

      try {
        await sendNotification(company.webhookUrl, company.channel, message);
        sent++;
        await adminDb.collection("companies").doc(company.id).set(
          { notifications: { sentReminders: { [dedupeKey]: today } } },
          { merge: true }
        );
      } catch (err: any) {
        console.error(`[pre-match-reminder] Failed for company ${company.id}:`, err.message);
      }
    }
  }

  return NextResponse.json({ ok: true, sent, groups: matchGroups.length });
}
