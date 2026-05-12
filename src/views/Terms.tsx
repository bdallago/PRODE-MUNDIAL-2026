import { useRouter } from "next/navigation";
import { Button } from "../components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function Terms() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Button 
          variant="ghost" 
          onClick={() => router.back()} 
          className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 bg-white/50 hover:bg-white shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </Button>
        <div className="bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-gray-100">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8">Términos y Condiciones</h1>
          <div className="space-y-6 text-gray-600 leading-relaxed">
            <p>
              ¡Bienvenido a <strong>Proder - Prode Mundial 2026</strong>!
            </p>
            <p>
              Estos términos y condiciones describen las reglas y regulaciones para el uso de la plataforma Proder.
            </p>
            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">1. Aceptación de los Términos</h2>
            <p>
              Al acceder a esta plataforma, asumimos que aceptas estos términos y condiciones. No continúes usando Proder si no estás de acuerdo con todos los términos y condiciones establecidos en esta página.
            </p>
            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">2. Naturaleza de la Plataforma</h2>
            <p>
              Proder es una plataforma B2B de entretenimiento basada en la predicción de resultados deportivos, diseñada para fomentar el compañerismo y el coworking en entornos laborales. Esta plataforma <strong>no es una plataforma de apuestas</strong>. No se maneja dinero real, ni se cobran tarifas de inscripción a los usuarios finales, ni se otorgan premios monetarios a través de la plataforma.
            </p>
            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">3. Cuentas de Usuario</h2>
            <p>
              Para participar, debes iniciar sesión utilizando una cuenta de Google o Microsoft válida y estar asociado a una empresa registrada. Eres responsable de mantener la confidencialidad de tu cuenta y de todas las actividades que ocurran bajo la misma.
            </p>
            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">4. Reglas de Participación</h2>
            <p>
              Las reglas de puntuación, fechas límite para ingresar predicciones y resolución de empates están detalladas en la sección "Reglas" de la plataforma. El administrador se reserva el derecho de modificar estas reglas antes del inicio del torneo si fuera necesario, notificando a los usuarios.
            </p>
            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">5. Modificaciones y Disponibilidad</h2>
            <p>
              Nos reservamos el derecho de modificar o descontinuar, temporal o permanentemente, el servicio con o sin previo aviso. No seremos responsables ante ti ni ante ningún tercero por ninguna modificación, suspensión o interrupción del servicio.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
