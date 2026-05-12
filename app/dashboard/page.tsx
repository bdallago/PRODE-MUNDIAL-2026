"use client";

import dynamic from "next/dynamic";
import { useAppContext } from "../../src/components/Providers";

const Dashboard = dynamic(() => import("../../src/views/Dashboard"), {
  ssr: false,
});

export default function DashboardPage() {
  const { user, userData, companyName, companyDetails, loading } = useAppContext();

  if (loading) return null;
  if (!user) return null;

  return <Dashboard user={user} userData={userData} companyName={companyName} companyDetails={companyDetails} />;
}
