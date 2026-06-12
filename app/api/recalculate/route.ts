import { NextRequest, NextResponse } from "next/server";
import { recalculatePoints } from "../../../src/lib/recalculate-points";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await recalculatePoints();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[recalculate]", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
