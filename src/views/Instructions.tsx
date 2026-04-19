import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { BookOpen, Trophy, Target, AlertCircle, Save, Lock } from "lucide-react";
import { CountdownBanner } from "../components/CountdownBanner";

export default function Instructions() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 px-4 sm:px-6 py-6 md:py-8">
      <CountdownBanner />
      <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-6 rounded-lg shadow-sm border border-gray-100 text-center md:text-left">
        <div className="p-3 rounded-full shrink-0" style={{ backgroundColor: 'color-mix(in srgb, var(--brand-color, #2563eb) 10%, white)' }}>
          <BookOpen className="w-8 h-8" style={{ color: 'var(--brand-color, #2563eb)' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">¿Cómo funciona el Prode?</h1>
          <p className="text-gray-500 mt-1">Guía rápida para participar y sumar puntos.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: Target, title: "1. Predecí", text: "Completá grupos, eliminatorias y partidos individuales." },
          { icon: Save, title: "2. Guardá", text: "Usá 'Guardar Borrador' para no perder tus avances." },
          { icon: Lock, title: "3. Fijá", text: "Hacé clic en 'Fijar' para confirmar definitivamente." },
        ].map((step, i) => (
          <Card key={i} className="border-none shadow-sm bg-white/50 backdrop-blur-sm">
            <CardContent className="p-4 flex flex-col items-center text-center">
              <step.icon className="w-6 h-6 mb-2 text-brand" />
              <h3 className="font-bold text-gray-800">{step.title}</h3>
              <p className="text-xs text-gray-500 mt-1">{step.text}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-none shadow-lg overflow-hidden">
        <CardHeader className="bg-brand text-white py-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="w-5 h-5" /> Sistema de Puntos
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-gray-100">
            {[
              { label: "Resultado Partido (G/E/P)", pts: "+1", desc: "Acertar quién gana o si hay empate." },
              { label: "Resultado Exacto", pts: "+1", desc: "Adicional por acertar los goles exactos." },
              { label: "Posición en Grupo", pts: "+1", desc: "Por cada equipo en su puesto correcto." },
              { label: "Grupo Perfecto", pts: "+3", desc: "Acertar el orden del 1º al 4º de un grupo." },
              { label: "Fase Eliminatoria", pts: "2 a 15", desc: "Acierto clasificado: 16avos (+2), 8vos (+4), 4tos (+6), Semis (+8) y Campeón (+15)." },
              { label: "Preguntas Especiales", pts: "+10", desc: "Por cada respuesta correcta (Goleador, etc)." },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                <div className="flex-1">
                  <h4 className="font-bold text-gray-800 text-sm">{item.label}</h4>
                  <p className="text-xs text-gray-500">{item.desc}</p>
                </div>
                <span className="font-black text-brand bg-brand/10 px-3 py-1 rounded-full text-sm ml-4">
                  {item.pts}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl flex gap-3 items-start">
        <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
        <div className="text-sm text-yellow-800">
          <p className="font-bold">Importante:</p>
          <p>Podés editar el marcador de los partidos individuales hasta <strong>1 hora antes</strong> del inicio de cada encuentro.</p>
        </div>
      </div>
    </div>
  );
}
