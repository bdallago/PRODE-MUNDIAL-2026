"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAppContext } from "../../src/components/Providers";

const CompanyJoin = dynamic(() => import("../../src/views/CompanyJoin"), {
  ssr: false,
});

export default function JoinCompanyPage() {
  const router = useRouter();
  const { user, userData, companyDetails, loading, refreshUserData } = useAppContext();

  if (loading) return null;
  if (!user) return null;

  return (
    <CompanyJoin
      user={user}
      preloadedCompanyId={userData?.companyId}
      preloadedCompanyData={companyDetails}
      onJoined={async () => {
        await refreshUserData();
        router.push("/");
      }}
    />
  );
}
