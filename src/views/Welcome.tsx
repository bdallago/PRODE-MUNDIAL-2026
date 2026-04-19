"use client";

import React, { useState } from "react";
import { User } from "firebase/auth";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Home, Trophy, Users, PenSquare, BookOpen, MessageSquareWarning, X, FileText, Image as ImageIcon, Film } from "lucide-react";
import Link from "next/link";
import { Button } from "../components/ui/button";
import { addDoc, collection } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, auth, storage } from "../firebase";
import { WorldCupBanner } from "../components/WorldCupBanner";
import { CountdownBanner } from "../components/CountdownBanner";
import { TutorialModal } from "../components/TutorialModal";

export default function Welcome({ user, companyName, companyDetails }: { user: User | null, companyName: string, companyDetails?: any }) {
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const [reportFiles, setReportFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setReportFiles(prev => [...prev, ...newFiles]);
    }
    // Reset input so the same file can be selected again if needed
    e.target.value = '';
  };

  const removeFile = (indexToRemove: number) => {
    setReportFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const fileUrls: string[] = [];
      
      if (reportFiles.length > 0) {
        for (let i = 0; i < reportFiles.length; i++) {
          const file = reportFiles[i];
          const fileRef = ref(storage, `reports/${Date.now()}_${file.name}`);
          
          // Timeout to prevent hanging
          const uploadPromise = uploadBytes(fileRef, file);
          const timeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error("Firebase Storage bloqueó la subida. Por favor, revisá las reglas de seguridad en tu consola de Firebase.")), 15000)
          );
          
          await Promise.race([uploadPromise, timeoutPromise]);
          const url = await getDownloadURL(fileRef);
          fileUrls.push(url);
        }
      }

      // Guardamos el reporte en Firestore
      await addDoc(collection(db, "reports"), {
        message: reportText,
        userEmail: auth.currentUser?.email || "",
        userName: auth.currentUser?.displayName || "",
        createdAt: new Date().toISOString(),
        attachments: fileUrls
      });
      
      setSubmitSuccess(true);
      setTimeout(() => {
        setIsReportModalOpen(false);
        setSubmitSuccess(false);
        setReportText("");
        setReportFiles([]);
      }, 3000);
    } catch (error: any) {
      console.error("Error al guardar reporte:", error);
      setSubmitError(error.message || "Hubo un error al enviar el reporte. Verificá tu conexión y volvé a intentar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPremium = companyDetails?.plan === 'premium';

  return (
    <div className="max-w-4xl mx-auto space-y-8 px-4 sm:px-6 py-6 md:py-8">
      <TutorialModal onComplete={() => {}} user={user} />
      <WorldCupBanner />
      <CountdownBanner />
      
      {isPremium && companyDetails?.bannerMessage && (
        <div 
          className="p-4 rounded-r-lg shadow-sm border-l-4"
          style={{ backgroundColor: 'color-mix(in srgb, var(--brand-color, #a855f7) 10%, white)', borderColor: 'var(--brand-color, #a855f7)' }}
        >
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5" style={{ color: 'var(--brand-color, #a855f7)' }} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium" style={{ color: 'color-mix(in srgb, var(--brand-color, #a855f7) 80%, black)' }}>Mensaje de RRHH</h3>
              <div className="mt-2 text-sm whitespace-pre-wrap" style={{ color: 'color-mix(in srgb, var(--brand-color, #a855f7) 60%, black)' }}>
                {companyDetails.bannerMessage}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col items-center justify-center gap-4 bg-white p-6 md:p-10 rounded-lg shadow-sm border border-gray-100 text-center">
        <div className="w-full space-y-1 md:space-y-2">
          <h1 className="text-3xl md:text-5xl font-bold text-gray-900">Bienvenido</h1>
          <p className="text-4xl md:text-7xl font-extrabold text-brand tracking-tight">{user?.displayName}</p>
          <p className="text-xl md:text-3xl font-semibold text-gray-700">al Prode Mundial 2026</p>
          <p className="text-2xl md:text-5xl font-bold text-brand/90">{companyName}</p>
          
          <p className="text-gray-500 mt-6 md:mt-8 text-lg md:text-xl text-center max-w-2xl mx-auto">
            Demostrá tus conocimientos futbolísticos, participá con tus compañeros y convertite en el campeón de los pronósticos.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/instructions" className="block" id="tutorial-reglas">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full flex items-center justify-center p-6 border-t-4 border-t-brand">
            <CardTitle className="text-xl flex items-center gap-2 text-gray-900 m-0">
              <BookOpen className="w-6 h-6 text-brand" /> Reglas
            </CardTitle>
          </Card>
        </Link>

        <Link href="/predictions" className="block" id="tutorial-predicciones">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full flex items-center justify-center p-6 border-t-4 border-t-brand">
            <CardTitle className="text-xl flex items-center gap-2 text-gray-900 m-0">
              <PenSquare className="w-6 h-6 text-brand" /> Mis Predicciones
            </CardTitle>
          </Card>
        </Link>

        <Link href="/dashboard" className="block" id="tutorial-ranking">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full flex items-center justify-center p-6 border-t-4 border-t-brand">
            <CardTitle className="text-xl flex items-center gap-2 text-gray-900 m-0">
              <Trophy className="w-6 h-6 text-brand" /> Ranking
            </CardTitle>
          </Card>
        </Link>
      </div>

      <Card id="tutorial-reportes" className="hover:shadow-md transition-shadow border-t-4 border-t-red-500 bg-red-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl flex items-center gap-2 text-red-900">
            <MessageSquareWarning className="w-5 h-5" /> Reportar Errores o Sugerencias
          </CardTitle>
        </CardHeader>
        <CardContent className="text-gray-700">
          <p className="mb-4">
            ¿Encontraste algún problema o tenés alguna idea para mejorar la aplicación? ¡Queremos escucharte! 
            Por favor, sé lo más detallado y preciso posible en tu mensaje. Si tenés imágenes o videos, podés adjuntarlos acá.
          </p>
          <Button onClick={() => setIsReportModalOpen(true)} className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white">
            Enviar Reporte o Sugerencia
          </Button>
        </CardContent>
      </Card>

      {/* Report Modal */}
      {isReportModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-2xl relative">
            <button onClick={() => setIsReportModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Enviar Reporte o Sugerencia</h3>
            <p className="text-gray-600 mb-6 text-sm">
              Por favor, sé lo más detallado y preciso posible. Si tenés capturas de pantalla o videos, podés adjuntarlos acá.
            </p>
            
            {submitSuccess ? (
              <div className="bg-green-50 text-green-800 p-4 rounded-lg border border-green-200 text-center">
                <p className="font-bold">¡Reporte enviado con éxito!</p>
                <p className="text-sm mt-1">Beno lo va a revisar a la brevedad.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitReport} className="space-y-4">
                {submitError && (
                  <div className="bg-red-50 text-red-800 p-3 rounded-lg border border-red-200 text-sm">
                    {submitError}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tu mensaje</label>
                  <textarea 
                    required
                    rows={5}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-brand resize-none"
                    placeholder="Describí el error o tu sugerencia acá..."
                    value={reportText}
                    onChange={(e) => setReportText(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Adjuntar archivos (Opcional)</label>
                  <input 
                    type="file" 
                    multiple 
                    accept="image/*,video/*"
                    onChange={handleFileSelect}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand/10 file:text-brand hover:file:bg-brand/20"
                  />
                  <p className="text-xs text-gray-500 mt-1 mb-3">Formatos permitidos: Cualquier formato de imagen o video.</p>
                  
                  {reportFiles.length > 0 && (
                    <div className="space-y-2 mt-3 max-h-40 overflow-y-auto pr-2">
                      {reportFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded border border-gray-200">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <div className="bg-brand/10 p-1.5 rounded text-brand shrink-0">
                              {file.type.startsWith('image/') ? <ImageIcon className="w-4 h-4" /> : 
                               file.type.startsWith('video/') ? <Film className="w-4 h-4" /> : 
                               <FileText className="w-4 h-4" />}
                            </div>
                            <div className="truncate">
                              <p className="text-sm font-medium text-gray-700 truncate">{file.name}</p>
                              <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                          </div>
                          <button 
                            type="button" 
                            onClick={() => removeFile(index)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors shrink-0"
                            title="Eliminar archivo"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="pt-2">
                  <Button type="submit" disabled={isSubmitting} className="w-full btn-primary py-6 text-lg">
                    {isSubmitting ? 'Enviando...' : 'Enviar a Beno'}
                  </Button>
                </div>
              </form>
            )}
            
            <div className="mt-6 pt-4 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500">
                O si preferís, escribime directamente a:<br/>
                <a href="mailto:benitodallago@gmail.com" className="text-brand font-medium hover:underline">benitodallago@gmail.com</a>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
