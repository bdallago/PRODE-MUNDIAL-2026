export default function Privacy() {
  return (
    <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-gray-100">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Política de Privacidad</h1>
      <div className="space-y-4 text-gray-600">
        <p>
          En <strong>El Prode de Beno</strong>, accesible a través de elprodedebeno.com.ar, una de nuestras principales prioridades es la privacidad de nuestros visitantes.
        </p>
        <h2 className="text-xl font-semibold text-gray-800 mt-6">Información que recopilamos</h2>
        <p>
          Al utilizar nuestra plataforma e iniciar sesión a través de Google, recopilamos únicamente la información estrictamente necesaria para el funcionamiento del juego:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Nombre y Apellido:</strong> Para mostrarte en las tablas de posiciones de tu empresa.</li>
          <li><strong>Dirección de correo electrónico:</strong> Utilizada como identificador único de tu cuenta para guardar tus predicciones de forma segura.</li>
          <li><strong>Foto de perfil (opcional):</strong> Para personalizar tu experiencia en la plataforma.</li>
        </ul>
        <h2 className="text-xl font-semibold text-gray-800 mt-6">Uso de la información</h2>
        <p>
          La información recopilada se utiliza exclusivamente para:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Proveer, operar y mantener nuestro sitio web.</li>
          <li>Identificar tus predicciones y calcular tus puntajes.</li>
          <li>Mostrar tu posición en las tablas de clasificación a otros usuarios.</li>
        </ul>
        <h2 className="text-xl font-semibold text-gray-800 mt-6">Protección de Datos</h2>
        <p>
          No vendemos, comercializamos ni transferimos a terceros tu información personal. Tus datos están almacenados de forma segura en la infraestructura de Google Cloud (Firebase), la cual cuenta con los más altos estándares de seguridad de la industria.
        </p>
        <h2 className="text-xl font-semibold text-gray-800 mt-6">Consentimiento</h2>
        <p>
          Al utilizar nuestro sitio web e iniciar sesión, aceptas nuestra Política de Privacidad y estás de acuerdo con sus términos.
        </p>
      </div>
    </div>
  );
}
