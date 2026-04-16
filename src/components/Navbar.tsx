"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { User, signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Trophy, LogOut, Settings, PenSquare, BookOpen, Users, Home, Building2 } from "lucide-react";

export default function Navbar({ user, isAdmin, userData, companyName, logoUrl, brandColor }: { user: User; isAdmin: boolean; userData?: any; companyName: string; logoUrl?: string | null; brandColor?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [companyCode, setCompanyCode] = useState<string>("");

  useEffect(() => {
    if (userData?.companyId) {
      getDoc(doc(db, "companies", userData.companyId)).then(snap => {
        if (snap.exists()) {
          setCompanyCode(snap.data().code);
        }
      });
    }
  }, [userData?.companyId]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const getLinkStyle = (path: string) => {
    const isActive = pathname === path;
    return `hidden md:flex items-center justify-center gap-1.5 px-2 lg:px-3 py-1.5 lg:py-2 rounded-md transition-all duration-300 font-semibold text-xs lg:text-sm whitespace-nowrap ${
      isActive 
        ? "bg-white text-gray-900 shadow-sm" 
        : "bg-white/30 text-white hover:bg-white/40"
    }`;
  };

  const getMobileLinkStyle = (path: string) => {
    const isActive = pathname === path;
    return `flex flex-col items-center text-xs p-2 rounded-md transition-colors flex-1 mx-1 font-semibold ${
      isActive 
        ? "bg-white text-gray-900 shadow-sm" 
        : "bg-transparent text-white hover:bg-white/30"
    }`;
  };

  return (
    <nav className="text-white shadow-md sticky top-0 z-50 mb-6" style={{ backgroundColor: brandColor || '#1e3a8a' }}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl md:w-auto lg:w-1/4 shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt={companyName} className="h-14 object-contain bg-white p-1.5 rounded-md shadow-sm" />
            ) : (
              <Trophy className="h-6 w-6 text-white" />
            )}
            <span className="hidden lg:inline">{companyName || 'Prode Mundial'}</span>
          </Link>
          
          <div className="hidden md:flex items-center justify-center gap-1 lg:gap-2 flex-1 overflow-x-auto no-scrollbar">
            <Link href="/" className={getLinkStyle("/")}>
              <Home className="h-3.5 w-3.5 lg:h-4 lg:w-4 shrink-0" /> <span>Inicio</span>
            </Link>
            <Link href="/instructions" className={getLinkStyle("/instructions")}>
              <BookOpen className="h-3.5 w-3.5 lg:h-4 lg:w-4 shrink-0" /> <span>Reglas</span>
            </Link>
            <Link href="/dashboard" className={getLinkStyle("/dashboard")}>
              <Trophy className="h-3.5 w-3.5 lg:h-4 lg:w-4 shrink-0" /> <span>Ranking</span>
            </Link>
            <Link href="/predictions" className={getLinkStyle("/predictions")}>
              <PenSquare className="h-3.5 w-3.5 lg:h-4 lg:w-4 shrink-0" /> <span>Predicciones</span>
            </Link>
            {isAdmin && (
              <Link href="/admin" className={getLinkStyle("/admin")}>
                <Settings className="h-3.5 w-3.5 lg:h-4 lg:w-4 shrink-0" /> <span>Admin</span>
              </Link>
            )}
            {userData?.role === 'company_admin' && (
              <Link href="/company-admin" className={getLinkStyle("/company-admin")}>
                <Building2 className="h-3.5 w-3.5 lg:h-4 lg:w-4 shrink-0" /> <span>Panel {companyName}</span>
              </Link>
            )}
          </div>
            
          <div className="flex items-center justify-end gap-3 md:w-auto lg:w-1/4 shrink-0">
            <div className="flex items-center gap-2">
              {user.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full border border-white/30" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center border border-white/20">
                  {user.displayName?.charAt(0) || "U"}
                </div>
              )}
              <div className="flex flex-col hidden sm:flex">
                <span className="text-sm font-medium leading-tight">{user.displayName}</span>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-white hover:bg-white/20 hover:text-white px-2">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Mobile nav */}
      <div className="md:hidden flex justify-around p-2 bg-black/20 border-t border-white/10">
        <Link href="/" className={getMobileLinkStyle("/")}>
          <Home className="h-5 w-5 mb-1" /> Inicio
        </Link>
        <Link href="/instructions" className={getMobileLinkStyle("/instructions")}>
          <BookOpen className="h-5 w-5 mb-1" /> Reglas
        </Link>
        <Link href="/dashboard" className={getMobileLinkStyle("/dashboard")}>
          <Trophy className="h-5 w-5 mb-1" /> Ranking
        </Link>
        <Link href="/predictions" className={getMobileLinkStyle("/predictions")}>
          <PenSquare className="h-5 w-5 mb-1" /> Predicciones
        </Link>
        {isAdmin && (
          <Link href="/admin" className={getMobileLinkStyle("/admin")}>
            <Settings className="h-5 w-5 mb-1" /> Admin
          </Link>
        )}
        {userData?.role === 'company_admin' && (
          <Link href="/company-admin" className={getMobileLinkStyle("/company-admin")}>
            <Building2 className="h-5 w-5 mb-1" /> Panel
          </Link>
        )}
      </div>
    </nav>
  );
}
