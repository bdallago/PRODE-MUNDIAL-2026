"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAppContext } from "../../src/components/Providers";

const CompanyJoin = dynamic(() => import("../../src/views/CompanyJoin"), {
  ssr: false,
});

export default function JoinCompanyPage() {
  const router = useRouter();
  const { user, loading } = useAppContext();

  if (loading) return null;
  if (!user) return null;

  return <CompanyJoin user={user} onJoined={() => router.push("/")} />;
}
