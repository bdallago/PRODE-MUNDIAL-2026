import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "../../../src/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_DOMAIN = "transdatos.com.ar";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const companiesSnap = await adminDb.collection("companies").get();
    const transdatosDoc = companiesSnap.docs.find(
      (d) => d.data().name?.toLowerCase() === "transdatos"
    );

    if (!transdatosDoc) {
      return NextResponse.json({ error: "Empresa TRANSDATOS no encontrada." }, { status: 404 });
    }

    const companyId = transdatosDoc.id;

    // Set allowedDomain on the company
    await adminDb.collection("companies").doc(companyId).set(
      { allowedDomain: ALLOWED_DOMAIN },
      { merge: true }
    );

    // Find all users in Transdatos with non-allowed email domains
    const usersSnap = await adminDb
      .collection("users")
      .where("companyId", "==", companyId)
      .get();

    const blockedUsers: string[] = [];
    const batch = adminDb.batch();

    usersSnap.docs.forEach((d) => {
      const email: string = d.data().email?.toLowerCase() || "";
      if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
        // Remove from company — keep the user record but strip company association
        batch.set(
          adminDb.collection("users").doc(d.id),
          { companyId: null, role: "player" },
          { merge: true }
        );
        blockedUsers.push(email);
      }
    });

    await batch.commit();

    return NextResponse.json({
      ok: true,
      companyId,
      allowedDomain: ALLOWED_DOMAIN,
      blockedUsersRemoved: blockedUsers.length,
      blockedEmails: blockedUsers,
    });
  } catch (err: any) {
    console.error("[migrate-transdatos-domain]", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
