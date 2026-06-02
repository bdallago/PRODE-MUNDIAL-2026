"use client";
import { useState, useEffect } from "react";
import { collection, query, where, getDocs, doc, deleteDoc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Users, Trash2, Building2, Calculator, Copy, CheckCircle2, Trophy, AlertCircle, Download, MessageSquare, Lock, Bell, PenSquare } from "lucide-react";
import { CountdownBanner } from "../components/CountdownBanner";
import { useLanguage } from "../i18n/LanguageContext";
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
  const { t, lang } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<any>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    predictionsMade: 0
  });
  const [userToDelete, setUserToDelete] = useState<{uid: string, name: string} | null>(null);
  const [userToBlock, setUserToBlock] = useState<{uid: string, name: string, isBlocked: boolean} | null>(null);
  const [editingUser, setEditingUser] = useState<{uid: string, currentName: string, newName: string} | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [bannerMessage, setBannerMessage] = useState("");
  const [savingBanner, setSavingBanner] = useState(false);
  const [bannerSuccess, setBannerSuccess] = useState(false);
  
  const [prizes, setPrizes] = useState({ first: '', second: '', third: '' });
  const [savingPrizes, setSavingPrizes] = useState(false);
  const [prizeSuccess, setPrizeSuccess] = useState(false);

  const [notifications, setNotifications] = useState<{
    channel?: string;
    webhookUrl?: string;
    morningMessage?: boolean;
    preMatchReminder?: boolean;
    morningMessageHour?: number;
  }>({});
  const [savingNotif, setSavingNotif] = useState<"morningMessage" | "preMatchReminder" | "morningMessageHour" | null>(null);

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
          if (compData.notifications) setNotifications(compData.notifications);
        }

        // Fetch users in this company
        const usersQuery = query(collection(db, "users"), where("companyId", "==", userData.companyId));
        const usersSnap = await getDocs(usersQuery);
        
        let predictionsCount = 0;
        const usersData = usersSnap.docs.map(d => {
          const u = d.data();
          if (u.hasSavedPredictions || u.predictionStatus === 'complete' || u.predictionStatus === 'incomplete') {
            predictionsCount++;
          }
          return { 
            ...u, 
            uid: d.id,
            hasPredictions: !!u.hasSavedPredictions,
            predictionStatus: u.predictionStatus || 'none'
          } as UserProfile;
        });
        
        setUsers(usersData);

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

  const confirmToggleBlockUser = async () => {
    if (!userToBlock) return;
    await toggleBlockUser(userToBlock.uid, userToBlock.isBlocked, userToBlock.name);
    setUserToBlock(null);
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

  const handleRenameUser = async () => {
    if (!editingUser || !editingUser.newName.trim()) return;
    setSavingName(true);
    try {
      await setDoc(doc(db, "users", editingUser.uid), { displayName: editingUser.newName.trim() }, { merge: true });
      setUsers(users.map(u => u.uid === editingUser.uid ? { ...u, displayName: editingUser.newName.trim() } : u));
      setMessage({ type: 'success', text: `Nombre actualizado correctamente.` });
      setEditingUser(null);
    } catch (error: any) {
      console.error("Error renaming user:", error);
      setMessage({ type: 'error', text: 'Error al cambiar el nombre: ' + (error.message || '') });
    } finally {
      setSavingName(false);
      setTimeout(() => setMessage(null), 5000);
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

  const handleSaveMorningHour = async (hour: number) => {
    if (!company?.id) return;
    setSavingNotif("morningMessageHour");
    try {
      await setDoc(
        doc(db, "companies", company.id),
        { notifications: { morningMessageHour: hour } },
        { merge: true }
      );
      setNotifications((prev) => ({ ...prev, morningMessageHour: hour }));
    } catch (error: any) {
      setMessage({ type: 'error', text: 'Error al guardar la hora: ' + (error.message || '') });
    } finally {
      setSavingNotif(null);
    }
  };

  const handleToggleNotification = async (field: "morningMessage" | "preMatchReminder") => {
    if (!company?.id) return;
    setSavingNotif(field);
    const newValue = !notifications[field];
    try {
      await setDoc(
        doc(db, "companies", company.id),
        { notifications: { [field]: newValue } },
        { merge: true }
      );
      setNotifications((prev) => ({ ...prev, [field]: newValue }));
    } catch (error: any) {
      setMessage({ type: 'error', text: 'Error al guardar la configuración: ' + (error.message || '') });
    } finally {
      setSavingNotif(null);
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
    return <div className="text-center py-10">{t.companyAdmin.loading} {companyName || ''}...</div>;
  }

  if (!company) {
    return <div className="text-center py-10 text-red-500">{t.companyAdmin.noCompany}</div>;
  }

  const participationRate = stats.totalUsers > 0 ? Math.round((stats.predictionsMade / stats.totalUsers) * 100) : 0;
  const chartData = [{ name: 'Participación', value: participationRate, fill: '#8b5cf6' }];

  return (
    <div className={hideBanner ? "space-y-8" : "max-w-4xl mx-auto space-y-8 px-4 sm:px-6 py-6 md:py-8"}>
      {!hideBanner && <CountdownBanner />}
      
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Building2 className="w-8 h-8" style={{ color: 'var(--brand-color, #9333ea)' }} /> {t.companyAdmin.title}
          </h1>
          <p className="text-gray-500 mt-1">{t.companyAdmin.subtitle} {company.name} {t.companyAdmin.subtitle2}</p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-md ${message.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 border-none shadow-lg" style={{ backgroundColor: 'var(--brand-bg, var(--brand-color, #9333ea))', color: 'var(--brand-on-bg, white)' }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-wider opacity-80">{t.companyAdmin.inviteCode}</CardTitle>
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
                {copied ? t.companyAdmin.copied : t.companyAdmin.copyCode}
              </Button>
              <p className="text-xs opacity-70 mt-4 text-center">
                {t.companyAdmin.codeHint}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="bg-white shadow-sm border border-gray-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-gray-500 text-sm font-medium uppercase tracking-wider">{t.companyAdmin.activeUsers}</CardTitle>
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
              <CardTitle className="text-gray-500 text-sm font-medium uppercase tracking-wider">{t.companyAdmin.participationRate}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-gray-900">{participationRate}%</p>
                  <p className="text-sm text-gray-500 mt-1">{stats.predictionsMade} {t.companyAdmin.of} {stats.totalUsers} {t.companyAdmin.savedPrede}</p>
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
              <CardTitle className="text-gray-500 text-sm font-medium uppercase tracking-wider">{t.companyAdmin.remaining}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="bg-red-100 p-3 rounded-full">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalUsers - stats.predictionsMade}</p>
                  <p className="text-sm text-gray-500">{t.companyAdmin.noPredsUsers}</p>
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
                {t.companyAdmin.commKit}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  {t.companyAdmin.commKitDesc}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(lang === 'en' ? [
                    {
                      title: "Initial Invitation",
                      body: `The World Cup Prode has arrived at ${companyName || 'your company'}! 🏆⚽\n\nShow off your football knowledge competing with your colleagues. There are prizes for the best!\n\nSign up here and submit your predictions:\n👉 ${window.location.origin}\nCompany code: ${company?.code}`
                    },
                    {
                      title: "Reminder for Latecomers",
                      body: `Last days to submit your Prode! ⏰\n\nYou're still in time to participate and compete for prizes. You have until June 11 to lock in your predictions before the World Cup starts.\n\nSign in now and complete your fixture:\n👉 ${window.location.origin}`
                    },
                    {
                      title: "Halfway - Round of 16",
                      body: `The Group Stage is over at ${companyName || 'your company'}'s Prode! 📊\n\nThe tournament heats up as the knockout rounds begin. Have you checked your ranking position yet? There are still many points up for grabs in individual matches!\n\nCheck the ranking here:\n👉 ${window.location.origin}`
                    },
                    {
                      title: "Final Stretch - Semis & Final",
                      body: `We've reached the World Cup final stretch! 🥇\n\nOnly a couple of matches left. This is the moment of truth to define who takes the big prizes at ${companyName || 'your company'}. Don't forget to predict the result of the Grand Final!\n\nSubmit your predictions here:\n👉 ${window.location.origin}`
                    },
                    {
                      title: "Winner Announcement",
                      body: `We have our ${companyName || 'your company'} Prode champions! 🥳🏆\n\nThank you all for participating. It has been an incredible tournament. Special congratulations to the podium winners who take home our prizes.\n\nYou can see the final historical ranking here:\n👉 ${window.location.origin}`
                    }
                  ] : [
                    {
                      title: "Invitación Inicial",
                      body: `¡Llegó el Prode Mundial a ${companyName || 'la empresa'}! 🏆⚽\n\nDemostrá cuánto sabés de fútbol compitiendo con todos tus compañeros. ¡Hay premios para los mejores!\n\nIngresá acá para registrarte y cargar tus predicciones:\n👉 ${window.location.origin}\nCódigo de empresa: ${company?.code}`
                    },
                    {
                      title: "Recordatorio a Rezagados",
                      body: `¡Últimos días para cargar tu Prode! ⏰\n\nTodavía estás a tiempo de participar y competir por los premios. Tenés tiempo hasta el 11 de Junio para fijar tus predicciones antes de que arranque el Mundial.\n\nEntrá ahora y completá tu fixture:\n👉 ${window.location.origin}`
                    },
                    {
                      title: "Mitad de Torneo - Octavos de Final",
                      body: `¡Terminó la Fase de Grupos en el Prode de ${companyName || 'la empresa'}! 📊\n\nEl torneo se pone picante y empiezan los mata-mata. ¿Ya revisaste en qué posición quedaste en el ranking? ¡Todavía quedan muchos puntos en juego en los partidos individuales!\n\nRevisá el ranking acá:\n👉 ${window.location.origin}`
                    },
                    {
                      title: "Recta Final - Semis y Final",
                      body: `¡Llegamos a la definición del Mundial! 🥇\n\nQuedan solo un par de partidos. Es el momento de la verdad para definir quién se lleva los grandes premios en ${companyName || 'la empresa'}. ¡No te olvides de predecir el resultado de la gran Final!\n\nCargá tus resultados acá:\n👉 ${window.location.origin}`
                    },
                    {
                      title: "Anuncio de Ganadores",
                      body: `¡Tenemos a los campeones del Prode ${companyName || 'la empresa'}! 🥳🏆\n\nGracias a todos por participar. Ha sido un torneo increíble. Felicitaciones especiales a los ganadores del podio que se llevan nuestros premios.\n\nPodés ver el ranking final histórico ingresando acá:\n👉 ${window.location.origin}`
                    }
                  ]).map((kit, idx) => (
                    <div key={idx} className="bg-gray-50 p-4 rounded-md border border-gray-200 relative group">
                      <h4 className="font-bold text-sm text-gray-700 mb-2">{kit.title}</h4>
                      <p className="text-xs text-gray-600 whitespace-pre-wrap">{kit.body}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="absolute top-2 right-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity bg-white"
                        onClick={() => {
                          navigator.clipboard.writeText(kit.body);
                          setMessage({ type: 'success', text: t.companyAdmin.msgCopied });
                        }}
                      >
                        <Copy className="w-3 h-3 mr-1" /> {t.companyAdmin.copy}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-sm border border-gray-100">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-gray-900">{t.companyAdmin.bannerTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  {t.companyAdmin.bannerDesc}
                </p>
                <textarea
                  value={bannerMessage}
                  onChange={(e) => setBannerMessage(e.target.value)}
                  placeholder={t.companyAdmin.bannerPlaceholder}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 min-h-[100px]"
                  maxLength={500}
                />
                <div className="flex justify-between items-center">
                  {bannerSuccess ? (
                    <span className="text-green-600 text-sm font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> {t.companyAdmin.bannerUpdated}
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
                      {t.companyAdmin.clearBanner}
                    </Button>
                    <Button
                      onClick={handleSaveBanner}
                      disabled={savingBanner}
                      className="text-white"
                      style={{ backgroundColor: 'var(--brand-color, #9333ea)' }}
                    >
                      {savingBanner ? t.companyAdmin.saving : t.companyAdmin.save}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-sm border border-gray-100">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-gray-900">{t.companyAdmin.prizesTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  {t.companyAdmin.prizesDesc}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.companyAdmin.prize1}</label>
                    <input
                      type="text"
                      value={prizes.first}
                      onChange={(e) => setPrizes({ ...prizes, first: e.target.value })}
                      placeholder={t.companyAdmin.prize1Placeholder}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.companyAdmin.prize2}</label>
                    <input
                      type="text"
                      value={prizes.second}
                      onChange={(e) => setPrizes({ ...prizes, second: e.target.value })}
                      placeholder={t.companyAdmin.prize2Placeholder}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.companyAdmin.prize3}</label>
                    <input
                      type="text"
                      value={prizes.third}
                      onChange={(e) => setPrizes({ ...prizes, third: e.target.value })}
                      placeholder={t.companyAdmin.prize3Placeholder}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end items-center gap-3 mt-4">
                  {prizeSuccess && <span className="text-sm text-green-600 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> {t.companyAdmin.prizeSaved}</span>}
                  <Button
                    onClick={handleSavePrizes}
                    disabled={savingPrizes}
                    className="text-white"
                    style={{ backgroundColor: 'var(--brand-color, #9333ea)' }}
                  >
                    {savingPrizes ? t.companyAdmin.saving : t.companyAdmin.savePrizes}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-sm border border-gray-100">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Bell className="w-5 h-5" style={{ color: 'var(--brand-color, #9333ea)' }} />
                Notificaciones Automáticas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!notifications.webhookUrl ? (
                <p className="text-sm text-gray-500">
                  Este espacio aún no tiene un canal configurado. Contactá con soporte para activar las notificaciones.
                </p>
              ) : (
                <div className="space-y-5">
                  <p className="text-sm text-gray-500">
                    Canal configurado:{" "}
                    <span className="font-medium text-gray-700">
                      {notifications.channel === "google_chat"
                        ? "Google Chat"
                        : notifications.channel === "slack"
                        ? "Slack"
                        : "Microsoft Teams"}
                    </span>
                  </p>

                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-800">Mensaje matutino</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Resumen de partidos del día con recordatorio de predicciones.
                      </p>
                      {notifications.morningMessage && (
                        <div className="flex items-center gap-2 mt-2">
                          <label className="text-xs text-gray-500">Hora de envío:</label>
                          <select
                            value={notifications.morningMessageHour ?? 11}
                            onChange={(e) => handleSaveMorningHour(Number(e.target.value))}
                            disabled={savingNotif === "morningMessageHour"}
                            className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                          >
                            {Array.from({ length: 24 }, (_, i) => (
                              <option key={i} value={i}>{String(i).padStart(2, "0")}:00hs</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleToggleNotification("morningMessage")}
                      disabled={savingNotif === "morningMessage"}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${notifications.morningMessage ? "" : "bg-gray-200"}`}
                      style={notifications.morningMessage ? { backgroundColor: 'var(--brand-color, #9333ea)' } : {}}
                      role="switch"
                      aria-checked={!!notifications.morningMessage}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${notifications.morningMessage ? "translate-x-5" : "translate-x-0"}`} />
                    </button>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-800">Recordatorio pre-partido</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Aviso ~90 minutos antes de cada partido.
                      </p>
                    </div>
                    <button
                      onClick={() => handleToggleNotification("preMatchReminder")}
                      disabled={savingNotif === "preMatchReminder"}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${notifications.preMatchReminder ? "" : "bg-gray-200"}`}
                      style={notifications.preMatchReminder ? { backgroundColor: 'var(--brand-color, #9333ea)' } : {}}
                      role="switch"
                      aria-checked={!!notifications.preMatchReminder}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${notifications.preMatchReminder ? "translate-x-5" : "translate-x-0"}`} />
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-4 gap-4">
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <Button 
              size="sm" 
              disabled={users.filter(u => u.predictionStatus !== 'complete').length === 0}
              onClick={() => {
                const rezagados = users.filter(u => u.predictionStatus !== 'complete').map(u => u.email).filter(Boolean);
                if (rezagados.length === 0) {
                  setMessage({ type: 'success', text: t.companyAdmin.msgAllPredictions });
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

                window.open(mailtoUrl, '_blank');
              }}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white border-blue-600 disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto"
            >
              <MessageSquare className="w-4 h-4" /> {t.companyAdmin.remindLaggards}
            </Button>
            <Button
              size="sm"
              onClick={exportToCSV}
              className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white border-green-600 w-full md:w-auto"
            >
              <Download className="w-4 h-4" /> {t.companyAdmin.exportCSV}
            </Button>
          </div>
        </div>
        <Card className="border-gray-100 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 min-w-[150px]">{t.companyAdmin.colEmployee}</th>
                    <th className="px-4 py-3 hidden md:table-cell">{t.companyAdmin.colEmail}</th>
                    <th className="px-4 py-3 hidden sm:table-cell">{t.companyAdmin.colRole}</th>
                    <th className="px-4 py-3 text-center">{t.companyAdmin.colPrede}</th>
                    <th className="px-4 py-3 text-right">{t.companyAdmin.colActions}</th>
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
                          {u.role === 'company_admin' ? t.companyAdmin.roleHR : t.companyAdmin.rolePlayer}
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
                            onClick={() => setEditingUser({ uid: u.uid, currentName: u.displayName, newName: u.displayName })}
                            className="h-8 w-8 text-blue-500 border-blue-200 bg-blue-50 hover:bg-blue-100"
                            title="Editar nombre"
                          >
                            <PenSquare className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setUserToBlock({ uid: u.uid, name: u.displayName, isBlocked: !!u.isBlocked })}
                            disabled={u.role === 'company_admin' && userData.role !== 'admin'}
                            className={`h-8 w-8 ${u.isBlocked ? "text-green-600 border-green-200 bg-green-50" : "text-orange-500 border-orange-200 bg-orange-50"}`}
                            title={u.role === 'company_admin' && userData.role !== 'admin' ? 'No podés modificar a otro admin' : u.isBlocked ? "Desbloquear" : "Bloquear"}
                          >
                            <Lock className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setUserToDelete({ uid: u.uid, name: u.displayName })}
                            disabled={u.role === 'company_admin' && userData.role !== 'admin'}
                            className="h-8 w-8 text-red-500 border-red-200 bg-red-50 hover:bg-red-100"
                            title={u.role === 'company_admin' && userData.role !== 'admin' ? 'No podés modificar a otro admin' : 'Eliminar'}
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
                        {t.companyAdmin.noEmployees}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 mb-1">{t.companyAdmin.editUserTitle}</h3>
            <p className="text-gray-500 text-sm mb-5">
              {t.companyAdmin.editUserDesc}
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{t.companyAdmin.currentName}</label>
                <p className="text-gray-800 font-medium">{editingUser.currentName}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{t.companyAdmin.newName}</label>
                <input
                  type="text"
                  value={editingUser.newName}
                  onChange={(e) => setEditingUser({ ...editingUser, newName: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && handleRenameUser()}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
                  maxLength={50}
                  placeholder={t.companyAdmin.namePlaceholder}
                  autoFocus
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setEditingUser(null)}>{t.companyAdmin.cancel}</Button>
              <Button
                onClick={handleRenameUser}
                disabled={savingName || !editingUser.newName.trim() || editingUser.newName.trim() === editingUser.currentName}
                className="text-white"
                style={{ backgroundColor: 'var(--brand-color, #9333ea)' }}
              >
                {savingName ? t.companyAdmin.saving : t.companyAdmin.saveName}
              </Button>
            </div>
          </div>
        </div>
      )}

      {userToBlock && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {userToBlock.isBlocked ? t.companyAdmin.unblockUserTitle : t.companyAdmin.blockUserTitle}
            </h3>
            <p className="text-gray-600 mb-6">
              ¿Estás seguro de {userToBlock.isBlocked ? t.companyAdmin.unblockWord : t.companyAdmin.blockWord} a{' '}
              <span className="font-semibold">{userToBlock.name}</span>?
              {!userToBlock.isBlocked && ' ' + t.companyAdmin.blockWarning}
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setUserToBlock(null)}>{t.companyAdmin.cancel}</Button>
              <Button
                onClick={confirmToggleBlockUser}
                className={`text-white ${userToBlock.isBlocked ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-500 hover:bg-orange-600'}`}
              >
                {userToBlock.isBlocked ? t.companyAdmin.unblock : t.companyAdmin.block}
              </Button>
            </div>
          </div>
        </div>
      )}

      {userToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 mb-2">{t.companyAdmin.deleteTitle}</h3>
            <p className="text-gray-600 mb-6">
              ¿Estás seguro de eliminar a <span className="font-semibold">{userToDelete.name}</span>?{' '}
              {t.companyAdmin.deleteWarning}
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setUserToDelete(null)}>
                {t.companyAdmin.cancel}
              </Button>
              <Button variant="destructive" onClick={confirmRemoveUser} className="bg-red-600 hover:bg-red-700">
                {t.companyAdmin.deleteBtn}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
