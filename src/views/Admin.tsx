"use client";
import React, { useState, useEffect } from "react";
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, writeBatch, query, orderBy, where } from "firebase/firestore";
import { db, auth } from "../firebase";
import { GROUPS, SPECIAL_QUESTIONS, KNOCKOUT_STAGES, ALL_TEAMS } from "../data";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Save, Calculator, AlertCircle, CheckCircle2, Trash2, Users, MessageSquareWarning, Paperclip, Unlock, Building2, Eye, Ban, PenSquare, Calendar } from "lucide-react";
import { CountdownBanner } from "../components/CountdownBanner";
import CompanyAdmin from "./CompanyAdmin";
import { useAppContext } from "../components/Providers";
import { useRouter } from "next/navigation";
import { useLanguage } from "../i18n/LanguageContext";
import { isSpecialCorrect } from "../lib/specials";
import { BRACKET_TREE } from "../lib/bracket/tree";
import { propagateWinners } from "../lib/bracket/propagate";
import { buildDisplayBracket } from "../lib/bracket/displayBracket";
import { buildManualKoSchedule, KO_KICKOFFS } from "../lib/bracket/manualBracket";

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
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{type: 'calc' | 'delete' | 'reset' | 'deleteCompany' | 'restoreCompany' | 'permanentDeleteCompany', uid?: string, name?: string, companyId?: string} | null>(null);
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const { setPreviewCompanyId } = useAppContext();
  const router = useRouter();
  
  // Tournament Config State

  // State for actual results
  const [actualGroups, setActualGroups] = useState<Record<string, string[]>>(GROUPS);
  const [actualSpecials, setActualSpecials] = useState<Record<string, string>>({});
  const [actualKnockouts, setActualKnockouts] = useState<Record<string, any>>({});
  const [actualMatches, setActualMatches] = useState<Record<string, {home: string, away: string}>>({});
  const [bracketMatchups, setBracketMatchups] = useState<Record<string, [string, string]>>({});
  const [savingSlot, setSavingSlot] = useState<string | null>(null);
  const [savedSlot, setSavedSlot] = useState<string | null>(null);
  const [koPicks, setKoPicks] = useState<Record<string, string>>({});

  const flashSaved = (id: string) => {
    setSavedSlot(id);
    setTimeout(() => setSavedSlot(prev => (prev === id ? null : prev)), 2500);
  };
  
  // State for users
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [editingUser, setEditingUser] = useState<{uid: string, currentName: string, newName: string} | null>(null);
  const [savingName, setSavingName] = useState(false);
  
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
  const [newCompanySingleTournament, setNewCompanySingleTournament] = useState(false);
  const [creatingCompany, setCreatingCompany] = useState(false);
  
  const [editCompanyModal, setEditCompanyModal] = useState<any | null>(null);
  const [editCompanyHREmails, setEditCompanyHREmails] = useState("");
  const [editCompanyColor, setEditCompanyColor] = useState("");
  const [editCompanyLogo, setEditCompanyLogo] = useState("");
  const [editCompanySingleTournament, setEditCompanySingleTournament] = useState(false);
  const [editCompanyAreas, setEditCompanyAreas] = useState("");
  const [editCompanyInvertActiveButton, setEditCompanyInvertActiveButton] = useState(false);
  const [editCompanyInvertColors, setEditCompanyInvertColors] = useState(false);

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
          setActualMatches(data.matches || {});
          setBracketMatchups(data.bracketMatchups || {});
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

  const saveSpecialAnswer = async (qId: string) => {
    setSavingSlot(`special-${qId}`);
    setMessage(null);
    try {
      await setDoc(doc(db, "results", "actual"),
        { specials: { ...actualSpecials, [qId]: actualSpecials[qId] || "" }, updatedAt: new Date().toISOString() },
        { merge: true });
      setSavingSlot(null);
      flashSaved(`special-${qId}`);
      setMessage({ type: 'success', text: 'Respuesta guardada. Recalculando puntos...' });
      triggerRecalc()
        .then(() => setMessage({ type: 'success', text: 'Respuesta guardada. Puntos actualizados.' }))
        .catch(() => setMessage({ type: 'success', text: 'Respuesta guardada. El recálculo se completará en el próximo ciclo.' }))
        .finally(() => setTimeout(() => setMessage(null), 5000));
    } catch (error) {
      console.error("Error saving special answer:", error);
      setSavingSlot(null);
      setMessage({ type: 'error', text: 'Error al guardar la respuesta.' });
      setTimeout(() => setMessage(null), 5000);
    }
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
        matches: actualMatches,
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

  // Dispara el recálculo de puntos en el servidor (autenticado con el ID token del
  // admin logueado). Acopla el Guardar con la actualización de puntos: no espera al cron.
  const triggerRecalc = async () => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;
    await fetch("/api/recalculate", { headers: { Authorization: `Bearer ${token}` } });
  };

  const saveKnockoutWinner = async (slotId: string, winner: string) => {
    setSavingSlot(slotId);
    setMessage(null);
    try {
      const newKnockouts = { ...actualKnockouts, [slotId]: winner };
      // Propagar para armar la ronda siguiente y reconstruir el calendario KO.
      const newMatchups = propagateWinners({ ...bracketMatchups }, newKnockouts as Record<string, string>);
      const koSchedule = buildManualKoSchedule(newMatchups, KO_KICKOFFS);

      await setDoc(doc(db, "results", "actual"), {
        knockouts: newKnockouts,
        bracketMatchups: newMatchups,
        koSchedule,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      setActualKnockouts(newKnockouts);
      setBracketMatchups(newMatchups);
      // Confirmación inmediata (no espera al recálculo, que corre en segundo plano).
      setSavingSlot(null);
      flashSaved(slotId);
      setMessage({ type: 'success', text: `Ganador guardado: ${winner}. Recalculando puntos...` });
      triggerRecalc()
        .then(() => setMessage({ type: 'success', text: `Ganador guardado: ${winner}. Puntos actualizados.` }))
        .catch(() => setMessage({ type: 'success', text: `Ganador guardado: ${winner}. El recálculo se completará en el próximo ciclo.` }))
        .finally(() => setTimeout(() => setMessage(null), 5000));
    } catch (error) {
      console.error("Error saving knockout winner:", error);
      setSavingSlot(null);
      setMessage({ type: 'error', text: 'Error al guardar el ganador del cruce.' });
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const saveAreaStats = async (usersSnap: Awaited<ReturnType<typeof getDocs>>) => {
    const companyUserStats: Record<string, Record<string, { totalPoints: number, count: number }>> = {};
    usersSnap.docs.forEach(d => {
      const u = d.data();
      if (u.companyId && u.area) {
        const cid = u.companyId;
        const area = u.area;
        if (!companyUserStats[cid]) companyUserStats[cid] = {};
        if (!companyUserStats[cid][area]) companyUserStats[cid][area] = { totalPoints: 0, count: 0 };
        companyUserStats[cid][area].totalPoints += u.totalPoints || 0;
        companyUserStats[cid][area].count += 1;
      }
    });
    for (const [cid, areas] of Object.entries(companyUserStats)) {
      const areaStats = Object.entries(areas)
        .map(([name, stat]) => ({ name, average: Math.round(stat.totalPoints / stat.count), count: stat.count }))
        .sort((a, b) => b.average - a.average);
      await setDoc(doc(db, "companies", cid), { areaStats, statsUpdatedAt: new Date().toISOString() }, { merge: true });
    }
  };

  const refreshAreaStats = async () => {
    setCalculating(true);
    setMessage(null);
    try {
      const allUsersSnap = await getDocs(collection(db, "users"));
      await saveAreaStats(allUsersSnap);
      setMessage({ type: 'success', text: 'Estadísticas de áreas actualizadas con éxito.' });
    } catch (error: any) {
      console.error("Error refreshing stats:", error);
      setMessage({ type: 'error', text: 'Error al actualizar estadísticas.' });
    } finally {
      setCalculating(false);
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
        throw new Error(t.admin.noResultsSaved);
      }
      const actualData = resultsSnap.data();
      
      // Only score groups explicitly marked as finished (all 12 matches played).
      const finishedGroups: string[] = actualData.finishedGroups || [];
      const rawGroups: Record<string, string[]> = actualData.groups ?? {};
      const actualG: Record<string, string[]> = {};
      for (const letter of finishedGroups) {
        if (rawGroups[letter]) actualG[letter] = rawGroups[letter];
      }
      const actualS = actualData.specials || {};
      const actualK = actualData.knockouts || {};
      const actualM = actualData.matches || {};

      // 2. Fetch all predictions
      const predictionsSnap = await getDocs(collection(db, "predictions"));
      const predictions = predictionsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

      // Fetch all users to ensure we only update existing ones
      const usersSnapCheck = await getDocs(collection(db, "users"));
      const existingUserPoints = new Map<string, number>();
      usersSnapCheck.docs.forEach(d => {
        const uData = d.data();
        existingUserPoints.set(d.id, typeof uData.totalPoints === 'number' ? uData.totalPoints : -1);
      });

      // 3. Prepare chunked batch updates for users (max 500 per batch, using 450 to be safe)
      const chunks = [];
      for (let i = 0; i < predictions.length; i += 450) {
        chunks.push(predictions.slice(i, i + 450));
      }
      
      let totalWrites = 0;
      
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        let batchHasWrites = false;
        
        for (const pred of chunk) {
          if (!existingUserPoints.has(pred.id)) continue; 
          
          let totalPoints = 0;
          const pGroups = pred.groups || {};
          
          const sanitizedPGroups: Record<string, string[]> = {};
          for (const [groupLetter, currentTeams] of Object.entries(GROUPS)) {
            const savedTeams = pGroups[groupLetter] || [];
            const validSavedTeams = (savedTeams as string[]).filter(t => currentTeams.includes(t));
            const missingTeams = currentTeams.filter(t => !validSavedTeams.includes(t));
            sanitizedPGroups[groupLetter] = [...validSavedTeams, ...missingTeams];
          }

          const pSpecials = pred.specials || {};

          for (const [groupLetter, actualTeams] of Object.entries(actualG)) {
            const predictedTeams = sanitizedPGroups[groupLetter];
            if (!predictedTeams || !Array.isArray(actualTeams)) continue;

            let exactMatches = 0;
            for (let i = 0; i < 4; i++) {
              if (actualTeams[i] && predictedTeams[i] === actualTeams[i]) {
                exactMatches++;
                totalPoints += 1;
              }
            }
            if (exactMatches === 4) totalPoints += 3;
          }

          for (const [qId, actualAnswer] of Object.entries(actualS)) {
            if (isSpecialCorrect(pSpecials[qId], actualAnswer)) {
              totalPoints += 10;
            }
          }

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

          const pMatches = pred.matches || {};
          for (const [matchId, actualMatch] of Object.entries(actualM) as [string, any][]) {
            const predictedMatch = pMatches[matchId];
            if (!predictedMatch || !actualMatch) continue;
            
            const homeActual = parseInt(actualMatch.home);
            const awayActual = parseInt(actualMatch.away);
            const homePredicted = parseInt(predictedMatch.home);
            const awayPredicted = parseInt(predictedMatch.away);

            if (!isNaN(homeActual) && !isNaN(awayActual) && !isNaN(homePredicted) && !isNaN(awayPredicted)) {
              if (homeActual === homePredicted && awayActual === awayPredicted) {
                totalPoints += 2;
              } else {
                const actualDiff = homeActual - awayActual;
                const predictedDiff = homePredicted - awayPredicted;
                
                const actualOutcome = actualDiff > 0 ? 'home' : actualDiff < 0 ? 'away' : 'draw';
                const predictedOutcome = predictedDiff > 0 ? 'home' : predictedDiff < 0 ? 'away' : 'draw';
                
                if (actualOutcome === predictedOutcome) {
                  totalPoints += 1;
                }
              }
            }
          }

          const currentPoints = existingUserPoints.get(pred.id);
          if (currentPoints === totalPoints) continue;

          const userRef = doc(db, "users", pred.id);
          batch.set(userRef, { totalPoints }, { merge: true });
          batchHasWrites = true;
          totalWrites++;
        }
        if (batchHasWrites) {
          await batch.commit();
        }
      }

      // 4. Re-fetch users to get updated totalPoints, then compute area stats
      const updatedUsersSnap = await getDocs(collection(db, "users"));
      await saveAreaStats(updatedUsersSnap);

      setMessage({ type: 'success', text: 'Puntos calculados y estadísticas de áreas actualizadas con éxito.' });
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

  const handleRenameUser = async () => {
    if (!editingUser || !editingUser.newName.trim()) return;
    setSavingName(true);
    try {
      await setDoc(doc(db, "users", editingUser.uid), { displayName: editingUser.newName.trim() }, { merge: true });
      setUsers(users.map(u => u.uid === editingUser.uid ? { ...u, displayName: editingUser.newName.trim() } : u));
      setMessage({ type: 'success', text: `Nombre de usuario actualizado correctamente.` });
      setEditingUser(null);
    } catch (error: any) {
      console.error("Error renaming user:", error);
      setMessage({ type: 'error', text: 'Error al cambiar el nombre: ' + (error.message || '') });
    } finally {
      setSavingName(false);
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

  const processLogoFile = (file: File, onDone: (dataUrl: string) => void) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 400;
        let w = img.width;
        let h = img.height;
        if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } }
        else        { if (h > MAX) { w *= MAX / h; h = MAX; } }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
        onDone(canvas.toDataURL('image/png', 0.8));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processLogoFile(file, setNewCompanyLogo);
  };

  const handleEditLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processLogoFile(file, setEditCompanyLogo);
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
        newCompanyData.singleTournament = newCompanySingleTournament;
      }
      
      await setDoc(companyRef, newCompanyData);

      setCompanies([{ ...newCompanyData, id: companyRef.id }, ...companies]);
      setNewCompanyName("");
      setNewCompanyHREmail("");
      setNewCompanyPlan('base');
      setNewCompanyColor("#1d4ed8");
      setNewCompanyLogo("");
      setNewCompanyAreas("");
      setNewCompanySingleTournament(false);
      setMessage({ type: 'success', text: `Empresa ${newCompanyData.name} creada con código ${newCode}.` });
    } catch (error) {
      console.error("Error creating company:", error);
      setMessage({ type: 'error', text: 'Error al crear la empresa.' });
    } finally {
      setCreatingCompany(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCompanyModal) return;
    
    setCreatingCompany(true);
    try {
      const hrEmailsArray = editCompanyHREmails.split(',').map(e => e.trim().toLowerCase()).filter(e => e);
      
      const parsedAreas = editCompanyAreas.trim()
        ? editCompanyAreas.split('-').map(a => a.trim()).filter(a => a)
        : [];

      const updateData: any = {
        hrEmail: hrEmailsArray[0] || "",
        hrEmails: hrEmailsArray,
        color: editCompanyColor,
        logoUrl: editCompanyLogo,
        singleTournament: editCompanySingleTournament,
        areas: parsedAreas,
        invertActiveButton: editCompanyInvertActiveButton,
        invertColors: editCompanyInvertColors
      };
      
      await setDoc(doc(db, "companies", editCompanyModal.id), updateData, { merge: true });
      
      setCompanies(companies.map(c => 
        c.id === editCompanyModal.id 
          ? { ...c, ...updateData } 
          : c
      ));
      
      setMessage({ type: 'success', text: 'Empresa actualizada correctamente.' });
      setEditCompanyModal(null);
    } catch (error) {
      console.error("Error updating company:", error);
      setMessage({ type: 'error', text: 'Error al actualizar la empresa.' });
    } finally {
      setCreatingCompany(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  if (loading) {
    return <div className="text-center py-10">{t.admin.loading}</div>;
  }

  if (selectedCompanyId) {
    return (
      <div className="space-y-4 px-4 sm:px-6 py-6 md:py-8">
        <Button onClick={() => setSelectedCompanyId(null)} variant="outline" className="mb-2">
          {t.admin.backToAdmin}
        </Button>
        <CompanyAdmin userData={{ role: 'admin', companyId: selectedCompanyId }} hideBanner={true} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 px-4 sm:px-6 py-6 md:py-8">
      <CountdownBanner />
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t.admin.title}</h1>
          <p className="text-gray-500 mt-1">{t.admin.subtitle}</p>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto flex-wrap">
          <Button
            variant={activeTab === 'results' ? 'default' : 'outline'}
            onClick={() => setActiveTab('results')}
            className={activeTab === 'results' ? 'bg-blue-600 hover:bg-blue-700' : ''}
          >
            {t.admin.tabResults}
          </Button>
          <Button
            variant={activeTab === 'users' ? 'default' : 'outline'}
            onClick={() => setActiveTab('users')}
            className={activeTab === 'users' ? 'bg-blue-600 hover:bg-blue-700' : ''}
          >
            {t.admin.tabUsers}
          </Button>
          <Button
            variant={activeTab === 'reports' ? 'default' : 'outline'}
            onClick={() => setActiveTab('reports')}
            className={activeTab === 'reports' ? 'bg-blue-600 hover:bg-blue-700' : ''}
          >
            {t.admin.tabReports}
          </Button>
          <Button
            variant={activeTab === 'companies' ? 'default' : 'outline'}
            onClick={() => setActiveTab('companies')}
            className={activeTab === 'companies' ? 'bg-blue-600 hover:bg-blue-700' : ''}
          >
            {t.admin.tabCompanies}
          </Button>
          <Button
            variant={activeTab === 'analytics' ? 'default' : 'outline'}
            onClick={() => setActiveTab('analytics')}
            className={activeTab === 'analytics' ? 'bg-blue-600 hover:bg-blue-700' : ''}
          >
            {t.admin.tabAnalytics}
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
            <Calculator className="w-6 h-6" /> {t.admin.analyticsTitle}
          </h2>
          <p className="text-sm text-gray-600 mb-4">{t.admin.analyticsSubtitle}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">{t.admin.statUsers}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">{analytics.totalUsers}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">{t.admin.statActiveToday}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">{analytics.activeToday}</div>
                <p className="text-xs text-gray-500 mt-1">{t.admin.statActiveSubtitle}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">{t.admin.statPredictions}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{analytics.totalPredictions}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">{t.admin.statRate}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600">
                  {analytics.totalUsers > 0 ? Math.round((analytics.usersWithPredictions / analytics.totalUsers) * 100) : 0}%
                </div>
                <p className="text-xs text-gray-500 mt-1">{t.admin.statRateSubtitle}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'companies' && (
        <div className="space-y-6 pt-4 pb-12">
          <h2 className="text-2xl font-bold text-blue-900 border-b border-blue-200 pb-2 flex items-center gap-2">
            <Building2 className="w-6 h-6" /> {t.admin.companiesTitle}
          </h2>
          <p className="text-sm text-gray-600 mb-4">{t.admin.companiesSubtitle}</p>

          <Card className="mb-8">
            <CardHeader className="bg-blue-50 border-b">
              <CardTitle className="text-lg text-blue-900">{t.admin.newCompanyTitle}</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={createCompany} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.admin.fieldCompanyName}</label>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.admin.fieldHREmails}</label>
                    <input
                      type="text"
                      required
                      value={newCompanyHREmail}
                      onChange={(e) => setNewCompanyHREmail(e.target.value)}
                      placeholder="rrhh1@empresa.com, rrhh2@empresa.com"
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">{t.admin.fieldHREmailsHint}</p>
                  </div>

                  <div className="md:col-span-2 border-t pt-4 mt-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t.admin.planTitle}</label>
                    <div className="flex gap-4">
                      <label className={`flex-1 border rounded-lg p-4 cursor-pointer transition-colors ${newCompanyPlan === 'base' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                        <input type="radio" name="plan" value="base" checked={newCompanyPlan === 'base'} onChange={() => setNewCompanyPlan('base')} className="sr-only" />
                        <div className="font-bold text-gray-900">{t.admin.planBase}</div>
                        <div className="text-sm text-gray-500">{t.admin.planBaseDesc}</div>
                      </label>
                      <label className={`flex-1 border rounded-lg p-4 cursor-pointer transition-colors ${newCompanyPlan === 'premium' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                        <input type="radio" name="plan" value="premium" checked={newCompanyPlan === 'premium'} onChange={() => setNewCompanyPlan('premium')} className="sr-only" />
                        <div className="font-bold text-purple-900 flex items-center gap-2">{t.admin.planPremium} <span className="bg-purple-200 text-purple-800 text-xs px-2 py-0.5 rounded-full">{t.admin.planPremiumBadge}</span></div>
                        <div className="text-sm text-purple-700/80">{t.admin.planPremiumDesc}</div>
                      </label>
                    </div>
                  </div>

                  {newCompanyPlan === 'premium' && (
                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 bg-purple-50/50 p-4 rounded-lg border border-purple-100">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t.admin.colorLabel}</label>
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t.admin.logoLabel}</label>
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t.admin.areasLabel}</label>
                        <input
                          type="text"
                          value={newCompanyAreas}
                          onChange={(e) => setNewCompanyAreas(e.target.value)}
                          placeholder={t.admin.areasPlaceholder}
                          className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">{t.admin.areasHint}</p>
                      </div>
                      <div className="md:col-span-2 border-t pt-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newCompanySingleTournament}
                            onChange={(e) => setNewCompanySingleTournament(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                          <span className="text-sm font-medium text-gray-700">{t.admin.singleTournament}</span>
                        </label>
                        <p className="text-xs text-gray-500 mt-1 ml-6">{t.admin.singleTournamentHint}</p>
                      </div>
                    </div>
                  )}
                </div>
                <Button type="submit" disabled={creatingCompany} className={newCompanyPlan === 'premium' ? 'bg-purple-600 hover:bg-purple-700 w-full' : 'bg-blue-600 hover:bg-blue-700 w-full'}>
                  {creatingCompany ? t.admin.creating : t.admin.createBtn}
                </Button>
              </form>
            </CardContent>
          </Card>

          <h3 className="text-xl font-bold text-gray-900 mb-4">{t.admin.registeredCompanies}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {companies.map(company => (
              <Card key={company.id} className="overflow-hidden">
                <CardHeader className={`py-3 px-4 border-b ${company.isActive === false ? 'bg-red-50' : 'bg-gray-50'}`}>
                  <CardTitle className="text-base flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className={company.isActive === false ? 'text-red-700 line-through opacity-70' : ''}>{company.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${company.plan === 'premium' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                        {company.plan === 'premium' ? 'Premium' : t.admin.common}
                      </span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded font-mono border ${company.isActive === false ? 'bg-red-100 text-red-800 border-red-200' : 'bg-blue-100 text-blue-800 border-blue-200'}`}>
                      {t.admin.code} {company.code}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 text-sm space-y-4">
                  <div className="space-y-2">
                    <p><span className="font-semibold text-gray-600">{t.admin.fieldHRAdmin}</span> {company.hrEmails ? company.hrEmails.join(', ') : company.hrEmail}</p>
                    <p><span className="font-semibold text-gray-600">{t.admin.fieldCreated}</span> {new Date(company.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 flex items-center gap-2"
                      onClick={() => setSelectedCompanyId(company.id)}
                    >
                      <Eye className="w-4 h-4" /> {t.admin.btnHRPanel}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 flex items-center gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                      onClick={() => {
                        setPreviewCompanyId(company.id);
                        router.push("/dashboard");
                      }}
                    >
                      <Eye className="w-4 h-4" /> {t.admin.btnPlayerView}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                      onClick={() => {
                        setEditCompanyModal(company);
                        setEditCompanyHREmails(company.hrEmails ? company.hrEmails.join(', ') : company.hrEmail || "");
                        setEditCompanyColor(company.color || "#1d4ed8");
                        setEditCompanyLogo(company.logoUrl || "");
                        setEditCompanySingleTournament(company.singleTournament || false);
                        setEditCompanyAreas(company.areas ? company.areas.join(' - ') : "");
                        setEditCompanyInvertActiveButton(company.invertActiveButton || false);
                        setEditCompanyInvertColors(company.invertColors || false);
                      }}
                    >
                      <PenSquare className="w-4 h-4" /> {t.admin.btnEdit}
                    </Button>
                    {company.isActive === false ? (
                      <Button
                        variant="default"
                        size="sm"
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                        onClick={() => setConfirmAction({ type: 'restoreCompany', companyId: company.id, name: company.name })}
                      >
                        {t.admin.btnRestore}
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
                {t.admin.noCompanies}
              </p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'results' && (
        <>
          <div className="space-y-6 pt-4 pb-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
              <div>
                <h2 className="text-2xl font-bold text-indigo-900 flex items-center gap-2">
                  <Calendar className="w-6 h-6" /> {t.admin.resultsTitle}
                </h2>
                <p className="text-sm text-gray-600">{t.admin.resultsSubtitle}</p>
              </div>
            </div>

            <div className="flex gap-2 w-full flex-wrap">
              <Button 
                variant="outline" 
                onClick={saveResults}
                disabled={saving}
                className="flex-1 md:flex-none flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" /> {t.admin.saveResults}
              </Button>
              <Button
                onClick={() => setConfirmAction({ type: 'calc' })}
                disabled={calculating}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 font-bold"
              >
                <Calculator className="w-4 h-4" /> {t.admin.calculatePoints}
              </Button>
              <Button
                onClick={refreshAreaStats}
                disabled={calculating}
                variant="outline"
                className="flex-1 md:flex-none flex items-center justify-center gap-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-bold"
              >
                <Building2 className="w-4 h-4" /> {t.admin.updateAreaStats}
              </Button>
              <Button
                variant="destructive"
                onClick={() => setConfirmAction({ type: 'reset' })}
                disabled={calculating}
                className="flex-1 md:flex-none flex items-center justify-center gap-2"
              >
                <AlertCircle className="w-4 h-4" /> {t.admin.resetAll}
              </Button>
            </div>
          </div>

          <div className="space-y-6">
        <h2 className="text-2xl font-bold text-blue-900 border-b pb-2">{t.admin.groupResultsTitle}</h2>
        <p className="text-sm text-gray-600 mb-4">{t.admin.groupResultsDesc}</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.entries(actualGroups)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([groupLetter, teams]) => (
            <Card key={groupLetter} className="overflow-hidden border-t-4 border-t-indigo-600">
              <CardHeader className="bg-gray-50 py-3 px-4 border-b">
                <CardTitle className="text-lg">{t.admin.group} {groupLetter}</CardTitle>
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
                      <option value="">{t.admin.selectTeam}</option>
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
        <h2 className="text-2xl font-bold text-blue-900 border-b pb-2">{t.admin.specialResultsTitle}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {SPECIAL_QUESTIONS.map((q) => (
            <Card key={q.id}>
              <CardContent className="p-5 space-y-3">
                <label className="block text-sm font-semibold text-gray-700">
                  {(t.specialQuestions as Record<string, string>)[q.id] || q.label}
                </label>
                <input
                  type="text"
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  placeholder="Respuesta(s) correcta(s), separadas por coma"
                  value={actualSpecials[q.id] || ""}
                  onChange={(e) => handleSpecialChange(q.id, e.target.value)}
                />
                <p className="text-xs text-gray-500">
                  Podés poner más de una respuesta correcta separándolas por coma (ej: Messi, Mbappé).
                </p>
                <Button
                  variant={savedSlot === `special-${q.id}` ? "default" : "outline"}
                  size="sm"
                  onClick={() => saveSpecialAnswer(q.id)}
                  disabled={savingSlot === `special-${q.id}`}
                  className={`flex items-center gap-2 transition-all active:scale-95 ${savedSlot === `special-${q.id}` ? "bg-green-600 hover:bg-green-700 text-white" : ""}`}
                >
                  {savedSlot === `special-${q.id}` ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  {savingSlot === `special-${q.id}` ? "Guardando..." : savedSlot === `special-${q.id}` ? "¡Guardado!" : "Guardar respuesta"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="space-y-6 pt-8 pb-12 border-t border-gray-200">
        <h2 className="text-2xl font-bold text-blue-900 border-b pb-2">Eliminatoria</h2>
        <p className="text-sm text-gray-600 mb-4">
          Elegí el ganador de cada cruce y guardalo. Al guardar se arma la ronda siguiente
          y, en ~1 minuto, el sistema reparte los puntos automáticamente.
        </p>
        {(() => {
          const seedR32: Record<string, [string, string]> = {};
          for (const [id, pair] of Object.entries(bracketMatchups)) {
            if (id.startsWith("R32-")) seedR32[id] = pair;
          }
          const view = buildDisplayBracket(seedR32, {}, actualKnockouts as Record<string, string>);
          const rounds: { round: string; label: string }[] = [
            { round: "R32", label: "16avos" },
            { round: "R16", label: "Octavos" },
            { round: "QF", label: "Cuartos" },
            { round: "SF", label: "Semifinal" },
            { round: "F", label: "Final" },
          ];
          return rounds.map(({ round, label }) => {
            const slots = BRACKET_TREE.filter(s => s.round === round)
              .map(s => view[s.id])
              .filter(v => v.teamA && v.teamB);
            if (slots.length === 0) return null;
            return (
              <div key={round} className="space-y-3">
                <h3 className="text-lg font-bold text-gray-800">{label}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {slots.map(v => {
                    const winner = actualKnockouts[v.id];
                    const selected = koPicks[v.id] ?? winner;
                    const canSave = selected != null && selected !== winner;
                    const saved = savedSlot === v.id;
                    return (
                      <Card key={v.id} className={saved ? "ring-2 ring-green-400 transition-all" : "transition-all"}>
                        <CardContent className="p-4 space-y-3">
                          <div className="flex gap-2">
                            {[v.teamA!, v.teamB!].map(team => (
                              <Button
                                key={team}
                                variant={selected === team ? "default" : "outline"}
                                onClick={() => setKoPicks(prev => ({ ...prev, [v.id]: team }))}
                                disabled={savingSlot === v.id}
                                className={`flex-1 transition-transform active:scale-95 ${selected === team ? "bg-green-600 hover:bg-green-700" : ""}`}
                              >
                                {team}
                              </Button>
                            ))}
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            {winner ? (
                              <p className="text-xs text-green-700 font-medium">Ganador guardado: {winner}</p>
                            ) : <span className="text-xs text-gray-400">Sin guardar</span>}
                            <Button
                              size="sm"
                              onClick={() => saveKnockoutWinner(v.id, selected!)}
                              disabled={!canSave || savingSlot === v.id}
                              className={`flex items-center gap-2 transition-all active:scale-95 ${saved ? "bg-green-600 hover:bg-green-700" : "bg-indigo-600 hover:bg-indigo-700"}`}
                            >
                              {saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                              {savingSlot === v.id ? "Guardando..." : saved ? "¡Guardado!" : "Guardar ganador"}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          });
        })()}
      </div>
      </>
      )}

      {activeTab === 'users' && (
      <div className="space-y-6 pt-4 pb-12">
        <h2 className="text-2xl font-bold text-red-700 border-b border-red-200 pb-2 flex items-center gap-2">
          <Users className="w-6 h-6" /> {t.admin.usersTitle}
        </h2>
        <p className="text-sm text-gray-600 mb-4">{t.admin.usersSubtitle}</p>
        
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3">{t.admin.colUser}</th>
                    <th className="px-6 py-3">{t.admin.colEmail}</th>
                    <th className="px-6 py-3">{t.admin.colRole}</th>
                    <th className="px-6 py-3">{t.admin.colPoints}</th>
                    <th className="px-6 py-3 text-right">{t.admin.colActions}</th>
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
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingUser({ uid: u.uid, currentName: u.displayName, newName: u.displayName })}
                            className="flex items-center gap-1 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                            title="Editar nombre"
                          >
                            <PenSquare className="w-4 h-4" /> {t.admin.rename}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => unfixPredictions(u.uid, u.displayName)}
                            className="flex items-center gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                            title="Permitir al usuario volver a editar sus predicciones"
                          >
                            <Unlock className="w-4 h-4" /> {t.admin.unfix}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setConfirmAction({ type: 'delete', uid: u.uid, name: u.displayName })}
                            disabled={u.role === 'admin'}
                            className="flex items-center gap-1"
                          >
                            <Trash2 className="w-4 h-4" /> {t.admin.delete}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                        {t.admin.noUsers}
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
          <MessageSquareWarning className="w-6 h-6" /> {t.admin.reportsTitle}
        </h2>
        <p className="text-sm text-gray-600 mb-4">{t.admin.reportsSubtitle}</p>

        <div className="space-y-4">
          {reports.length === 0 ? (
            <div className="bg-gray-50 p-8 rounded-lg text-center border border-gray-200">
              <p className="text-gray-500">{t.admin.noReports}</p>
            </div>
          ) : (
            reports.map((report) => (
              <Card key={report.id} className="overflow-hidden border-l-4 border-l-orange-500">
                <CardHeader className="bg-gray-50 py-3 px-4 border-b flex flex-row justify-between items-start">
                  <div>
                    <CardTitle className="text-base font-bold text-gray-900">{report.userName || t.admin.anonUser}</CardTitle>
                    <p className="text-xs text-gray-500">{report.userEmail || t.admin.noEmail} • {new Date(report.createdAt).toLocaleString()}</p>
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
                        <Paperclip className="w-3 h-3" /> {t.admin.attachments} ({report.attachments.length})
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
                            {t.admin.viewFile} {i + 1}
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
              {confirmAction.type === 'calc' ? t.admin.confirmCalcTitle :
               confirmAction.type === 'reset' ? t.admin.confirmResetTitle :
               confirmAction.type === 'deleteCompany' ? t.admin.confirmDeleteCompanyTitle :
               confirmAction.type === 'restoreCompany' ? t.admin.confirmRestoreCompanyTitle :
               t.admin.confirmDeleteUserTitle}
            </h3>
            <p className="text-gray-600 mb-6">
              {confirmAction.type === 'calc'
                ? t.admin.confirmCalcDesc
                : confirmAction.type === 'reset'
                ? t.admin.confirmResetDesc
                : confirmAction.type === 'deleteCompany'
                ? `¿Estás seguro de suspender la empresa ${confirmAction.name}? Los usuarios vinculados perderán el acceso hasta que ingresen un nuevo código, pero sus datos se conservarán.`
                : confirmAction.type === 'restoreCompany'
                ? `¿Estás seguro de restaurar la empresa ${confirmAction.name}? Los usuarios que no se hayan unido a otra empresa recuperarán su acceso automáticamente.`
                : confirmAction.type === 'permanentDeleteCompany'
                ? `Estás a punto de eliminar PERMANENTEMENTE la empresa ${confirmAction.name}. Esta acción NO se puede deshacer.`
                : `¿Estás seguro de eliminar al usuario ${confirmAction.name}? Esta acción va a borrar su perfil y todas sus predicciones. No se puede deshacer.`}
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setConfirmAction(null)}>{t.admin.cancel}</Button>
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
                {confirmAction.type === 'calc' ? t.admin.yesCalc :
                 confirmAction.type === 'reset' ? t.admin.yesReset :
                 confirmAction.type === 'deleteCompany' ? t.admin.yesSuspend :
                 confirmAction.type === 'restoreCompany' ? t.admin.yesRestore :
                 confirmAction.type === 'permanentDeleteCompany' ? t.admin.yesPermanentDelete :
                 t.admin.yesDelete}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Edit Company Modal */}
      {editCompanyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">{t.admin.editCompanyTitle} {editCompanyModal.name}</h3>
              <button onClick={() => setEditCompanyModal(null)} className="text-gray-400 hover:text-gray-600">
                <Trash2 className="w-5 h-5 rotate-45" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateCompany} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.admin.editHREmails}
                </label>
                <input
                  type="text"
                  value={editCompanyHREmails}
                  onChange={(e) => setEditCompanyHREmails(e.target.value)}
                  className="w-full p-2 border rounded-md"
                  placeholder="ejemplo@empresa.com, otro@empresa.com"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t.admin.editHREmailsHint}
                </p>
              </div>

              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2 font-bold">{t.admin.visualConfig}</label>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.admin.colorLabel}</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={editCompanyColor}
                        onChange={(e) => setEditCompanyColor(e.target.value)}
                        className="h-10 w-10 p-1 border border-gray-300 rounded-md cursor-pointer"
                      />
                      <input
                        type="text"
                        value={editCompanyColor}
                        onChange={(e) => setEditCompanyColor(e.target.value)}
                        className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                        placeholder="#1d4ed8"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.admin.logoLabel}</label>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleEditLogoUpload}
                          className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                      </div>
                      {editCompanyLogo && (
                        <div className="relative group">
                          <img src={editCompanyLogo} alt="Preview" className="h-12 w-12 object-contain border rounded p-1" />
                          <button 
                            type="button" 
                            onClick={() => setEditCompanyLogo("")}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editCompanySingleTournament}
                    onChange={(e) => setEditCompanySingleTournament(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="text-sm font-medium text-gray-700">{t.admin.singleTournament}</span>
                </label>
                <p className="text-xs text-gray-500 mt-1 ml-6">{t.admin.singleTournamentHint}</p>
              </div>

              <div className="border-t pt-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.admin.areasLabel}</label>
                  <input
                    type="text"
                    value={editCompanyAreas}
                    onChange={(e) => setEditCompanyAreas(e.target.value)}
                    placeholder="Ej: Ventas - Marketing - IT - Finanzas"
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">Separar áreas con " - " (guión con espacios). Dejar vacío para sin áreas.</p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editCompanyInvertActiveButton}
                    onChange={(e) => setEditCompanyInvertActiveButton(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="text-sm font-medium text-gray-700">Botón activo invertido (negro + color principal)</span>
                </label>
                <p className="text-xs text-gray-500 ml-6">Solo invierte el botón activo del nav. Ignorado si "Invertir colores" está activo.</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editCompanyInvertColors}
                    onChange={(e) => setEditCompanyInvertColors(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="text-sm font-medium text-gray-700">Invertir colores (fondo negro + tipografía del color principal)</span>
                </label>
                <p className="text-xs text-gray-500 ml-6">Invierte el esquema completo: navbar, tarjetas y botones pasan a fondo negro con el color de marca como tipografía.</p>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t">
                <Button type="button" variant="outline" onClick={() => setEditCompanyModal(null)}>
                  {t.admin.cancel}
                </Button>
                <Button type="submit" disabled={creatingCompany} className="bg-blue-600 hover:bg-blue-700">
                  {creatingCompany ? t.admin.saving : t.admin.saveChanges}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 mb-1">{t.admin.editUserTitle}</h3>
            <p className="text-gray-500 text-sm mb-5">
              {t.admin.editUserDesc}
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{t.admin.currentName}</label>
                <p className="text-gray-800 font-medium">{editingUser.currentName}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{t.admin.newName}</label>
                <input
                  type="text"
                  value={editingUser.newName}
                  onChange={(e) => setEditingUser({ ...editingUser, newName: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && handleRenameUser()}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  maxLength={50}
                  placeholder={t.admin.namePlaceholder}
                  autoFocus
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setEditingUser(null)}>{t.admin.cancel}</Button>
              <Button
                onClick={handleRenameUser}
                disabled={savingName || !editingUser.newName.trim() || editingUser.newName.trim() === editingUser.currentName}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {savingName ? t.admin.saving : t.admin.saveName}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
