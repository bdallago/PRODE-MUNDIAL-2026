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
            <div className="hidden sm:block">
              <a href="#rrhh" className="text-sm font-medium hover:text-blue-200 transition-colors bg-white/10 px-3 py-1.5 rounded-full">
                Prode para Empresas
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20 bg-gradient-to-b from-brand/5 to-white">
        <div className="bg-brand/10 p-6 rounded-full mb-8 shadow-sm">
          <Trophy className="h-16 w-16 text-brand" />
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
          <Button onClick={handleLogin} disabled={loading} className="w-full flex items-center justify-center gap-2 h-14 text-lg btn-primary shadow-md transition-all">
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
            <div className="bg-brand/5 rounded-2xl p-8 flex flex-col items-center text-center shadow-sm border border-brand/20 transition-transform hover:-translate-y-1">
              <div className="bg-white p-4 rounded-full shadow-sm mb-6 text-brand">
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

            <div className="bg-brand/5 rounded-2xl p-8 flex flex-col items-center text-center shadow-sm border border-brand/20 transition-transform hover:-translate-y-1">
              <div className="bg-white p-4 rounded-full shadow-sm mb-6 text-brand">
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
      <section className="py-24 bg-brand/5 border-t border-brand/10">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-8">¿Estás listo para jugar?</h2>
          <Link 
            href="#rrhh" 
            className="inline-flex items-center justify-center bg-brand hover:bg-[#1e3a8a] text-white px-10 py-6 text-xl font-bold rounded-full shadow-xl transition-all hover:scale-105 active:scale-95"
          >
            Empezar a participar ahora →
          </Link>
        </div>
      </section>

      {/* B2B / HR Section */}
      <section id="rrhh" className="py-20 bg-white border-t border-gray-100">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto bg-gradient-to-br from-slate-900 to-blue-900 rounded-3xl p-8 md:p-12 shadow-2xl text-white relative overflow-hidden">
            <div className="relative z-10 text-center">
              <div className="inline-block bg-blue-500/20 text-blue-300 px-4 py-1.5 rounded-full text-sm font-bold mb-6 tracking-wide uppercase">
                RRHH & Team Building
              </div>
              <h2 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">
                ¿Querés este Prode para tu empresa?
              </h2>
              <p className="text-lg md:text-xl text-blue-100/80 mb-10 max-w-2xl leading-relaxed mx-auto">
                Potenciá el clima laboral y el compromiso de tu equipo con nuestra plataforma personalizada. Consultanos por planes, integraciones y demos corporativas.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a 
                  href="https://wa.me/5493416289453?text=Hola!%20Me%20interesa%20contratar%20el%20Prode%20para%20mi%20empresa" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white font-bold py-4 px-8 rounded-xl transition-all shadow-lg active:scale-95"
                >
                  <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.246 2.248 3.484 5.232 3.483 8.413-.003 6.557-5.338 11.892-11.893 11.892-1.997-.001-3.951-.5-5.688-1.448l-6.308 1.654zm6.757-4.051c1.535.913 3.041 1.393 4.549 1.395 5.29 0 9.593-4.305 9.595-9.592 0-2.564-1-4.974-2.812-6.786-1.815-1.815-4.226-2.812-6.788-2.813-5.293 0-9.596 4.305-9.598 9.594-.001 1.705.47 3.328 1.354 4.708l-.936 3.422 3.535-.928zm10.231-6.49c-.198-.1-1.171-.578-1.352-.644-.18-.067-.312-.1-.442.1s-.508.644-.622.778-.229.15-.426.05c-.197-.1-.832-.307-1.584-.977-.585-.522-.98-1.168-1.095-1.367-.115-.2-.012-.308.087-.407.089-.089.197-.229.296-.344.1-.115.132-.197.198-.328.066-.131.033-.246-.016-.344-.05-.1-.442-1.066-.606-1.459-.16-.388-.335-.335-.46-.341-.118-.006-.254-.007-.39-.007s-.357.053-.543.253c-.187.21-.713.696-.713 1.7s.73 1.97.831 2.1c.101.13 1.436 2.193 3.479 3.074.485.209.865.335 1.161.428.487.156.931.134 1.282.081.39-.058 1.171-.48 1.334-.943.164-.46.164-.853.114-.943-.049-.092-.18-.152-.377-.251z"/>
                  </svg>
                  Contactar por WhatsApp
                </a>
                <a 
                  href="mailto:bdallago01@gmail.com?subject=Consulta%20Prode%20para%20Empresas&body=Hola!%20Vimos%20la%20plataforma%20de%20Prode%20y%20nos%20interesaría%20saber%20más%20para%20nuestra%20empresa." 
                  className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold py-4 px-8 rounded-xl transition-all border border-white/20 active:scale-95"
                >
                  <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                  </svg>
                  Enviar Email
                </a>
              </div>
            </div>
            
            {/* Abstract Background Decoration */}
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-brand/10 rounded-full blur-3xl"></div>
          </div>
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
