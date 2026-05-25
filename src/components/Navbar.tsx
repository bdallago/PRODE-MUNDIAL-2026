"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { User, signOut } from "firebase/auth";
import { auth } from "../firebase";
import { Button } from "./ui/button";
import { Trophy, LogOut, Settings, PenSquare, BookOpen, Home, Building2 } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import { LanguageSelector } from "./LanguageSelector";

export default function Navbar({ user, isAdmin, userData, companyName, logoUrl, brandColor }: { user: User; isAdmin: boolean; userData?: any; companyName: string; logoUrl?: string | null; brandColor?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();

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
    <>
      <nav className="text-white shadow-md sticky top-0 z-50 mb-0 md:mb-6" style={{ backgroundColor: brandColor || '#1e3a8a' }}>
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14 md:h-16">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg md:text-xl md:w-auto lg:w-1/4 shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt={companyName} className="h-10 md:h-14 max-w-[130px] md:max-w-[180px] object-contain rounded-md" />
              ) : (
                <>
                  <Trophy className="h-5 w-5 md:h-6 md:w-6 text-white" />
                  <span className="inline truncate max-w-[120px] sm:max-w-none">{companyName || 'Prode'}</span>
                </>
              )}
            </Link>

            <div className="hidden md:flex items-center justify-center gap-1 lg:gap-2 flex-1 overflow-x-auto no-scrollbar">
              <Link href="/" className={getLinkStyle("/")} id="tutorial-home">
                <Home className="h-3.5 w-3.5 lg:h-4 lg:w-4 shrink-0" /> <span>{t.nav.home}</span>
              </Link>
              <Link href="/instructions" className={getLinkStyle("/instructions")} id="tutorial-reglas">
                <BookOpen className="h-3.5 w-3.5 lg:h-4 lg:w-4 shrink-0" /> <span>{t.nav.rules}</span>
              </Link>
              <Link href="/predictions" className={getLinkStyle("/predictions")} id="tutorial-predicciones">
                <PenSquare className="h-3.5 w-3.5 lg:h-4 lg:w-4 shrink-0" /> <span>{t.nav.predictions}</span>
              </Link>
              <Link href="/dashboard" className={getLinkStyle("/dashboard")} id="tutorial-ranking">
                <Trophy className="h-3.5 w-3.5 lg:h-4 lg:w-4 shrink-0" /> <span>{t.nav.ranking}</span>
              </Link>
              {isAdmin && (
                <Link href="/admin" className={getLinkStyle("/admin")}>
                  <Settings className="h-3.5 w-3.5 lg:h-4 lg:w-4 shrink-0" /> <span>{t.nav.admin}</span>
                </Link>
              )}
              {userData?.role === 'company_admin' && (
                <Link href="/company-admin" className={getLinkStyle("/company-admin")}>
                  <Building2 className="h-3.5 w-3.5 lg:h-4 lg:w-4 shrink-0" /> <span>{t.nav.panel}</span>
                </Link>
              )}
            </div>

            <div className="flex items-center justify-end gap-1 md:gap-2 md:w-auto lg:w-1/4 shrink-0">
              <LanguageSelector light />
              <div className="flex items-center gap-2">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="w-7 h-7 md:w-8 md:h-8 rounded-full border border-white/30" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-black/20 flex items-center justify-center border border-white/20 text-xs">
                    {user.displayName?.charAt(0) || "U"}
                  </div>
                )}
                <span className="hidden sm:inline text-xs md:text-sm font-medium truncate max-w-[80px] md:max-w-none">{user.displayName?.split(' ')[0]}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-white hover:bg-white/20 hover:text-white px-1.5 md:px-2 h-8 w-8 md:h-9 md:w-9">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Modern Bottom Mobile Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-2 py-1 shadow-[0_-4px_12px_rgba(0,0,0,0.1)]" style={{ backgroundColor: brandColor || '#1e3a8a' }}>
        <div className="flex items-center justify-around">
          <Link href="/" className={getMobileLinkStyle("/")}>
            <Home className="h-5 w-5 mb-0.5" /> <span className="text-[10px]">{t.nav.home}</span>
          </Link>
          <Link href="/instructions" className={getMobileLinkStyle("/instructions")}>
            <BookOpen className="h-5 w-5 mb-0.5" /> <span className="text-[10px]">{t.nav.rules}</span>
          </Link>
          <Link href="/predictions" className={getMobileLinkStyle("/predictions")}>
            <PenSquare className="h-5 w-5 mb-0.5" /> <span className="text-[10px]">{t.nav.predict}</span>
          </Link>
          <Link href="/dashboard" className={getMobileLinkStyle("/dashboard")}>
            <Trophy className="h-5 w-5 mb-0.5" /> <span className="text-[10px]">{t.nav.ranking}</span>
          </Link>
          {(isAdmin || userData?.role === 'company_admin') && (
            <Link
              href={isAdmin ? "/admin" : "/company-admin"}
              className={getMobileLinkStyle(isAdmin ? "/admin" : "/company-admin")}
            >
              {isAdmin ? <Settings className="h-5 w-5 mb-0.5" /> : <Building2 className="h-5 w-5 mb-0.5" />}
              <span className="text-[10px]">{t.nav.panel}</span>
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
