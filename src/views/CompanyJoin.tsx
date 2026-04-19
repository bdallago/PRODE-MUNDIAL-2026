"use client";

import { useState } from "react";
import { User } from "firebase/auth";
import { collection, query, where, getDocs, doc, updateDoc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Button } from "../components/ui/button";
import { Building2, LogIn } from "lucide-react";

export default function CompanyJoin({ user, onJoined }: { user: User, onJoined: () => void }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [companyData, setCompanyData] = useState<any>(null);
  const [companyId, setCompanyId] = useState<string>("");
  const [selectedArea, setSelectedArea] = useState<string>("");

  const handleJoin = async () => {
    if (!code.trim()) {
      setError("Por favor ingresa un código válido.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const q = query(collection(db, "companies"), where("code", "==", code.trim().toUpperCase()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError("No se encontró ninguna empresa con ese código.");
        setLoading(false);
        return;
      }

      const cDoc = querySnapshot.docs[0];
      const cId = cDoc.id;
      const cData = cDoc.data();

      if (cData.isActive === false) {
        setError("Este código pertenece a una empresa que ha sido dada de baja.");
        setLoading(false);
        return;
      }

      setCompanyId(cId);
      setCompanyData(cData);

      // If premium and has areas, go to step 2 to select area
      if (cData.plan === 'premium' && cData.areas && cData.areas.length > 0) {
        setStep(2);
        setLoading(false);
        return;
      }

      // Otherwise, proceed directly
      await finalizeJoin(cId, cData, "");
    } catch (err: any) {
      console.error("Error in handleJoin:", err);
      setError("Error: " + (err.message || "Hubo un error al verificar el código."));
      setLoading(false);
    }
  };

  const finalizeJoin = async (cId: string, cData: any, area: string) => {
    setLoading(true);
    setError("");
    try {
      let newRole = "company_admin"; // TEMPORAL: Forzar rol de RRHH (company_admin) para pruebas

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      const commonData = {
        companyId: cId,
        role: newRole,
        ...(area ? { area } : {})
      };

      if (!userSnap.exists()) {
        const newUserData: any = {
          uid: user.uid,
          displayName: user.displayName || "Usuario",
          email: user.email,
          photoURL: user.photoURL || "",
          totalPoints: 0,
          lastLogin: new Date().toISOString(),
          ...commonData
        };
        await setDoc(userRef, newUserData);
      } else {
        await updateDoc(userRef, commonData);
      }

      onJoined();
    } catch (err: any) {
      console.error("Error in finalizeJoin:", err);
      setError("Error: " + (err.message || "Hubo un error al unirse a la empresa."));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        {step === 1 ? (
          <>
            <div className="flex justify-center mb-6">
              <div className="bg-brand/10 p-4 rounded-full">
                <Building2 className="h-12 w-12 text-brand" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Prode Mundial de fútbol 2026</h1>
            <p className="text-gray-500 mb-8">
              Para participar, necesitas ingresar el código de invitación de tu empresa.
            </p>

            <div className="space-y-4 text-left">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código de la empresa</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Ej: A1B2C3"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-brand uppercase"
                  maxLength={6}
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <div className="pt-2">
                <Button onClick={handleJoin} disabled={loading || code.length < 4} className="w-full h-12 text-lg flex items-center justify-center gap-2 btn-primary">
                  <LogIn className="w-5 h-5" /> {loading ? "Verificando..." : "Ingresar"}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-center mb-6">
              {companyData?.logoUrl ? (
                <img src={companyData.logoUrl} alt={companyData.name} className="h-16 object-contain" />
              ) : (
                <div className="bg-brand/10 p-4 rounded-full">
                  <Building2 className="h-12 w-12 text-brand" />
                </div>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">¡Hola, equipo de {companyData?.name}!</h1>
            <p className="text-gray-500 mb-6">
              Antes de empezar, por favor selecciona a qué área o sucursal perteneces.
            </p>

            <div className="space-y-4 text-left">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tu Área / Sucursal</label>
                <select
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand"
                  value={selectedArea}
                  onChange={(e) => setSelectedArea(e.target.value)}
                >
                  <option value="">Selecciona una opción...</option>
                  {companyData?.areas?.map((area: string) => (
                    <option key={area} value={area}>{area}</option>
                  ))}
                </select>
              </div>

              {error && (
                <div className="text-red-500 text-sm bg-red-50 p-3 rounded-md border border-red-100">
                  {error}
                </div>
              )}

              <Button 
                onClick={() => {
                  if (!selectedArea) {
                    setError("Por favor selecciona un área.");
                    return;
                  }
                  finalizeJoin(companyId, companyData, selectedArea);
                }} 
                disabled={loading || !selectedArea}
                className="w-full py-6 text-lg font-semibold"
                style={{ backgroundColor: companyData?.color || '#1d4ed8' }}
              >
                {loading ? "Guardando..." : "Comenzar a jugar"}
              </Button>
              
              <button 
                onClick={() => setStep(1)}
                className="w-full text-sm text-gray-500 hover:text-gray-700 mt-4"
              >
                Volver atrás
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
