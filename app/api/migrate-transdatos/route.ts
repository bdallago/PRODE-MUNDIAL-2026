import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "../../../src/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEW_AREAS = [
  "Directorio + Gerencias",
  "ADMINISTRACIÓN - Clientes",
  "ADMINISTRACIÓN - Finanzas + Contabilidad",
  "ADMINISTRACIÓN - Proveedores",
  "ADMINISTRACIÓN - Recursos Humanos",
  "RED - Construcción y Mantenimiento",
  "RED - Ing. y Evolución de Red",
  "RED - Operación y Monitoreo (NOC)",
  "COMERCIAL - Cotizaciones",
  "COMERCIAL - Venta y Postventa",
  "INVESTIGACIÓN Y DESARROLLO - I+D",
  "PROYECTOS - Obras Móviles",
  "PROYECTOS - Operaciones + HyS",
  "PROYECTOS - Planta Externa",
  "PROYECTOS - Ing. y Proyectos de Innovación + Obras Civiles",
  "PROYECTOS - Servicios Técnicos",
];

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find TRANSDATOS company (case-insensitive search by name)
    const companiesSnap = await adminDb.collection("companies").get();
    const transdatosDoc = companiesSnap.docs.find(
      (d) => d.data().name?.toLowerCase() === "transdatos"
    );

    if (!transdatosDoc) {
      return NextResponse.json({ error: "Empresa TRANSDATOS no encontrada." }, { status: 404 });
    }

    const companyId = transdatosDoc.id;

    // Update company areas
    await adminDb.collection("companies").doc(companyId).set(
      { areas: NEW_AREAS },
      { merge: true }
    );

    // Clear area for all users in TRANSDATOS so they re-select
    const usersSnap = await adminDb
      .collection("users")
      .where("companyId", "==", companyId)
      .get();

    const batch = adminDb.batch();
    usersSnap.docs.forEach((d) => {
      batch.set(adminDb.collection("users").doc(d.id), { area: "" }, { merge: true });
    });
    await batch.commit();

    return NextResponse.json({
      ok: true,
      companyId,
      areasUpdated: NEW_AREAS.length,
      usersReset: usersSnap.docs.length,
    });
  } catch (err: any) {
    console.error("[migrate-transdatos]", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
