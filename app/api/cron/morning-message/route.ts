import { NextRequest, NextResponse } from "next/server";
import {
  getTodayMatches,
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

  const todayMatches = getTodayMatches();
  if (todayMatches.length === 0) {
    return NextResponse.json({ ok: true, skipped: "no_matches" });
  }

  const message = formatMorningMessage(todayMatches);
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
