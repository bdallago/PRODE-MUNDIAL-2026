"use client";
import { useState, useEffect } from "react";
import { collection, query, where, getDocs, doc, deleteDoc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Users, Trash2, Building2, Calculator, Copy, CheckCircle2, Trophy, AlertCircle, Download, MessageSquare, Lock, Bell } from "lucide-react";
import { CountdownBanner } from "../components/CountdownBanner";
// import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';

interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  role: string;
  totalPoints: number;
  isBlocked?: boolean;
  hasPredictions?: boolean;
  predictionStatus?: 'none' | 'incomplete' | 'complete';
}

export default function CompanyAdmin({ userData, hideBanner = false, companyName }: { userData: any, hideBanner?: boolean, companyName?: string }) {
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<any>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    predictionsMade: 0
  });
  const [userToDelete, setUserToDelete] = useState<{uid: string, name: string} | null>(null);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [bannerMessage, setBannerMessage] = useState("");
  const [savingBanner, setSavingBanner] = useState(false);
  const [bannerSuccess, setBannerSuccess] = useState(false);
  
  const [prizes, setPrizes] = useState({ first: '', second: '', third: '' });
  const [savingPrizes, setSavingPrizes] = useState(false);
  const [prizeSuccess, setPrizeSuccess] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!userData?.companyId) return;

      try {
        // Fetch company details
        const companySnap = await getDoc(doc(db, "companies", userData.companyId));
        if (companySnap.exists()) {
          const compData = companySnap.data();
          setCompany({ id: companySnap.id, ...compData });
          if (compData.bannerMessage) {
            setBannerMessage(compData.bannerMessage);
          }
          if (compData.prizes) setPrizes(compData.prizes);
        }

        // Fetch users in this company
        const usersQuery = query(collection(db, "users"), where("companyId", "==", userData.companyId));
        const usersSnap = await getDocs(usersQuery);
        const usersData = usersSnap.docs.map(d => ({ ...d.data(), uid: d.id } as UserProfile));
        setUsers(usersData);

        // Fetch predictions for these users to calculate stats
        let predictionsCount = 0;
        const usersWithPreds = await Promise.all(usersData.map(async (u) => {
          const predSnap = await getDoc(doc(db, "predictions", u.uid));
          const hasPreds = predSnap.exists();
          let status: 'none' | 'incomplete' | 'complete' = 'none';

          if (hasPreds) {
            predictionsCount++;
            const data = predSnap.data();
            if (data.isLocked) {
              status = 'complete';
            } else {
              status = 'incomplete';
            }
          }
          return { ...u, hasPredictions: hasPreds, predictionStatus: status };
        }));

        setUsers(usersWithPreds);

        setStats({
          totalUsers: usersData.length,
          predictionsMade: predictionsCount
        });

      } catch (error) {
        console.error("Error fetching company admin data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userData?.companyId]);

  const handleCopyCode = () => {
    if (company?.code) {
      navigator.clipboard.writeText(company.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const confirmRemoveUser = async () => {
    if (!userToDelete) return;
    
    try {
      await deleteDoc(doc(db, "users", userToDelete.uid));
      // Also attempt to delete predictions, but don't fail if they don't exist
      try { await deleteDoc(doc(db, "predictions", userToDelete.uid)); } catch (e) {}
      
      setUsers(users.filter(u => u.uid !== userToDelete.uid));
      setStats(prev => ({ ...prev, totalUsers: prev.totalUsers - 1 }));
      setMessage({ type: 'success', text: `Usuario ${userToDelete.name} eliminado correctamente.` });
    } catch (error: any) {
      console.error("Error removing user:", error);
      setMessage({ type: 'error', text: 'Hubo un error al eliminar el usuario: ' + (error.message || '') });
    } finally {
      setUserToDelete(null);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const toggleBlockUser = async (uid: string, currentStatus: boolean, name: string) => {
    try {
      await setDoc(doc(db, "users", uid), { isBlocked: !currentStatus }, { merge: true });
      setUsers(users.map(u => u.uid === uid ? { ...u, isBlocked: !currentStatus } : u));
      setMessage({ type: 'success', text: `Usuario ${name} ${!currentStatus ? 'bloqueado' : 'desbloqueado'} correctamente.` });
    } catch (error: any) {
      console.error("Error blocking user:", error);
      setMessage({ type: 'error', text: 'Hubo un error al cambiar el estado del usuario: ' + (error.message || '') });
    } finally {
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleSaveBanner = async () => {
    if (!company?.id) return;
    setSavingBanner(true);
    setBannerSuccess(false);
    try {
      await setDoc(doc(db, "companies", company.id), { bannerMessage }, { merge: true });
      setBannerSuccess(true);
      setTimeout(() => setBannerSuccess(false), 5000);
    } catch (error: any) {
      console.error("Error saving banner:", error);
      setMessage({ type: 'error', text: 'Error al guardar el banner: ' + (error.message || '') });
    } finally {
      setSavingBanner(false);
    }
  };

  const handleSavePrizes = async () => {
    if (!company?.id) return;
    setSavingPrizes(true);
    setPrizeSuccess(false);
    try {
      await setDoc(doc(db, "companies", company.id), { prizes }, { merge: true });
      setPrizeSuccess(true);
      setTimeout(() => setPrizeSuccess(false), 5000);
    } catch (error: any) {
      console.error("Error saving prizes:", error);
      setMessage({ type: 'error', text: 'Error al guardar los premios: ' + (error.message || '') });
    } finally {
      setSavingPrizes(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Nombre', 'Email', 'Rol', 'Puntos', 'Estado Predicciones'];
    const csvData = users.map(u => [
      `"${u.displayName || ''}"`,
      `"${u.email || ''}"`,
      `"${u.role === 'company_admin' ? 'RRHH' : 'Jugador'}"`,
      u.totalPoints || 0,
      `"${u.predictionStatus === 'complete' ? 'Fijo / Completo' : u.predictionStatus === 'incomplete' ? 'Incompleto' : 'Pendiente'}"`
    ].join(';'));
    
    // Add UTF-8 BOM (\uFEFF) to fix Spanish accents in Excel, and use semicolon delimiter
    const csvContent = '\uFEFF' + [headers.join(';'), ...csvData].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_${companyName || 'empresa'}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return <div className="text-center py-10">Cargando panel de {companyName || 'tu empresa'}...</div>;
  }

  if (!company) {
    return <div className="text-center py-10 text-red-500">Error: No se encontró la información de la empresa.</div>;
  }

  const participationRate = stats.totalUsers > 0 ? Math.round((stats.predictionsMade / stats.totalUsers) * 100) : 0;
  const chartData = [{ name: 'Participación', value: participationRate, fill: '#8b5cf6' }];

  return (
    <div className={hideBanner ? "space-y-8" : "max-w-4xl mx-auto space-y-8 px-4 sm:px-6 py-6 md:py-8"}>
      {!hideBanner && <CountdownBanner />}
      
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Building2 className="w-8 h-8" style={{ color: 'var(--brand-color, #9333ea)' }} /> Lista de Participantes
          </h1>
          <p className="text-gray-500 mt-1">Administrá los miembros de {company.name} y enviá recordatorios.</p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-md ${message.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 text-white border-none shadow-lg" style={{ backgroundColor: 'var(--brand-color, #9333ea)' }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-white/80 text-sm font-medium uppercase tracking-wider">Código de Invitación</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-4">
              <div className="text-5xl font-mono font-bold tracking-widest mb-4 bg-white/20 px-4 py-2 rounded-lg">
                {company.code}
              </div>
              <Button 
                onClick={handleCopyCode} 
                variant="outline" 
                className="w-full bg-white hover:bg-gray-100 flex items-center gap-2"
                style={{ color: 'var(--brand-color, #9333ea)' }}
              >
                {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? '¡Copiado!' : 'Copiar Código'}
              </Button>
              <p className="text-xs text-white/70 mt-4 text-center">
                Compartí este código con los empleados para que puedan unirse al prode de la empresa.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="bg-white shadow-sm border border-gray-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-gray-500 text-sm font-medium uppercase tracking-wider">Usuarios Activos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="bg-brand/10 p-3 rounded-full">
                  <Users className="w-6 h-6 text-brand" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalUsers}</p>
                  <p className="text-sm text-gray-500">En {company.name}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white shadow-sm border border-gray-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-gray-500 text-sm font-medium uppercase tracking-wider">Tasa de Participación</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-gray-900">{participationRate}%</p>
                  <p className="text-sm text-gray-500 mt-1">{stats.predictionsMade} de {stats.totalUsers} guardaron su prode</p>
                </div>
                <div className="h-16 w-16 flex items-center justify-center">
                  {/*<RadialBarChart width={64} height={64} cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" barSize={8} data={chartData} startAngle={90} endAngle={-270}>
                    <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                    <RadialBar background dataKey="value" cornerRadius={10} fill="var(--brand-color, #8b5cf6)" />
                  </RadialBarChart>*/}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-sm border border-gray-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-gray-500 text-sm font-medium uppercase tracking-wider">Faltan Completar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="bg-red-100 p-3 rounded-full">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalUsers - stats.predictionsMade}</p>
                  <p className="text-sm text-gray-500">Usuarios sin predicciones</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {company?.plan === 'premium' && (
        <div className="space-y-6">
          <Card className="bg-white shadow-sm border border-gray-100">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5" style={{ color: 'var(--brand-color, #9333ea)' }} />
                Kit de Comunicación Interna
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  Copiá y pegá estos mensajes en Slack, Teams o por Mail para fomentar la participación en tu empresa.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    {
                      title: "Invitación Inicial",
                      body: `¡Llegó el Prode Mundial a ${companyName || 'la empresa'}! 🏆⚽\n\nDemostrá cuánto sabés de fútbol compitiendo con todos tus compañeros. ¡Hay premios para los mejores!\n\nIngresá acá para registrarte y cargar tus predicciones:\n👉 ${window.location.origin}\nCódigo de empresa: ${company?.code}`
                    },
                    {
                      title: "Recordatorio a Rezagados",
                      body: `¡Últimos días para cargar tu Prode! ⏰\n\nTodavía estás a tiempo de participar y competir por los premios. Tenés tiempo hasta el 7 de Junio para fijar tus predicciones antes de que arranque el Mundial.\n\nEntrá ahora y completá tu fixture:\n👉 ${window.location.origin}`
                    },
                    {
                      title: "Mitad de Torneo - Octavos de Final",
                      body: `¡Terminó la Fase de Grupos en el Prode de ${companyName || 'la empresa'}! 📊\n\nEl torneo se pone picante y empiezan los mata-mata. ¿Ya revisaste en qué posición quedaste en el ranking de áreas? ¡Todavía quedan muchos puntos en juego en los partidos individuales!\n\nRevisá el ranking acá:\n👉 ${window.location.origin}`
                    },
                    {
                      title: "Recta Final - Semis y Final",
                      body: `¡Llegamos a la definición del Mundial! 🥇\n\nQuedan solo un par de partidos. Es el momento de la verdad para definir quién se lleva los grandes premios en ${companyName || 'la empresa'}. ¡No te olvides de predecir el resultado de la gran Final!\n\nCargá tus resultados acá:\n👉 ${window.location.origin}`
                    },
                    {
                      title: "Anuncio de Ganadores",
                      body: `¡Tenemos a los campeones del Prode ${companyName || 'la empresa'}! 🥳🏆\n\nGracias a todos por participar. Ha sido un torneo increíble. Felicitaciones especiales a los ganadores del podio que se llevan nuestros premios.\n\nPodés ver el ranking final histórico ingresando acá:\n👉 ${window.location.origin}`
                    }
                  ].map((kit, idx) => (
                    <div key={idx} className="bg-gray-50 p-4 rounded-md border border-gray-200 relative group">
                      <h4 className="font-bold text-sm text-gray-700 mb-2">{kit.title}</h4>
                      <p className="text-xs text-gray-600 whitespace-pre-wrap">{kit.body}</p>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white"
                        onClick={() => {
                          navigator.clipboard.writeText(kit.body);
                          setMessage({ type: 'success', text: 'Mensaje copiado al portapapeles' });
                        }}
                      >
                        <Copy className="w-3 h-3 mr-1" /> Copiar
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-sm border border-gray-100">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-gray-900">Banner de Comunicación Interna</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  Escribe un mensaje que todos los empleados verán en la parte superior de su panel principal (Dashboard). Útil para anunciar premios, fechas límite o mensajes motivacionales.
                </p>
                <textarea
                  value={bannerMessage}
                  onChange={(e) => setBannerMessage(e.target.value)}
                  placeholder="Ej: ¡Recuerden que el ganador se lleva una camiseta oficial! Tienen tiempo hasta el viernes para cargar sus resultados."
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 min-h-[100px]"
                  maxLength={500}
                />
                <div className="flex justify-between items-center">
                  {bannerSuccess ? (
                    <span className="text-green-600 text-sm font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Banner actualizado
                    </span>
                  ) : (
                    <span></span>
                  )}
                  <div className="flex gap-2">
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setBannerMessage('');
                        if (company?.id) {
                          setDoc(doc(db, "companies", company.id), { bannerMessage: '' }, { merge: true });
                        }
                      }}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      Limpiar Banner
                    </Button>
                    <Button 
                      onClick={handleSaveBanner} 
                      disabled={savingBanner}
                      className="text-white"
                      style={{ backgroundColor: 'var(--brand-color, #9333ea)' }}
                    >
                      {savingBanner ? 'Guardando...' : 'Guardar'}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-sm border border-gray-100">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-gray-900">Gestión de Premios</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  Definí los premios para los ganadores del prode. Estos se mostrarán en el dashboard de todos los participantes.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">1º Puesto</label>
                    <input
                      type="text"
                      value={prizes.first}
                      onChange={(e) => setPrizes({ ...prizes, first: e.target.value })}
                      placeholder="Ej: Viaje a Brasil"
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">2º Puesto</label>
                    <input
                      type="text"
                      value={prizes.second}
                      onChange={(e) => setPrizes({ ...prizes, second: e.target.value })}
                      placeholder="Ej: TV 50 pulgadas"
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">3º Puesto</label>
                    <input
                      type="text"
                      value={prizes.third}
                      onChange={(e) => setPrizes({ ...prizes, third: e.target.value })}
                      placeholder="Ej: Camiseta oficial"
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end items-center gap-3 mt-4">
                  {prizeSuccess && <span className="text-sm text-green-600 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Guardado</span>}
                  <Button 
                    onClick={handleSavePrizes} 
                    disabled={savingPrizes}
                    className="text-white"
                    style={{ backgroundColor: 'var(--brand-color, #9333ea)' }}
                  >
                    {savingPrizes ? 'Guardando...' : 'Guardar Premios'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-4 gap-4">
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <Button 
              variant="outline" 
              size="sm" 
              disabled={users.filter(u => u.predictionStatus !== 'complete').length === 0}
              onClick={() => {
                const rezagados = users.filter(u => u.predictionStatus !== 'complete').map(u => u.email).filter(Boolean);
                if (rezagados.length === 0) {
                  setMessage({ type: 'success', text: '¡Todos los usuarios ya completaron sus predicciones!' });
                  window.scrollTo(0, 0);
                  return;
                }
                const subject = encodeURIComponent('¡Recordatorio! Cargá tu Prode Mundial');
                const body = encodeURIComponent(`Hola,\n\nTodavía no cargaste tus predicciones para el Prode Mundial de ${companyName || 'la empresa'}.\n\nIngresá a ${window.location.origin} para completar tu fixture antes de que empiece el mundial.\n\n¡No te quedes afuera!`);
                const mailtoUrl = `mailto:?bcc=${rezagados.join(',')}&subject=${subject}&body=${body}`;
                
                // Safe clipboard fallback
                try {
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(rezagados.join(', ')).then(() => {
                      setMessage({ type: 'success', text: 'Emails copiados al portapapeles. Intentando abrir cliente de correo...' });
                      window.scrollTo(0, 0);
                    }).catch(() => {
                      setMessage({ type: 'success', text: 'Intentando abrir cliente de correo...' });
                      window.scrollTo(0, 0);
                    });
                  } else {
                    setMessage({ type: 'success', text: 'Intentando abrir cliente de correo...' });
                    window.scrollTo(0, 0);
                  }
                } catch (e) {
                  console.error(e);
                }

                // Intentar abrir el cliente de correo de manera clásica
                setTimeout(() => {
                  window.location.href = mailtoUrl;
                }, 500);
              }}
              className="flex items-center justify-center gap-2 text-blue-700 border-blue-200 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto"
            >
              <MessageSquare className="w-4 h-4" /> Recordar a Rezagados
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={exportToCSV}
              className="flex items-center justify-center gap-2 text-green-700 border-green-200 hover:bg-green-50 w-full md:w-auto"
            >
              <Download className="w-4 h-4" /> Exportar a Excel
            </Button>
          </div>
        </div>
        <Card className="border-gray-100 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 min-w-[150px]">Empleado</th>
                    <th className="px-4 py-3 hidden md:table-cell">Email</th>
                    <th className="px-4 py-3 hidden sm:table-cell">Rol</th>
                    <th className="px-4 py-3 text-center">Prode</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.uid} className="bg-white border-b hover:bg-gray-50">
                      <td className="px-4 py-4 font-medium text-gray-900">
                        <div className="flex items-center gap-3">
                          {u.photoURL ? (
                            <img src={u.photoURL} alt={u.displayName} className="w-8 h-8 rounded-full shrink-0" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                              {u.displayName?.charAt(0) || "U"}
                            </div>
                          )}
                          <div className="flex flex-col">
                            <span className="truncate max-w-[120px] md:max-w-none">{u.displayName}</span>
                            <span className="md:hidden text-[10px] text-gray-400 truncate max-w-[120px]">{u.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-gray-600 hidden md:table-cell">{u.email}</td>
                      <td className="px-4 py-4 hidden sm:table-cell">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-medium border ${u.role === 'company_admin' ? 'bg-brand/10 text-brand border-brand/20' : 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                          {u.role === 'company_admin' ? 'RRHH' : 'Jugador'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        {u.predictionStatus === 'complete' ? (
                          <div className="inline-flex items-center gap-1 text-green-700 bg-green-50 p-1.5 rounded-full" title="Fijo / Completo">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        ) : u.predictionStatus === 'incomplete' ? (
                          <div className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 p-1.5 rounded-full" title="Prode guardado pero no fijado">
                            <AlertCircle className="w-4 h-4" />
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 text-gray-400 bg-gray-100 p-1.5 rounded-full" title="Pendiente">
                            <Bell className="w-4 h-4" />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => toggleBlockUser(u.uid, !!u.isBlocked, u.displayName)}
                            disabled={u.role === 'company_admin' && userData.role !== 'admin'}
                            className={`h-8 w-8 ${u.isBlocked ? "text-green-600 border-green-200 bg-green-50" : "text-orange-500 border-orange-200 bg-orange-50"}`}
                            title={u.isBlocked ? "Desbloquear" : "Bloquear"}
                          >
                            <Lock className="w-3.5 h-3.5" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            onClick={() => setUserToDelete({ uid: u.uid, name: u.displayName })}
                            disabled={u.role === 'company_admin' && userData.role !== 'admin'}
                            className="h-8 w-8 text-red-500 border-red-200 bg-red-50 hover:bg-red-100"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        Aún no hay empleados registrados en tu empresa.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {userToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Confirmar eliminación</h3>
            <p className="text-gray-600 mb-6">
              ¿Estás seguro de eliminar a <span className="font-semibold">{userToDelete.name}</span> de tu empresa? 
              Esto borrará su cuenta y todas sus predicciones de forma permanente.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setUserToDelete(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={confirmRemoveUser} className="bg-red-600 hover:bg-red-700">
                Eliminar usuario
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
