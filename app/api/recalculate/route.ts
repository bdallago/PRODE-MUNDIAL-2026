import { NextRequest, NextResponse } from "next/server";
import { recalculatePoints } from "../../../src/lib/recalculate-points";
import { adminDb, getAdminAuth } from "../../../src/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Recálculo de puntos. Autenticado por CRON_SECRET (cron diario de red de seguridad)
// o por un ID token de admin (lo dispara el botón Guardar del panel superadmin).
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  const isCron = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
  let authorized = Boolean(isCron);

  if (!authorized && authHeader?.startsWith("Bearer ")) {
    const idToken = authHeader.slice(7);
    try {
      const decoded = await getAdminAuth().verifyIdToken(idToken);
      const userDoc = await adminDb.collection("users").doc(decoded.uid).get();
      authorized = userDoc.exists && userDoc.data()?.role === "admin";
    } catch {
      authorized = false;
    }
  }

  if (!authorized) {
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
