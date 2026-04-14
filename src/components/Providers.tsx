"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
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
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserData(data);
            if (data.companyId) {
              const companyDoc = await getDoc(doc(db, "companies", data.companyId));
              if (companyDoc.exists()) {
                setCompanyName(companyDoc.data().name);
                setCompanyDetails(companyDoc.data());
              }
            }
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        setUserData(null);
        setCompanyName("");
        setCompanyDetails(null);
        if (pathname !== "/login" && pathname !== "/join-company") {
          router.push("/login");
        }
      }
      setLoading(false);
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
