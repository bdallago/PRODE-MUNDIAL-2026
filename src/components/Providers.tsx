"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useRouter, usePathname } from "next/navigation";

const AppContext = createContext<any>(null);

export function Providers({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [companyDetails, setCompanyDetails] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Load cached data immediately to prevent FOUC
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
        localStorage.removeItem('cachedUserData');
        localStorage.removeItem('cachedCompanyDetails');
        if (pathname !== "/login" && pathname !== "/join-company" && pathname !== "/privacy" && pathname !== "/terms") {
          router.push("/login");
        }
        return;
      }

      // We have a user. If no cache exists, show loading screen while fetching.
      if (!localStorage.getItem('cachedUserData') || !localStorage.getItem('cachedCompanyDetails')) {
        setLoading(true);
      } else {
        // If we have cache, we can stop loading immediately and let the fetch happen in the background
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

                // CHECK: Sync role based on designated hrEmails
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
                  // If they were company_admin but are no longer in the list, downgrade back to player
                  try {
                    await setDoc(userRef, { role: 'player' }, { merge: true });
                    const updatedData = { ...data, role: 'player' };
                    setUserData(updatedData);
                    localStorage.setItem('cachedUserData', JSON.stringify(updatedData));
                  } catch (e) {
                    console.error("Error resetting user to player:", e);
                  }
                }
              }
            }

            if (!hasValidCompany && data.role !== 'admin') {
              if (pathname !== "/join-company" && pathname !== "/login" && pathname !== "/privacy" && pathname !== "/terms") {
                router.push("/join-company");
              }
            }
          } else {
            // New user, no document yet
            if (pathname !== "/join-company" && pathname !== "/login" && pathname !== "/privacy" && pathname !== "/terms") {
              router.push("/join-company");
            }
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        } finally {
          setLoading(false);
        }
    });

    return () => unsubscribe();
  }, [pathname, router]);

  useEffect(() => {
    if (companyDetails?.color) {
      document.documentElement.style.setProperty('--brand-color', companyDetails.color);
    } else {
      document.documentElement.style.setProperty('--brand-color', '#1e3a8a');
    }
  }, [companyDetails?.color]);

  const value = { user, userData, companyName, companyDetails, loading };

  return (
    <AppContext.Provider value={value}>
      {loading && pathname !== "/login" && pathname !== "/join-company" && pathname !== "/privacy" && pathname !== "/terms" ? (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1e3a8a] mb-4"></div>
          <p className="text-gray-500 font-medium animate-pulse">Cargando tu espacio...</p>
        </div>
      ) : (
        children
      )}
    </AppContext.Provider>
  );
}

export const useAppContext = () => useContext(AppContext);
