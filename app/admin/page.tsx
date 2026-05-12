"use client";

import dynamic from "next/dynamic";
import { useAppContext } from "../../src/components/Providers";

const Admin = dynamic(() => import("../../src/views/Admin"), {
  ssr: false,
});

export default function AdminPage() {
  const { userData, loading } = useAppContext();

  if (loading) return null;
  if (userData?.role !== "admin") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-red-600 font-bold text-lg">Acceso denegado.</p>
      </div>
    );
  }

  return <Admin />;
}
