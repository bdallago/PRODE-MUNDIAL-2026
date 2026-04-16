import { useRouter } from "next/navigation";
import { Button } from "../components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function Privacy() {
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
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8">Política de Privacidad</h1>
          <div className="space-y-6 text-gray-600 leading-relaxed">
            <p>
              En <strong>Proder - Prode Mundial 2026</strong>, una de nuestras principales prioridades es la privacidad de nuestros visitantes.
            </p>
            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">Información que recopilamos</h2>
            <p>
              Al utilizar nuestra plataforma e iniciar sesión a través de Google o Microsoft, recopilamos únicamente la información estrictamente necesaria para el funcionamiento de la plataforma:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Nombre y Apellido:</strong> Para mostrarte en las tablas de posiciones de tu empresa.</li>
              <li><strong>Dirección de correo electrónico:</strong> Utilizada como identificador único de tu cuenta para guardar tus predicciones de forma segura y asociarte a tu empresa.</li>
              <li><strong>Foto de perfil (opcional):</strong> Para personalizar tu experiencia en la plataforma.</li>
            </ul>
            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">Uso de la información</h2>
            <p>
              La información recopilada se utiliza exclusivamente para:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Proveer, operar y mantener nuestra plataforma.</li>
              <li>Identificar tus predicciones y calcular tus puntajes.</li>
              <li>Mostrar tu posición en las tablas de clasificación a tus compañeros de empresa.</li>
              <li>Gestionar el acceso a las ligas privadas de cada empresa.</li>
            </ul>
            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">Protección de Datos</h2>
            <p>
              No vendemos, comercializamos ni transferimos a terceros tu información personal. Tus datos están almacenados de forma segura en la infraestructura de Google Cloud (Firebase), la cual cuenta con los más altos estándares de seguridad de la industria.
            </p>
            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">Consentimiento</h2>
            <p>
              Al utilizar nuestro sitio web e iniciar sesión, aceptas nuestra Política de Privacidad y estás de acuerdo con sus términos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
