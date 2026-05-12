"use client";

import dynamic from "next/dynamic";
import { useAppContext } from "../../src/components/Providers";

const CompanyAdmin = dynamic(() => import("../../src/views/CompanyAdmin"), {
  ssr: false,
});

export default function CompanyAdminPage() {
  const { userData, companyName, loading, user } = useAppContext();

  if (loading) return null;
  if (!user) return null;
  if (userData?.role !== "company_admin" && userData?.role !== "admin") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-red-600 font-bold text-lg">Acceso denegado.</p>
      </div>
    );
  }

  return <CompanyAdmin userData={userData} companyName={companyName} />;
}
