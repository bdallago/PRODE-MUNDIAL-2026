"use client";

import { useState } from "react";
import { signInWithPopup, setPersistence, browserSessionPersistence } from "firebase/auth";
import { auth, googleProvider, microsoftProvider } from "../firebase";
import { useRouter } from "next/navigation";
import { Button } from "../components/ui/button";
import { Trophy } from "lucide-react";

export default function Login() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await setPersistence(auth, browserSessionPersistence);
      await signInWithPopup(auth, googleProvider);
      const search = window.location.search;
      const hash = window.location.hash;
      router.push('/' + search + hash);
    } catch (error) {
      console.error("Error signing in with Google", error);
      setError("Hubo un error al iniciar sesión. Por favor intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoftLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await setPersistence(auth, browserSessionPersistence);
      await signInWithPopup(auth, microsoftProvider);
      const search = window.location.search;
      const hash = window.location.hash;
      router.push('/' + search + hash);
    } catch (error) {
      console.error("Error signing in with Microsoft", error);
      setError("Hubo un error al iniciar sesión con Microsoft. Por favor intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="flex justify-center mb-6">
          <div className="bg-blue-100 p-4 rounded-full">
            <Trophy className="h-12 w-12 text-blue-600" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Prode Mundial 2026</h1>
        <p className="text-gray-500 mb-8">
          Participa haciendo tus predicciones y jugá con tus compañeros para ver quién sabe más de fútbol.
        </p>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <Button onClick={handleLogin} disabled={loading} className="w-full flex items-center justify-center gap-2 h-12 text-lg">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Iniciar sesión con Google
          </Button>

          <Button onClick={handleMicrosoftLogin} disabled={loading} variant="outline" className="w-full flex items-center justify-center gap-2 h-12 text-lg border-gray-300 text-gray-700 hover:bg-gray-50">
            <svg className="w-5 h-5" viewBox="0 0 21 21">
              <path fill="#f25022" d="M0 0h10v10H0z"/>
              <path fill="#7fba00" d="M11 0h10v10H11z"/>
              <path fill="#00a4ef" d="M0 11h10v10H0z"/>
              <path fill="#ffb900" d="M11 11h10v10H11z"/>
            </svg>
            Iniciar sesión con Microsoft
          </Button>
        </div>
      </div>
    </div>
  );
}
