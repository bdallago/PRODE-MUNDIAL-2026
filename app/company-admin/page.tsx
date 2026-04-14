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

  return <CompanyAdmin userData={userData} companyName={companyName} />;
}
