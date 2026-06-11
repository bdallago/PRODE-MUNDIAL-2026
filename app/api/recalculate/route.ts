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
    const dbId = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID;
    console.log("[recalculate] DATABASE_ID =", JSON.stringify(dbId));
    await recalculatePoints();
    return NextResponse.json({ ok: true, dbId });
  } catch (err: any) {
    console.error("[recalculate]", err);
    return NextResponse.json({ ok: false, error: err.message, dbId: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID }, { status: 500 });
  }
}
