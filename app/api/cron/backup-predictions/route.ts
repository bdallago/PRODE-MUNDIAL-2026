import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "../../../../src/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = new Date().toISOString().split("T")[0];
  const snapshot = await adminDb.collection("predictions").get();

  const data: Record<string, any> = {};
  snapshot.forEach((doc) => {
    data[doc.id] = doc.data();
  });

  await adminDb.collection("backups").doc(date).set({
    predictions: data,
    count: snapshot.size,
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true, date, count: snapshot.size });
}
