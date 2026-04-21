"use client";

import dynamic from "next/dynamic";
import { useAppContext } from "../src/components/Providers";

const Welcome = dynamic(() => import("../src/views/Welcome"), {
  ssr: false,
});

export default function Home() {
  const { user, userData, companyName, companyDetails, loading } = useAppContext();

  if (loading) return null;
  if (!user) return null;

  return <Welcome user={user} userData={userData} companyName={companyName} companyDetails={companyDetails} />;
}
