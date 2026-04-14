"use client";

import Navbar from "./Navbar";
import { usePathname } from "next/navigation";
import { useAppContext } from "./Providers";

export default function ClientNavbar() {
  const { user, userData, companyName, companyDetails, loading } = useAppContext();
  const pathname = usePathname();

  if (loading || !user || pathname === "/login" || pathname === "/join-company") {
    return null;
  }

  const isAdmin = userData?.role === 'admin';

  return (
    <Navbar 
      user={user} 
      isAdmin={isAdmin} 
      userData={userData} 
      companyName={companyName} 
      logoUrl={companyDetails?.logoUrl} 
      brandColor={companyDetails?.color} 
    />
  );
}
