"use client";
import React, { useState, useEffect } from "react";
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, writeBatch, query, orderBy, where } from "firebase/firestore";
import { db, auth } from "../firebase";
import { GROUPS, SPECIAL_QUESTIONS, KNOCKOUT_STAGES, ALL_TEAMS } from "../data";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Save, Calculator, AlertCircle, CheckCircle2, Trash2, Users, MessageSquareWarning, Paperclip, Unlock, Building2, Eye, Ban } from "lucide-react";
import { CountdownBanner } from "../components/CountdownBanner";
import CompanyAdmin from "./CompanyAdmin";

interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  role: string;
  totalPoints: number;
}

interface Report {
  id: string;
  message: string;
  userEmail: string;
  userName: string;
  createdAt: string;
  attachments?: string[];
}

export default function Admin() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{type: 'calc' | 'delete' | 'reset' | 'deleteCompany' | 'restoreCompany' | 'permanentDeleteCompany', uid?: string, name?: string, companyId?: string} | null>(null);
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  // State for actual results
  const [actualGroups, setActualGroups] = useState<Record<string, string[]>>(GROUPS);
  const [actualSpecials, setActualSpecials] = useState<Record<string, string>>({});
  const [actualKnockouts, setActualKnockouts] = useState<Record<string, string[]>>({});
  
  // State for users
  const [users, setUsers] = useState<UserProfile[]>([]);
  
  // State for reports
  const [reports, setReports] = useState<Report[]>([]);

  // State for companies
  const [companies, setCompanies] = useState<any[]>([]);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyHREmail, setNewCompanyHREmail] = useState("");
  const [newCompanyPlan, setNewCompanyPlan] = useState<'base' | 'premium'>('base');
  const [newCompanyColor, setNewCompanyColor] = useState("#1d4ed8");
  const [newCompanyLogo, setNewCompanyLogo] = useState("");
  const [newCompanyAreas, setNewCompanyAreas] = useState("");
  const [creatingCompany, setCreatingCompany] = useState(false);

  const [activeTab, setActiveTab] = useState<'results' | 'users' | 'reports' | 'analytics' | 'companies'>('results');

  // Analytics state
  const [analytics, setAnalytics] = useState({
    totalUsers: 0,
    totalPredictions: 0,
    usersWithPredictions: 0,
    activeToday: 0
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch results
        const docRef = doc(db, "results", "actual");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          
          // Sanitize groups to ensure they match current GROUPS
          const sanitizedGroups: Record<string, string[]> = {};
          const savedGroups = data.groups || {};
          
          for (const [groupLetter, currentTeams] of Object.entries(GROUPS)) {
            const savedTeams = savedGroups[groupLetter] || [];
            const validSavedTeams = (savedTeams as string[]).filter(t => currentTeams.includes(t));
            const missingTeams = currentTeams.filter(t => !validSavedTeams.includes(t));
            sanitizedGroups[groupLetter] = [...validSavedTeams, ...missingTeams];
          }
          
          setActualGroups(sanitizedGroups);
          setActualSpecials(data.specials || {});
          setActualKnockouts(data.knockouts || {});
        } else {
          setActualGroups(GROUPS);
        }

        // Fetch users
        const usersSnap = await getDocs(collection(db, "users"));
        const usersData = usersSnap.docs.map(d => ({ ...d.data(), uid: d.id } as any));
        setUsers(usersData);
        
        // Fetch predictions to calculate analytics
        const predictionsSnap = await getDocs(collection(db, "predictions"));
        
        // Calculate analytics
        const today = new Date().toISOString().split('T')[0];
        let activeTodayCount = 0;
        
        usersData.forEach(u => {
          if (u.lastLogin && u.lastLogin.startsWith(today)) {
            activeTodayCount++;
          }
        });

        setAnalytics({
          totalUsers: usersData.length,
          totalPredictions: predictionsSnap.size,
          usersWithPredictions: predictionsSnap.size, // Assuming 1 prediction doc per user
          activeToday: activeTodayCount
        });
        
        // Fetch reports
        const reportsQuery = query(collection(db, "reports"), orderBy("createdAt", "desc"));
        const reportsSnap = await getDocs(reportsQuery);
        const reportsData = reportsSnap.docs.map(d => ({ ...d.data(), id: d.id } as Report));
        setReports(reportsData);
        
        // Fetch companies
        const companiesSnap = await getDocs(collection(db, "companies"));
        const companiesData = companiesSnap.docs.map(d => ({ ...d.data(), id: d.id }));
        setCompanies(companiesData);
        
      } catch (error) {
        console.error("Error fetching admin data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleGroupChange = (groupLetter: string, index: number, value: string) => {
    setActualGroups(prev => {
      const newGroup = [...prev[groupLetter]];
      newGroup[index] = value;
      return { ...prev, [groupLetter]: newGroup };
    });
  };

  const handleSpecialChange = (id: string, value: string) => {
    setActualSpecials(prev => ({ ...prev, [id]: value }));
  };

  const saveResults = async () => {
    setSaving(true);
    setMessage(null);
    
    try {
      const docRef = doc(db, "results", "actual");
      await setDoc(docRef, {
        groups: actualGroups,
        specials: actualSpecials,
        knockouts: actualKnockouts, // Keep this so it passes firestore rules
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      setMessage({ type: 'success', text: 'Resultados oficiales guardados con éxito.' });
    } catch (error) {
      console.error("Error saving results:", error);
      setMessage({ type: 'error', text: 'Hubo un error al guardar los resultados.' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const calculatePoints = async () => {
    setCalculating(true);
    setMessage(null);

    try {
      // 1. Fetch actual results
      const resultsRef = doc(db, "results", "actual");
      const resultsSnap = await getDoc(resultsRef);
      if (!resultsSnap.exists()) {
        throw new Error("No hay resultados oficiales guardados. Primero debes hacer clic en 'Guardar Resultados'.");
      }
      const actualData = resultsSnap.data();
      
      // Sanitize actualG
      const sanitizedActualG: Record<string, string[]> = {};
      const savedActualG = actualData.groups || {};
      for (const [groupLetter, currentTeams] of Object.entries(GROUPS)) {
        const savedTeams = savedActualG[groupLetter] || [];
        const validSavedTeams = (savedTeams as string[]).filter(t => currentTeams.includes(t));
        const missingTeams = currentTeams.filter(t => !validSavedTeams.includes(t));
        sanitizedActualG[groupLetter] = [...validSavedTeams, ...missingTeams];
      }
      
      const actualG = sanitizedActualG;
      const actualS = actualData.specials || {};
      const actualK = actualData.knockouts || {};

      // 2. Fetch all predictions
      const predictionsSnap = await getDocs(collection(db, "predictions"));
      const predictions = predictionsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

      // Fetch all users to ensure we only update existing ones
      const usersSnapCheck = await getDocs(collection(db, "users"));
      const existingUserIds = new Set(usersSnapCheck.docs.map(d => d.id));

      // 3. Prepare batch update for users
      const batch = writeBatch(db);
      
      for (const pred of predictions) {
        if (!existingUserIds.has(pred.id)) continue; // Skip if user doc is missing
        
        let totalPoints = 0;
        const pGroups = pred.groups || {};
        
        // Sanitize pGroups
        const sanitizedPGroups: Record<string, string[]> = {};
        for (const [groupLetter, currentTeams] of Object.entries(GROUPS)) {
          const savedTeams = pGroups[groupLetter] || [];
          const validSavedTeams = (savedTeams as string[]).filter(t => currentTeams.includes(t));
          const missingTeams = currentTeams.filter(t => !validSavedTeams.includes(t));
          sanitizedPGroups[groupLetter] = [...validSavedTeams, ...missingTeams];
        }

        const pSpecials = pred.specials || {};

        // Calculate Group Points
        // +1 Punto por cada acierto en la posición exacta
        // +2 Puntos por cada grupo perfecto (All 4 in correct order)
        for (const [groupLetter, actualTeams] of Object.entries(actualG)) {
          const predictedTeams = sanitizedPGroups[groupLetter];
          if (!predictedTeams || !Array.isArray(actualTeams)) continue;

          // Check exact matches
          let exactMatches = 0;
          for (let i = 0; i < 4; i++) {
            if (actualTeams[i] && predictedTeams[i] === actualTeams[i]) {
              exactMatches++;
              totalPoints += 1;
            }
          }

          // Check perfect group
          if (exactMatches === 4) {
            totalPoints += 2;
          }
        }

        // Calculate Special Points (+10 each)
        for (const [qId, actualAnswer] of Object.entries(actualS)) {
          const predictedAnswer = pSpecials[qId];
          if (predictedAnswer && actualAnswer && typeof actualAnswer === 'string' && typeof predictedAnswer === 'string') {
            if (predictedAnswer.trim().toLowerCase() === actualAnswer.trim().toLowerCase()) {
              totalPoints += 10;
            }
          }
        }

        // Calculate Knockout Points (Disabled for now)
        /*
        const pKnockouts = pred.knockouts || {};
        for (const stage of KNOCKOUT_STAGES) {
          const actualTeams = actualK[stage.id] || [];
          const predictedTeams = pKnockouts[stage.id] || [];
          
          const uniquePredicted = Array.from(new Set(predictedTeams.filter(Boolean)));
          for (const pTeam of uniquePredicted) {
            if (actualTeams.includes(pTeam)) {
              totalPoints += stage.points;
            }
          }
        }
        */

        // Update user document
        const userRef = doc(db, "users", pred.id); // Use pred.id which is guaranteed to be the UID
        batch.set(userRef, { totalPoints }, { merge: true });
      }

      await batch.commit();

      // Re-fetch users to update the UI with new points
      const usersSnap = await getDocs(collection(db, "users"));
      const usersData = usersSnap.docs.map(d => ({ ...d.data(), uid: d.id } as UserProfile));
      setUsers(usersData);

      setMessage({ type: 'success', text: 'Puntos calculados y actualizados para todos los usuarios.' });
      window.scrollTo(0, 0);

    } catch (error: any) {
      console.error("Error calculating points:", error);
      setMessage({ type: 'error', text: error.message || 'Hubo un error al calcular los puntos.' });
      window.scrollTo(0, 0);
    } finally {
      setCalculating(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const resetPoints = async () => {
    setCalculating(true);
    setMessage(null);

    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const batch = writeBatch(db);
      
      usersSnap.docs.forEach(d => {
        batch.set(doc(db, "users", d.id), { totalPoints: 0 }, { merge: true });
      });

      await batch.commit();

      const updatedUsersSnap = await getDocs(collection(db, "users"));
      const usersData = updatedUsersSnap.docs.map(d => ({ ...d.data(), uid: d.id } as UserProfile));
      setUsers(usersData);

      setMessage({ type: 'success', text: 'Todos los puntos han sido reseteados a 0.' });
      window.scrollTo(0, 0);
    } catch (error: any) {
      console.error("Error resetting points:", error);
      setMessage({ type: 'error', text: 'Hubo un error al resetear los puntos.' });
      window.scrollTo(0, 0);
    } finally {
      setCalculating(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const deleteUser = async (uid: string, name: string) => {
    try {
      // Delete user profile
      await deleteDoc(doc(db, "users", uid));
      // Delete user predictions
      await deleteDoc(doc(db, "predictions", uid));
      
      // Update local state
      setUsers(users.filter(u => u.uid !== uid));
      setMessage({ type: 'success', text: `Usuario ${name} eliminado con éxito.` });
    } catch (error) {
      console.error("Error deleting user:", error);
      setMessage({ type: 'error', text: 'Error al eliminar usuario. Verifica los permisos.' });
    } finally {
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const deleteReport = async (id: string) => {
    try {
      await deleteDoc(doc(db, "reports", id));
      setReports(reports.filter(r => r.id !== id));
      setMessage({ type: 'success', text: `Reporte eliminado con éxito.` });
    } catch (error) {
      console.error("Error deleting report:", error);
      setMessage({ type: 'error', text: 'Error al eliminar reporte.' });
    } finally {
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const unfixPredictions = async (uid: string, name: string) => {
    try {
      const predRef = doc(db, "predictions", uid);
      const predSnap = await getDoc(predRef);
      if (predSnap.exists()) {
        await setDoc(predRef, { isLocked: false }, { merge: true });
        setMessage({ type: 'success', text: `Predicciones de ${name} desfijadas con éxito.` });
      } else {
        setMessage({ type: 'error', text: `El usuario ${name} aún no tiene predicciones guardadas.` });
      }
    } catch (error) {
      console.error("Error unfixing predictions:", error);
      setMessage({ type: 'error', text: 'Error al desfijar predicciones.' });
    } finally {
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const deleteCompany = async (companyId: string, companyName: string) => {
    try {
      await deleteDoc(doc(db, "companies", companyId));
      setCompanies(companies.filter(c => c.id !== companyId));
      setMessage({ type: 'success', text: `Empresa ${companyName} eliminada permanentemente.` });
    } catch (error) {
      console.error("Error deleting company:", error);
      setMessage({ type: 'error', text: 'Error al eliminar la empresa.' });
    } finally {
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 400;
          const MAX_HEIGHT = 400;
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/png', 0.8);
          setNewCompanyLogo(dataUrl);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const createCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim() || !newCompanyHREmail.trim()) {
      setMessage({ type: 'error', text: 'Por favor completá todos los campos.' });
      return;
    }
    
    setCreatingCompany(true);
    setMessage(null);

    try {
      // Generate a random 6-character code
      const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();
      let newCode = generateCode();
      
      // Ensure code is unique
      let isUnique = false;
      while (!isUnique) {
        const q = query(collection(db, "companies"), where("code", "==", newCode));
        const snap = await getDocs(q);
        if (snap.empty) {
          isUnique = true;
        } else {
          newCode = generateCode();
        }
      }

      const hrEmailsArray = newCompanyHREmail.split(',').map(e => e.trim().toLowerCase()).filter(e => e);
      
      const companyRef = doc(collection(db, "companies"));
      const newCompanyData: any = {
        name: newCompanyName.trim(),
        code: newCode,
        hrEmail: hrEmailsArray[0] || "", // Keep for backward compatibility
        hrEmails: hrEmailsArray,
        plan: newCompanyPlan,
        createdBy: auth.currentUser?.uid || "",
        createdAt: new Date().toISOString()
      };

      if (newCompanyPlan === 'premium') {
        newCompanyData.color = newCompanyColor;
        newCompanyData.logoUrl = newCompanyLogo.trim();
        newCompanyData.areas = newCompanyAreas.split(',').map(a => a.trim()).filter(a => a);
      }
      
      await setDoc(companyRef, newCompanyData);

      setCompanies([{ ...newCompanyData, id: companyRef.id }, ...companies]);
      setNewCompanyName("");
      setNewCompanyHREmail("");
      setNewCompanyPlan('base');
      setNewCompanyColor("#1d4ed8");
      setNewCompanyLogo("");
      setNewCompanyAreas("");
      setMessage({ type: 'success', text: `Empresa ${newCompanyData.name} creada con código ${newCode}.` });
    } catch (error) {
      console.error("Error creating company:", error);
      setMessage({ type: 'error', text: 'Error al crear la empresa.' });
    } finally {
      setCreatingCompany(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  if (loading) {
    return <div className="text-center py-10">Cargando panel de administración...</div>;
  }

  if (selectedCompanyId) {
    return (
      <div className="space-y-4">
        <Button onClick={() => setSelectedCompanyId(null)} variant="outline" className="mb-2">
          &larr; Volver al Panel de Administración
        </Button>
        <CompanyAdmin userData={{ role: 'admin', companyId: selectedCompanyId }} hideBanner={true} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <CountdownBanner />
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Panel de Administración</h1>
          <p className="text-gray-500 mt-1">Gestioná resultados, usuarios y reportes.</p>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto flex-wrap">
          <Button 
            variant={activeTab === 'results' ? 'default' : 'outline'} 
            onClick={() => setActiveTab('results')}
            className={activeTab === 'results' ? 'bg-blue-600 hover:bg-blue-700' : ''}
          >
            Resultados
          </Button>
          <Button 
            variant={activeTab === 'users' ? 'default' : 'outline'} 
            onClick={() => setActiveTab('users')}
            className={activeTab === 'users' ? 'bg-blue-600 hover:bg-blue-700' : ''}
          >
            Usuarios
          </Button>
          <Button 
            variant={activeTab === 'reports' ? 'default' : 'outline'} 
            onClick={() => setActiveTab('reports')}
            className={activeTab === 'reports' ? 'bg-blue-600 hover:bg-blue-700' : ''}
          >
            Reportes
          </Button>
          <Button 
            variant={activeTab === 'companies' ? 'default' : 'outline'} 
            onClick={() => setActiveTab('companies')}
            className={activeTab === 'companies' ? 'bg-blue-600 hover:bg-blue-700' : ''}
          >
            Empresas
          </Button>
          <Button 
            variant={activeTab === 'analytics' ? 'default' : 'outline'} 
            onClick={() => setActiveTab('analytics')}
            className={activeTab === 'analytics' ? 'bg-blue-600 hover:bg-blue-700' : ''}
          >
            Estadísticas
          </Button>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-md flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-6 pt-4 pb-12">
          <h2 className="text-2xl font-bold text-indigo-700 border-b border-indigo-200 pb-2 flex items-center gap-2">
            <Calculator className="w-6 h-6" /> Estadísticas del Sitio
          </h2>
          <p className="text-sm text-gray-600 mb-4">Resumen rápido de la actividad en El Prode de Beno.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Usuarios Registrados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">{analytics.totalUsers}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Usuarios Activos Hoy</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">{analytics.activeToday}</div>
                <p className="text-xs text-gray-500 mt-1">Iniciaron sesión hoy</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Predicciones Guardadas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{analytics.totalPredictions}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Tasa de Participación</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600">
                  {analytics.totalUsers > 0 ? Math.round((analytics.usersWithPredictions / analytics.totalUsers) * 100) : 0}%
                </div>
                <p className="text-xs text-gray-500 mt-1">Usuarios con predicciones</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'companies' && (
        <div className="space-y-6 pt-4 pb-12">
          <h2 className="text-2xl font-bold text-blue-900 border-b border-blue-200 pb-2 flex items-center gap-2">
            <Building2 className="w-6 h-6" /> Gestión de Empresas
          </h2>
          <p className="text-sm text-gray-600 mb-4">Creá nuevas empresas y asigná a los administradores de RRHH. Solo vos podés dar de alta nuevas empresas.</p>
          
          <Card className="mb-8">
            <CardHeader className="bg-blue-50 border-b">
              <CardTitle className="text-lg text-blue-900">Dar de alta nueva empresa</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={createCompany} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la empresa</label>
                    <input
                      type="text"
                      required
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                      placeholder="Ej: Globant"
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Emails de Administradores (RRHH)</label>
                    <input
                      type="text"
                      required
                      value={newCompanyHREmail}
                      onChange={(e) => setNewCompanyHREmail(e.target.value)}
                      placeholder="rrhh1@empresa.com, rrhh2@empresa.com"
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Separados por coma si son varios</p>
                  </div>
                  
                  <div className="md:col-span-2 border-t pt-4 mt-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Plan de la Empresa</label>
                    <div className="flex gap-4">
                      <label className={`flex-1 border rounded-lg p-4 cursor-pointer transition-colors ${newCompanyPlan === 'base' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                        <input type="radio" name="plan" value="base" checked={newCompanyPlan === 'base'} onChange={() => setNewCompanyPlan('base')} className="sr-only" />
                        <div className="font-bold text-gray-900">Plan Base</div>
                        <div className="text-sm text-gray-500">Ranking general, logo estándar.</div>
                      </label>
                      <label className={`flex-1 border rounded-lg p-4 cursor-pointer transition-colors ${newCompanyPlan === 'premium' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                        <input type="radio" name="plan" value="premium" checked={newCompanyPlan === 'premium'} onChange={() => setNewCompanyPlan('premium')} className="sr-only" />
                        <div className="font-bold text-purple-900 flex items-center gap-2">Plan Premium <span className="bg-purple-200 text-purple-800 text-xs px-2 py-0.5 rounded-full">Recomendado</span></div>
                        <div className="text-sm text-purple-700/80">Branding, áreas, métricas y más.</div>
                      </label>
                    </div>
                  </div>

                  {newCompanyPlan === 'premium' && (
                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 bg-purple-50/50 p-4 rounded-lg border border-purple-100">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Color Corporativo (Hex)</label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={newCompanyColor}
                            onChange={(e) => setNewCompanyColor(e.target.value)}
                            className="h-10 w-10 p-1 border border-gray-300 rounded-md cursor-pointer"
                          />
                          <input
                            type="text"
                            value={newCompanyColor}
                            onChange={(e) => setNewCompanyColor(e.target.value)}
                            className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Logo de la Empresa (Opcional)</label>
                        <div className="flex items-center gap-4">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                          />
                          {newCompanyLogo && (
                            <img src={newCompanyLogo} alt="Preview" className="h-10 w-10 object-contain border rounded" />
                          )}
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Áreas / Sucursales (Opcional)</label>
                        <input
                          type="text"
                          value={newCompanyAreas}
                          onChange={(e) => setNewCompanyAreas(e.target.value)}
                          placeholder="Ventas, IT, Logística, Sucursal Centro"
                          className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">Separadas por coma. Los usuarios elegirán una al registrarse.</p>
                      </div>
                    </div>
                  )}
                </div>
                <Button type="submit" disabled={creatingCompany} className={newCompanyPlan === 'premium' ? 'bg-purple-600 hover:bg-purple-700 w-full' : 'bg-blue-600 hover:bg-blue-700 w-full'}>
                  {creatingCompany ? 'Creando...' : 'Crear Empresa y Generar Código'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <h3 className="text-xl font-bold text-gray-900 mb-4">Empresas Registradas</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {companies.map(company => (
              <Card key={company.id} className="overflow-hidden">
                <CardHeader className={`py-3 px-4 border-b ${company.isActive === false ? 'bg-red-50' : 'bg-gray-50'}`}>
                  <CardTitle className="text-base flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className={company.isActive === false ? 'text-red-700 line-through opacity-70' : ''}>{company.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${company.plan === 'premium' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                        {company.plan === 'premium' ? 'Premium' : 'Común'}
                      </span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded font-mono border ${company.isActive === false ? 'bg-red-100 text-red-800 border-red-200' : 'bg-blue-100 text-blue-800 border-blue-200'}`}>
                      Código: {company.code}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 text-sm space-y-4">
                  <div className="space-y-2">
                    <p><span className="font-semibold text-gray-600">Admin (RRHH):</span> {company.hrEmails ? company.hrEmails.join(', ') : company.hrEmail}</p>
                    <p><span className="font-semibold text-gray-600">Creada:</span> {new Date(company.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 flex items-center gap-2"
                      onClick={() => setSelectedCompanyId(company.id)}
                    >
                      <Eye className="w-4 h-4" /> Ver Empresa
                    </Button>
                    {company.isActive === false ? (
                      <Button 
                        variant="default" 
                        size="sm" 
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                        onClick={() => setConfirmAction({ type: 'restoreCompany', companyId: company.id, name: company.name })}
                      >
                        Restaurar
                      </Button>
                    ) : (
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        className="flex items-center gap-2"
                        onClick={() => setConfirmAction({ type: 'deleteCompany', companyId: company.id, name: company.name })}
                        title="Suspender empresa"
                      >
                        <Ban className="w-4 h-4" />
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setConfirmAction({ type: 'permanentDeleteCompany', companyId: company.id, name: company.name })}
                      title="Eliminar permanentemente"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {companies.length === 0 && (
              <p className="text-gray-500 col-span-2 text-center py-8 bg-gray-50 rounded-lg border border-dashed">
                No hay empresas registradas aún.
              </p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'results' && (
        <>
          <div className="flex gap-3 w-full flex-wrap justify-center mb-6">
            <Button 
              variant="outline" 
              onClick={saveResults}
              disabled={saving}
              className="flex-1 md:flex-none flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" /> Guardar Resultados
            </Button>
            <Button 
              onClick={() => setConfirmAction({ type: 'calc' })}
              disabled={calculating}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700"
            >
              <Calculator className="w-4 h-4" /> Calcular Puntos
            </Button>
            <Button 
              variant="destructive"
              onClick={() => setConfirmAction({ type: 'reset' })}
              disabled={calculating}
              className="flex-1 md:flex-none flex items-center justify-center gap-2"
            >
              <AlertCircle className="w-4 h-4" /> Resetear Puntos
            </Button>
          </div>

          <div className="space-y-6">
        <h2 className="text-2xl font-bold text-blue-900 border-b pb-2">Resultados Fase de Grupos</h2>
        <p className="text-sm text-gray-600 mb-4">Seleccioná el orden final real de cada grupo.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.entries(actualGroups)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([groupLetter, teams]) => (
            <Card key={groupLetter} className="overflow-hidden border-t-4 border-t-indigo-600">
              <CardHeader className="bg-gray-50 py-3 px-4 border-b">
                <CardTitle className="text-lg">Grupo {groupLetter}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {[0, 1, 2, 3].map((index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className={`w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full text-xs font-bold ${
                      index === 0 ? 'bg-green-100 text-green-700' : 
                      index === 1 ? 'bg-green-50 text-green-600' : 
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {index + 1}
                    </div>
                    <select
                      className="flex-1 p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={teams[index] || ""}
                      onChange={(e) => handleGroupChange(groupLetter, index, e.target.value)}
                    >
                      <option value="">Seleccionar equipo...</option>
                      {GROUPS[groupLetter as keyof typeof GROUPS].map(team => (
                        <option key={team} value={team}>{team}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="space-y-6 pt-8 pb-12">
        <h2 className="text-2xl font-bold text-blue-900 border-b pb-2">Resultados Preguntas Especiales</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {SPECIAL_QUESTIONS.map((q) => (
            <Card key={q.id}>
              <CardContent className="p-5">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {q.label}
                </label>
                <input
                  type="text"
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  placeholder="Respuesta oficial..."
                  value={actualSpecials[q.id] || ""}
                  onChange={(e) => handleSpecialChange(q.id, e.target.value)}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="space-y-6 pt-8 pb-12 border-t border-gray-200 opacity-50">
        <h2 className="text-2xl font-bold text-blue-900 border-b pb-2">Resultados Fase Eliminatoria</h2>
        <div className="bg-gray-100 p-8 rounded-lg text-center border-2 border-dashed border-gray-300">
          <p className="text-gray-600 font-medium">Cuadro por definir</p>
          <p className="text-sm text-gray-500 mt-2">Esta sección se habilitará una vez finalizada la fase de grupos.</p>
        </div>
      </div>
      </>
      )}

      {activeTab === 'users' && (
      <div className="space-y-6 pt-4 pb-12">
        <h2 className="text-2xl font-bold text-red-700 border-b border-red-200 pb-2 flex items-center gap-2">
          <Users className="w-6 h-6" /> Gestión de Usuarios
        </h2>
        <p className="text-sm text-gray-600 mb-4">Administrá los participantes del Prode. Podés eliminar cuentas si alguien se arrepiente de jugar.</p>
        
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3">Usuario</th>
                    <th className="px-6 py-3">Email</th>
                    <th className="px-6 py-3">Rol</th>
                    <th className="px-6 py-3">Puntos</th>
                    <th className="px-6 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.uid} className="bg-white border-b hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-3">
                        {u.photoURL ? (
                          <img src={u.photoURL} alt={u.displayName} className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                            {u.displayName?.charAt(0) || "U"}
                          </div>
                        )}
                        {u.displayName}
                      </td>
                      <td className="px-6 py-4 text-gray-600">{u.email}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold">{u.totalPoints}</td>
                      <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                        {Date.now() < new Date('2026-06-08T00:00:00').getTime() && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => unfixPredictions(u.uid, u.displayName)}
                            className="flex items-center gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                            title="Permitir al usuario volver a editar sus predicciones"
                          >
                            <Unlock className="w-4 h-4" /> Desfijar
                          </Button>
                        )}
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          onClick={() => setConfirmAction({ type: 'delete', uid: u.uid, name: u.displayName })}
                          disabled={u.role === 'admin'} // Prevent deleting other admins or self easily
                          className="flex items-center gap-1"
                        >
                          <Trash2 className="w-4 h-4" /> Eliminar
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                        No hay usuarios registrados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
      )}

      {activeTab === 'reports' && (
      <div className="space-y-6 pt-4 pb-12">
        <h2 className="text-2xl font-bold text-orange-700 border-b border-orange-200 pb-2 flex items-center gap-2">
          <MessageSquareWarning className="w-6 h-6" /> Reportes y Sugerencias
        </h2>
        <p className="text-sm text-gray-600 mb-4">Revisá los reportes enviados por los usuarios. Podés ver los archivos adjuntos haciendo clic en los enlaces.</p>
        
        <div className="space-y-4">
          {reports.length === 0 ? (
            <div className="bg-gray-50 p-8 rounded-lg text-center border border-gray-200">
              <p className="text-gray-500">No hay reportes nuevos.</p>
            </div>
          ) : (
            reports.map((report) => (
              <Card key={report.id} className="overflow-hidden border-l-4 border-l-orange-500">
                <CardHeader className="bg-gray-50 py-3 px-4 border-b flex flex-row justify-between items-start">
                  <div>
                    <CardTitle className="text-base font-bold text-gray-900">{report.userName || "Usuario Anónimo"}</CardTitle>
                    <p className="text-xs text-gray-500">{report.userEmail || "Sin email"} • {new Date(report.createdAt).toLocaleString()}</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => deleteReport(report.id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 px-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="text-gray-700 whitespace-pre-wrap text-sm">
                    {report.message}
                  </div>
                  
                  {report.attachments && report.attachments.length > 0 && (
                    <div className="pt-3 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                        <Paperclip className="w-3 h-3" /> Archivos adjuntos ({report.attachments.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {report.attachments.map((url, i) => (
                          <a 
                            key={i} 
                            href={url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors"
                          >
                            Ver archivo {i + 1}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {confirmAction.type === 'calc' ? '¿Recalcular puntos?' : 
               confirmAction.type === 'reset' ? '¿Resetear todos los puntos a 0?' : 
               confirmAction.type === 'deleteCompany' ? '¿Eliminar empresa?' :
               confirmAction.type === 'restoreCompany' ? '¿Restaurar empresa?' :
               '¿Eliminar usuario?'}
            </h3>
            <p className="text-gray-600 mb-6">
              {confirmAction.type === 'calc' 
                ? 'Esto va a recalcular los puntos de todos los usuarios basándose en los resultados oficiales guardados. Puede tomar unos segundos.' 
                : confirmAction.type === 'reset'
                ? 'Esto va a poner los puntos de TODOS los usuarios en 0. Usá esta opción solo si estás probando o antes de que comience el torneo real. No se puede deshacer.'
                : confirmAction.type === 'deleteCompany'
                ? `¿Estás seguro de suspender la empresa ${confirmAction.name}? Los usuarios vinculados perderán el acceso hasta que ingresen un nuevo código, pero sus datos se conservarán.`
                : confirmAction.type === 'restoreCompany'
                ? `¿Estás seguro de restaurar la empresa ${confirmAction.name}? Los usuarios que no se hayan unido a otra empresa recuperarán su acceso automáticamente.`
                : confirmAction.type === 'permanentDeleteCompany'
                ? `Estás a punto de eliminar PERMANENTEMENTE la empresa ${confirmAction.name}. Esta acción NO se puede deshacer.`
                : `¿Estás seguro de eliminar al usuario ${confirmAction.name}? Esta acción va a borrar su perfil y todas sus predicciones. No se puede deshacer.`}
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancelar</Button>
              <Button 
                variant={confirmAction.type === 'delete' || confirmAction.type === 'reset' || confirmAction.type === 'deleteCompany' ? 'destructive' : 'default'}
                className={confirmAction.type === 'calc' ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : ''}
                onClick={() => { 
                  if (confirmAction.type === 'calc') {
                    calculatePoints();
                  } else if (confirmAction.type === 'reset') {
                    resetPoints();
                  } else if (confirmAction.type === 'delete' && confirmAction.uid && confirmAction.name) {
                    deleteUser(confirmAction.uid, confirmAction.name);
                  } else if (confirmAction.type === 'deleteCompany' && confirmAction.companyId && confirmAction.name) {
                    setDoc(doc(db, "companies", confirmAction.companyId), { isActive: false }, { merge: true })
                      .then(() => {
                        setCompanies(companies.map(c => c.id === confirmAction.companyId ? { ...c, isActive: false } : c));
                        setMessage({ type: 'success', text: `Empresa ${confirmAction.name} dada de baja.` });
                        setTimeout(() => setMessage(null), 5000);
                      })
                      .catch(err => {
                        console.error("Error deleting company:", err);
                        setMessage({ type: 'error', text: 'Error al dar de baja la empresa.' });
                        setTimeout(() => setMessage(null), 5000);
                      });
                  } else if (confirmAction.type === 'restoreCompany' && confirmAction.companyId && confirmAction.name) {
                    setDoc(doc(db, "companies", confirmAction.companyId), { isActive: true }, { merge: true })
                      .then(() => {
                        setCompanies(companies.map(c => c.id === confirmAction.companyId ? { ...c, isActive: true } : c));
                        setMessage({ type: 'success', text: `Empresa ${confirmAction.name} restaurada.` });
                        setTimeout(() => setMessage(null), 5000);
                      })
                      .catch(err => {
                        console.error("Error restoring company:", err);
                        setMessage({ type: 'error', text: 'Error al restaurar la empresa.' });
                        setTimeout(() => setMessage(null), 5000);
                      });
                  } else if (confirmAction.type === 'permanentDeleteCompany' && confirmAction.companyId && confirmAction.name) {
                    deleteCompany(confirmAction.companyId, confirmAction.name);
                  }
                  setConfirmAction(null); 
                }}
              >
                {confirmAction.type === 'calc' ? 'Sí, recalcular' : 
                 confirmAction.type === 'reset' ? 'Sí, resetear a 0' : 
                 confirmAction.type === 'deleteCompany' ? 'Sí, suspender' :
                 confirmAction.type === 'restoreCompany' ? 'Sí, restaurar' :
                 confirmAction.type === 'permanentDeleteCompany' ? 'Sí, eliminar permanentemente' :
                 'Sí, eliminar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
