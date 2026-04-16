"use client";

import { useState } from "react";
import { signInWithPopup, setPersistence, browserSessionPersistence } from "firebase/auth";
import { auth, googleProvider, microsoftProvider } from "../firebase";
import { useRouter } from "next/navigation";
import { Button } from "../components/ui/button";
import { Trophy, PenSquare, Users, Award } from "lucide-react";
import Link from "next/link";

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
    } catch (error: any) {
      console.error("Error signing in with Google", error);
      if (error.code === 'auth/popup-closed-by-user') {
        setError(null);
      } else {
        setError("Hubo un error al iniciar sesión. Por favor intenta de nuevo.");
      }
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
    } catch (error: any) {
      console.error("Error signing in with Microsoft", error);
      if (error.code === 'auth/popup-closed-by-user') {
        setError(null);
      } else {
        setError("Hubo un error al iniciar sesión con Microsoft. Por favor intenta de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Navbar for landing page */}
      <nav className="bg-[#1e3a8a] text-white shadow-md sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2 font-bold text-xl">
              <Trophy className="h-6 w-6 text-white" />
              <span>Proder - Mundial 2026</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20 bg-gradient-to-b from-blue-50 to-white">
        <div className="bg-blue-100 p-6 rounded-full mb-8 shadow-sm">
          <Trophy className="h-16 w-16 text-blue-600" />
        </div>
        <h1 className="text-6xl md:text-7xl font-extrabold text-gray-900 mb-2 tracking-tight">
          PRODER
        </h1>
        <h2 className="text-3xl md:text-4xl font-bold text-gray-700 mb-6">
          Prode Mundial 2026
        </h2>
        <p className="text-xl md:text-2xl text-gray-600 mb-12 max-w-3xl leading-relaxed text-justify mx-auto">
          Demostrá cuánto sabés de fútbol. Jugá al prode del Mundial 2026, participá con tus compañeros y convertite en el mejor pronosticador de tu empresa.
        </p>

        {error && (
          <div className="mb-8 p-4 bg-red-100 border border-red-200 text-red-700 rounded-lg text-md max-w-md w-full">
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md justify-center">
          <Button onClick={handleLogin} disabled={loading} className="w-full flex items-center justify-center gap-2 h-14 text-lg bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all">
            <svg className="w-6 h-6 bg-white rounded-full p-1" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Ingresar con Google
          </Button>
          <Button onClick={handleMicrosoftLogin} disabled={loading} variant="outline" className="w-full flex items-center justify-center gap-2 h-14 text-lg border-gray-300 text-gray-700 hover:bg-gray-50 shadow-sm transition-all">
            <svg className="w-5 h-5" viewBox="0 0 21 21">
              <path fill="#f25022" d="M0 0h10v10H0z"/>
              <path fill="#7fba00" d="M11 0h10v10H11z"/>
              <path fill="#00a4ef" d="M0 11h10v10H0z"/>
              <path fill="#ffb900" d="M11 11h10v10H11z"/>
            </svg>
            Ingresar con Microsoft
          </Button>
        </div>
      </section>

      {/* How it works Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">¿Cómo funciona?</h2>
          <p className="text-lg text-gray-500 mb-16">Todo lo que necesitás para vivir el Mundial de otra manera en tu empresa.</p>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="bg-blue-50 rounded-2xl p-8 flex flex-col items-center text-center shadow-sm border border-blue-100 transition-transform hover:-translate-y-1">
              <div className="bg-white p-4 rounded-full shadow-sm mb-6 text-blue-600">
                <PenSquare className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">1. Hacé tus predicciones</h3>
              <p className="text-gray-600 text-justify">
                Pronosticá las posiciones de la fase de grupos, los resultados de los partidos y quiénes llegarán a la final.
              </p>
            </div>

            <div className="bg-green-50 rounded-2xl p-8 flex flex-col items-center text-center shadow-sm border border-green-100 transition-transform hover:-translate-y-1">
              <div className="bg-white p-4 rounded-full shadow-sm mb-6 text-green-600">
                <Users className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">2. Participá con tu equipo</h3>
              <p className="text-gray-600 text-justify">
                Unite a la liga de tu compañia y jugá con tus compañeros de trabajo para ver quién sabe más.
              </p>
            </div>

            <div className="bg-purple-50 rounded-2xl p-8 flex flex-col items-center text-center shadow-sm border border-purple-100 transition-transform hover:-translate-y-1">
              <div className="bg-white p-4 rounded-full shadow-sm mb-6 text-purple-600">
                <Award className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">3. Sumá puntos</h3>
              <p className="text-gray-600 text-justify">
                A medida que se den los resultados reales, sumarás puntos. ¡El que más puntos tenga al final del Mundial, gana!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gray-50 border-t border-gray-100">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">¿Estás listo para jugar?</h2>
          <Button onClick={handleLogin} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg rounded-full shadow-lg transition-transform hover:scale-105">
            Empezar a participar ahora →
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white py-8 border-t border-gray-200">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-center gap-4 text-sm text-gray-500">
          <Link href="/privacy" className="hover:text-gray-900 transition-colors">Política de Privacidad</Link>
          <span className="hidden md:inline">•</span>
          <Link href="/terms" className="hover:text-gray-900 transition-colors">Términos y Condiciones</Link>
        </div>
      </footer>
    </div>
  );
}
