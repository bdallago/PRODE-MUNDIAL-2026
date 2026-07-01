import { NextRequest, NextResponse } from "next/server";
import { syncStandings } from "../../../../src/lib/sync-standings";
import { recalculatePoints } from "../../../../src/lib/recalculate-points";
import { isApiEnabled } from "../../../../src/lib/apiEnabled";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isApiEnabled()) {
    return NextResponse.json({ ok: true, skipped: "api_paused" });
  }

  const apiKey = process.env.FOOTBALL_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "FOOTBALL_API_KEY not set" }, { status: 500 });
  }

  try {
    await syncStandings(apiKey);
    await recalculatePoints();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[sync-standings]", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
