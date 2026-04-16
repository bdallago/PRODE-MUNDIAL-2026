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
      
      // If we have cached data, we can stop loading immediately
      if (cachedUserData && cachedCompanyDetails) {
        setLoading(false);
      } else if (!currentUser) {
        setLoading(false);
      }

      if (currentUser) {
        try {
          const userRef = doc(db, "users", currentUser.uid);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            let data = userDoc.data();
            
            // TEMPORARY: Force all players to be company_admin for testing
            if (data.role === 'player') {
              try {
                await setDoc(userRef, { role: 'company_admin' }, { merge: true });
                data.role = 'company_admin';
              } catch (e) {
                console.error("Error upgrading user to company_admin:", e);
              }
            }

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
      } else {
        setUserData(null);
        setCompanyName("");
        setCompanyDetails(null);
        localStorage.removeItem('cachedUserData');
        localStorage.removeItem('cachedCompanyDetails');
        if (pathname !== "/login" && pathname !== "/join-company" && pathname !== "/privacy" && pathname !== "/terms") {
          router.push("/login");
        }
      }
    });

    return () => unsubscribe();
  }, [pathname, router]);

  const value = { user, userData, companyName, companyDetails, loading };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => useContext(AppContext);
