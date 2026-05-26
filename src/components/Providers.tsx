"use client";

import { createContext, useContext, useState, useEffect, useRef } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useRouter, usePathname } from "next/navigation";
import { useLanguage } from "../i18n/LanguageContext";

const DEFAULT_DEADLINE = new Date('2026-06-11T00:00:00').getTime();

const PUBLIC_PATHS = ["/login", "/join-company", "/privacy", "/terms"];

export const AppContext = createContext<any>(null);

export function Providers({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [companyDetails, setCompanyDetails] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [deadline, setDeadline] = useState(DEFAULT_DEADLINE);

  // Preview mode — lets the superadmin navigate the full app as any company
  const [previewCompanyId, setPreviewCompanyId] = useState<string | null>(null);
  const [previewCompanyDetails, setPreviewCompanyDetails] = useState<any | null>(null);

  const router = useRouter();
  const pathname = usePathname();

  const pathnameRef = useRef(pathname);
  useEffect(() => { pathnameRef.current = pathname; });

  // Load preview company details whenever previewCompanyId changes
  useEffect(() => {
    if (!previewCompanyId) {
      setPreviewCompanyDetails(null);
      return;
    }
    getDoc(doc(db, "companies", previewCompanyId)).then((snap) => {
      if (snap.exists()) setPreviewCompanyDetails({ id: snap.id, ...snap.data() });
    });
  }, [previewCompanyId]);

  const refreshUserData = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    try {
      const userRef = doc(db, "users", currentUser.uid);
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) return;

      let data = userDoc.data();
      setUserData(data);
      localStorage.setItem('cachedUserData', JSON.stringify(data));

      if (data.companyId) {
        const companyDoc = await getDoc(doc(db, "companies", data.companyId));
        if (companyDoc.exists() && companyDoc.data().isActive !== false) {
          const compData = companyDoc.data();
          setCompanyName(compData.name);
          setCompanyDetails(compData);
          localStorage.setItem('cachedCompanyDetails', JSON.stringify(compData));

          const hrEmails = compData.hrEmails || (compData.hrEmail ? [compData.hrEmail] : []);
          const userEmail = currentUser.email?.toLowerCase();
          const isDesignatedHR = userEmail && hrEmails.includes(userEmail);

          if (data.role === 'player' && isDesignatedHR) {
            await setDoc(userRef, { role: 'company_admin' }, { merge: true });
            const updatedData = { ...data, role: 'company_admin' };
            setUserData(updatedData);
            localStorage.setItem('cachedUserData', JSON.stringify(updatedData));
          }
        }
      }
    } catch (error) {
      console.error("Error refreshing user data:", error);
    }
  };

  // Auth listener — set up once, never re-created on navigation.
  useEffect(() => {
    const cachedUserData = localStorage.getItem('cachedUserData');
    const cachedCompanyDetails = localStorage.getItem('cachedCompanyDetails');

    if (cachedUserData) {
      try { setUserData(JSON.parse(cachedUserData)); } catch (e) {}
    }
    if (cachedCompanyDetails) {
      try {
        const parsed = JSON.parse(cachedCompanyDetails);
        setCompanyDetails(parsed);
        if (parsed.name) setCompanyName(parsed.name);
      } catch (e) {}
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        setLoading(false);
        setUserData(null);
        setCompanyName("");
        setCompanyDetails(null);
        setPreviewCompanyId(null);
        setPreviewCompanyDetails(null);
        localStorage.removeItem('cachedUserData');
        localStorage.removeItem('cachedCompanyDetails');
        if (!PUBLIC_PATHS.includes(pathnameRef.current)) {
          router.push("/login");
        }
        return;
      }

      if (!localStorage.getItem('cachedUserData') || !localStorage.getItem('cachedCompanyDetails')) {
        setLoading(true);
      } else {
        setLoading(false);
      }

      try {
        const userRef = doc(db, "users", currentUser.uid);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
          let data = userDoc.data();

          setUserData(data);
          localStorage.setItem('cachedUserData', JSON.stringify(data));

          let hasValidCompany = false;

          if (data.companyId) {
            const companyDoc = await getDoc(doc(db, "companies", data.companyId));
            if (companyDoc.exists() && companyDoc.data().isActive !== false) {
              const compData = companyDoc.data();
              setCompanyName(compData.name);
              setCompanyDetails(compData);
              localStorage.setItem('cachedCompanyDetails', JSON.stringify(compData));
              hasValidCompany = true;

              // If company has areas and user hasn't selected one, redirect to area selection
              if (
                compData.plan === 'premium' &&
                compData.areas?.length > 0 &&
                !data.area &&
                data.role !== 'admin'
              ) {
                if (pathnameRef.current !== '/join-company') {
                  router.push("/join-company");
                }
                setLoading(false);
                return;
              }

              const hrEmails = compData.hrEmails || (compData.hrEmail ? [compData.hrEmail] : []);
              const userEmail = currentUser.email?.toLowerCase();
              const isDesignatedHR = userEmail && hrEmails.includes(userEmail);

              if (data.role === 'player' && isDesignatedHR) {
                try {
                  await setDoc(userRef, { role: 'company_admin' }, { merge: true });
                  const updatedData = { ...data, role: 'company_admin' };
                  setUserData(updatedData);
                  localStorage.setItem('cachedUserData', JSON.stringify(updatedData));
                } catch (e) {
                  console.error("Error upgrading user to company_admin:", e);
                }
              } else if (data.role === 'company_admin' && !isDesignatedHR) {
                try {
                  await setDoc(userRef, { role: 'player' }, { merge: true });
                  const updatedData = { ...data, role: 'player' };
                  setUserData(updatedData);
                  localStorage.setItem('cachedUserData', JSON.stringify(updatedData));
                } catch (e) {
                  console.error("Error resetting user to player:", e);
                }
              }
            } else {
              // Company was deleted or deactivated — clear stale cached company data
              setCompanyDetails(null);
              setCompanyName("");
              localStorage.removeItem('cachedCompanyDetails');
            }
          }

          if (!hasValidCompany && data.role !== 'admin') {
            // Always clear stale company details so the nav guard can redirect correctly
            setCompanyDetails(null);
            setCompanyName("");
            localStorage.removeItem('cachedCompanyDetails');
            if (!PUBLIC_PATHS.includes(pathnameRef.current)) {
              router.push("/join-company");
            }
          }
        } else {
          if (!PUBLIC_PATHS.includes(pathnameRef.current)) {
            router.push("/join-company");
          }
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        // On any Firestore error, clear company data so stale cache can't grant access
        setCompanyDetails(null);
        setCompanyName("");
        localStorage.removeItem('cachedCompanyDetails');
        if (!PUBLIC_PATHS.includes(pathnameRef.current)) {
          router.push("/join-company");
        }
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigation guard — re-checks auth/company on every route change
  useEffect(() => {
    if (loading) return;
    if (PUBLIC_PATHS.includes(pathname)) return;

    // auth.currentUser is updated synchronously by Firebase before React re-renders,
    // so we use it as a fallback to avoid redirecting during the signInWithRedirect flow.
    if (!user && !auth.currentUser) {
      router.push("/login");
      return;
    }

    if (userData && (!companyDetails || !userData.companyId) && userData.role !== 'admin') {
      router.push("/join-company");
      return;
    }

    if (
      userData &&
      companyDetails &&
      userData.companyId &&
      !userData.area &&
      companyDetails.plan === 'premium' &&
      companyDetails.areas?.length > 0 &&
      userData.role !== 'admin'
    ) {
      router.push("/join-company");
    }
  }, [pathname, loading, user, userData, companyDetails, router]);

  // Centralized deadline listener — only starts when authenticated
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "config", "tournament"), (snap) => {
      if (snap.exists() && snap.data().deadline) {
        setDeadline(snap.data().deadline);
      }
    });
    return () => unsub();
  }, [user]);

  // Brand color — uses preview company color when active
  const activeCompanyDetails = previewCompanyDetails ?? companyDetails;
  useEffect(() => {
    if (activeCompanyDetails?.color) {
      document.documentElement.style.setProperty('--brand-color', activeCompanyDetails.color);
    } else {
      document.documentElement.style.setProperty('--brand-color', '#1e3a8a');
    }
  }, [activeCompanyDetails?.color]);

  // When preview is active, override companyId + company data for all child pages
  const effectiveUserData = previewCompanyId && userData
    ? { ...userData, companyId: previewCompanyId }
    : userData;
  const effectiveCompanyName = previewCompanyDetails?.name ?? companyName;
  const effectiveCompanyDetails = previewCompanyDetails ?? companyDetails;

  const value = {
    user,
    userData: effectiveUserData,
    companyName: effectiveCompanyName,
    companyDetails: effectiveCompanyDetails,
    loading,
    deadline,
    previewCompanyId,
    setPreviewCompanyId,
    refreshUserData,
  };

  const exitPreview = () => {
    setPreviewCompanyId(null);
    setPreviewCompanyDetails(null);
    router.push("/admin");
  };

  return (
    <AppContext.Provider value={value}>
      {/* Superadmin preview banner — invisible to regular users */}
      {previewCompanyId && previewCompanyDetails && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-400 text-amber-950 px-4 py-2 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2 min-w-0">
            {previewCompanyDetails.logoUrl && (
              <img src={previewCompanyDetails.logoUrl} alt="" className="h-5 w-5 object-contain flex-shrink-0" />
            )}
            <span className="font-bold text-sm truncate">
              {t.providers.previewLabel} <span className="underline">{previewCompanyDetails.name}</span>
            </span>
          </div>
          <button
            onClick={exitPreview}
            className="flex-shrink-0 ml-4 bg-amber-900 text-white px-3 py-1 rounded-full text-xs font-bold hover:bg-amber-950 transition-colors"
          >
            {t.providers.exitPreview}
          </button>
        </div>
      )}

      {loading && !PUBLIC_PATHS.includes(pathname) ? (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1e3a8a] mb-4"></div>
          <p className="text-gray-500 font-medium animate-pulse">{t.providers.loading}</p>
        </div>
      ) : (
        <div className={previewCompanyId && previewCompanyDetails ? "pt-10" : ""}>
          {children}
        </div>
      )}
    </AppContext.Provider>
  );
}

export const useAppContext = () => useContext(AppContext);
