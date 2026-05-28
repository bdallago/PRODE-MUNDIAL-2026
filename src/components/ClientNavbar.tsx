"use client";

import Navbar from "./Navbar";
import { usePathname } from "next/navigation";
import { useAppContext } from "./Providers";

export default function ClientNavbar() {
  const { user, userData, companyName, companyDetails, loading, previewCompanyId } = useAppContext();
  const pathname = usePathname();

  if (loading || !user || pathname === "/login" || pathname === "/join-company") {
    return null;
  }

  // In preview mode, behave as a company_admin so the navbar mirrors what the company sees
  const isAdmin = userData?.role === 'admin' && !previewCompanyId;
  const effectiveUserData = previewCompanyId ? { ...userData, role: 'company_admin' } : userData;

  return (
    <Navbar
      user={user}
      isAdmin={isAdmin}
      userData={effectiveUserData}
      companyName={companyName}
      logoUrl={companyDetails?.logoUrl}
      brandColor={companyDetails?.color}
      invertActiveButton={!!companyDetails?.invertActiveButton}
    />
  );
}
