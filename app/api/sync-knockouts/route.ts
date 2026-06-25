import { NextRequest, NextResponse } from "next/server";
import { syncKnockouts } from "../../../src/lib/bracket/syncKnockouts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await syncKnockouts();
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("[sync-knockouts]", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
