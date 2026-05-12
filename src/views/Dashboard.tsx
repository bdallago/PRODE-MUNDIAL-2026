"use client";

import { useEffect, useState, useMemo } from "react";
import { User } from "firebase/auth";
import { collection, query, where, getDocs, onSnapshot, doc, orderBy, limit, startAfter, startAt, QueryDocumentSnapshot, getCountFromServer } from "firebase/firestore";
import { db } from "../firebase";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Trophy, Medal, User as UserIcon, Gift, Building2, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { CountdownBanner } from "../components/CountdownBanner";
import { UserPredictionsModal } from "../components/UserPredictionsModal";

interface Player {
  uid: string;
  displayName: string;
  photoURL: string;
  totalPoints: number;
  role?: string;
  area?: string;
}

export default function Dashboard({ user, userData, companyName, companyDetails }: { user: User, userData: any, companyName: string, companyDetails?: any }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{uid: string, name: string} | null>(null);
  const [localCompanyDetails, setLocalCompanyDetails] = useState<any>(companyDetails);
  
  // Pagination State
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot | null>(null);
  const [firstVisible, setFirstVisible] = useState<QueryDocumentSnapshot | null>(null);
  const [pageHistory, setPageHistory] = useState<QueryDocumentSnapshot[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedAreaFilter, setSelectedAreaFilter] = useState('all');
  const [totalUsers, setTotalUsers] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  const playersPerPage = 50;

  // Function to perform the search
  const performSearch = async (termToSearch: string) => {
    if (!userData?.companyId || !termToSearch.trim()) return;
    
    setIsSearching(true);
    setLeaderboardLoading(true);
    setSearchActive(true);
    try {
      const q = query(
        collection(db, "users"),
        where("companyId", "==", userData.companyId),
        orderBy("totalPoints", "desc"),
        limit(500)
      );
      const snapshot = await getDocs(q);
      const term = termToSearch.toLowerCase();
      
      const matches = snapshot.docs
        .map(d => ({ ...d.data(), uid: d.id } as Player))
        .filter(p => 
          p.role !== 'admin' && 
          p.displayName.toLowerCase().includes(term)
        );
      
      setPlayers(matches);
      setHasMore(false);
      setCurrentPage(1);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setLeaderboardLoading(false);
      setIsSearching(false);
    }
  };

  // Initial fetch function
  const fetchPlayers = async () => {
    if (!userData?.companyId) return;
    setLeaderboardLoading(true);
    try {
      const q = query(
        collection(db, "users"), 
        where("companyId", "==", userData.companyId),
        orderBy("totalPoints", "desc"),
        limit(playersPerPage)
      );
      const snapshot = await getDocs(q);
      
      const playersData = snapshot.docs
        .map((doc) => ({ ...doc.data(), uid: doc.id } as Player))
        .filter(p => p.role !== 'admin');
      
      setPlayers(playersData);
      
      if (snapshot.docs.length > 0) {
        setFirstVisible(snapshot.docs[0]);
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
        setPageHistory([snapshot.docs[0]]);
      }
      
      setHasMore(snapshot.docs.length === playersPerPage);
      setSearchActive(false);

      // Fetch actual total count for accurate pagination footer
      const countQ = query(
        collection(db, "users"), 
        where("companyId", "==", userData.companyId)
      );
      const countSnapshot = await getCountFromServer(countQ);
      setTotalUsers(countSnapshot.data().count);
    } catch (error) {
      console.error("Error fetching leaderboard", error);
    } finally {
      setLeaderboardLoading(false);
      setInitialLoading(false);
      setLoading(false);
    }
  };

  // Reset search and return to paginated list
  const clearSearch = () => {
    setSearchTerm("");
    setDebouncedSearchTerm("");
    setCurrentPage(1);
    setPageHistory([]);
    fetchPlayers();
  };

  // Debounce search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      if (searchActive) clearSearch();
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
    }, 2000);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Handle debounced search
  useEffect(() => {
    if (debouncedSearchTerm && !searchActive) {
      performSearch(debouncedSearchTerm);
    }
  }, [debouncedSearchTerm]);

  useEffect(() => {
    if (!userData?.companyId) {
      setLoading(false);
      return;
    }

    fetchPlayers();

    // Listen to company details for real-time banner updates
    const unsubscribeCompany = onSnapshot(doc(db, "companies", userData.companyId), (docSnap) => {
      if (docSnap.exists()) {
        setLocalCompanyDetails(docSnap.data());
      }
    });

    return () => {
      unsubscribeCompany();
    };
  }, [userData?.companyId]);

  const fetchNextPage = async () => {
    if (!lastVisible || !hasMore || isSearching) return;
    
    setLeaderboardLoading(true);
    try {
      const q = query(
        collection(db, "users"), 
        where("companyId", "==", userData.companyId),
        orderBy("totalPoints", "desc"),
        startAfter(lastVisible),
        limit(playersPerPage)
      );
      
      const snapshot = await getDocs(q);
      const playersData = snapshot.docs
        .map((doc) => ({ ...doc.data(), uid: doc.id } as Player))
        .filter(p => p.role !== 'admin');
        
      if (playersData.length > 0) {
        setPlayers(playersData);
        setPageHistory([...pageHistory, snapshot.docs[0]]);
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
        setCurrentPage(prev => prev + 1);
        setHasMore(snapshot.docs.length === playersPerPage);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error fetching next page", error);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  const fetchPrevPage = async () => {
    if (currentPage <= 1 || pageHistory.length < 2) return;
    
    setLeaderboardLoading(true);
    try {
      const targetPageStartDoc = pageHistory[currentPage - 2];
      
      const q = query(
        collection(db, "users"), 
        where("companyId", "==", userData.companyId),
        orderBy("totalPoints", "desc"),
        startAt(targetPageStartDoc),
        limit(playersPerPage)
      );
      
      const snapshot = await getDocs(q);
      const playersData = snapshot.docs
        .map((doc) => ({ ...doc.data(), uid: doc.id } as Player))
        .filter(p => p.role !== 'admin');
        
      setPlayers(playersData);
      setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      
      // Update page history: truncate everything after the target page
      setPageHistory(prev => prev.slice(0, currentPage - 1));
      setCurrentPage(prev => prev - 1);
      setHasMore(true); // Since we went back, there must be subsequent pages
    } catch (error) {
      console.error("Error fetching prev page", error);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  const filteredPlayers = selectedAreaFilter === 'all' 
    ? players 
    : players.filter(p => (p as any).area === selectedAreaFilter);

  const myPoints = userData?.totalPoints || 0;
  const [myRank, setMyRank] = useState<number | "-">("-");

  useEffect(() => {
    if (!userData?.companyId) return;
    const fetchRank = async () => {
      try {
        const q = query(
          collection(db, "users"),
          where("companyId", "==", userData.companyId),
          where("totalPoints", ">", myPoints)
        );
        const snapshot = await getCountFromServer(q);
        setMyRank(snapshot.data().count + 1);
      } catch (err) {
        console.error("Error fetching rank", err);
      }
    };
    fetchRank();
  }, [userData?.companyId, myPoints]);

  const isPremium = localCompanyDetails?.plan === 'premium';
  const hasAreas = isPremium && companyDetails?.areas && companyDetails.areas.length > 0 && !localCompanyDetails?.singleTournament;

  const areaStats = useMemo(() => {
    return localCompanyDetails?.areaStats || [];
  }, [localCompanyDetails?.areaStats]);

  if (initialLoading) {
    return <div className="text-center py-10">Cargando clasificación...</div>;
  }

  const totalPages = Math.ceil(totalUsers / playersPerPage) || 1;

  const renderLeaderboard = (title: string, playersList: Player[]) => {
    return (
      <Card className="border border-gray-300 shadow-md overflow-hidden border-t-4" style={{ borderTopColor: 'var(--brand-color, #2563eb)' }}>
        <div className="bg-gray-50 p-4 border-b-2 border-gray-200 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5 text-blue-600" style={{ color: 'var(--brand-color, #2563eb)' }} /> {title}
          </h3>
        </div>
        
        <CardContent className="p-0 relative">
          {leaderboardLoading && (
            <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center backdrop-blur-[1px]">
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-4 border-brand/20 border-t-brand rounded-full animate-spin"></div>
                <p className="text-xs font-bold text-brand uppercase tracking-widest">Actualizando...</p>
              </div>
            </div>
          )}
          {/* Header Controls */}
          <div className="p-4 bg-white border-b-2 border-gray-200 flex flex-col md:flex-row gap-6 justify-between items-center">
            
            {/* Left side: Icon and Buttons */}
            <div className="flex items-center gap-4 w-full md:w-auto flex-1">
              <div className="hidden md:flex w-16 h-16 bg-brand/5 border border-brand/10 rounded-xl items-center justify-center shrink-0">
                <Trophy className="w-8 h-8 text-brand/60" />
              </div>
              
              <div className="flex flex-col gap-2 w-full max-w-xs">
                <div className="flex gap-2 w-full items-center">
                  <Button 
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={fetchPrevPage}
                    disabled={currentPage === 1 || searchActive}
                    className="flex-1 h-9 bg-white border-gray-200 text-gray-700 shadow-sm hover:bg-gray-50 font-semibold"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" /> Ant.
                  </Button>
                  <div className="text-xs font-bold text-gray-400 min-w-[70px] text-center uppercase tracking-tighter">
                    {searchActive ? 'Resultados' : `Pág. ${currentPage}`}
                  </div>
                  <Button 
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={fetchNextPage}
                    disabled={!hasMore || searchActive}
                    className="flex-1 h-9 bg-white border-gray-200 text-gray-700 shadow-sm hover:bg-gray-50 font-semibold"
                  >
                    Sig. <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Right side: Search */}
            <div className="flex flex-col gap-1.5 w-full md:w-80 shrink-0 mt-4 md:mt-0">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Search className="w-3 h-3" /> Buscar Jugador
              </label>
              <div className="flex gap-2" onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}>
                <div className="relative flex-1 group">
                  <input 
                    type="text"
                    placeholder="Nombre..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        performSearch(searchTerm);
                      }
                    }}
                    className="w-full pl-3 pr-10 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none transition-all shadow-sm group-hover:border-gray-300"
                  />
                  {isSearching && (
                    <div className="absolute right-3 top-2.5">
                      <div className="w-4 h-4 border-2 border-brand/30 border-t-brand rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
                <Button 
                  type="button"
                  size="sm" 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    performSearch(searchTerm);
                  }}
                  disabled={leaderboardLoading || !searchTerm.trim()}
                  className="bg-brand hover:bg-brand/90 font-bold px-4 transition-all"
                >
                  Buscar
                </Button>
                {searchActive && (
                  <Button 
                    type="button"
                    variant="ghost" 
                    size="sm" 
                    onClick={(e) => {
                      e.preventDefault();
                      clearSearch();
                    }}
                    className="text-gray-500 hover:text-gray-700 px-2 text-xs"
                  >
                    X
                  </Button>
                )}
              </div>
              {searchTerm && !debouncedSearchTerm && !searchActive && (
                <p className="text-[10px] text-gray-400 italic animate-pulse">Esperando para buscar...</p>
              )}
              {searchActive && (
                <p className="text-[10px] text-brand font-bold uppercase flex items-center gap-1">
                  <span className="w-1 h-1 bg-brand rounded-full"></span> Filtro activo
                </p>
              )}
            </div>

            {/* Instructions */}
            <div className="flex flex-col gap-1 w-full md:w-auto text-center md:text-right">
              <p className="text-xs font-bold text-brand uppercase tracking-wider">Comparar Jugadores</p>
              <p className="text-[10px] text-gray-500 italic">Clickeá en un jugador para ver sus predicciones</p>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-700 text-sm border-b-2 border-gray-300">
                  <th className="p-2 sm:p-3 text-center w-12 sm:w-20 font-bold uppercase tracking-wider text-xs">#</th>
                  <th className="p-2 sm:p-3 font-bold uppercase tracking-wider text-xs">Jugador</th>
                  {hasAreas && <th className="p-2 sm:p-3 font-bold uppercase tracking-wider text-xs hidden md:table-cell">Área</th>}
                  <th className="p-2 sm:p-3 text-right font-bold uppercase tracking-wider text-xs pr-4 sm:pr-6">Pts</th>
                </tr>
              </thead>
              <tbody>
                {playersList.map((player, index) => {
                  // Real rank based on the current page
                  const rank = (currentPage - 1) * playersPerPage + index + 1;
                  const isMe = player.uid === user.uid;
                  
                  // Row styling
                  let rowClass = "border-b border-gray-200 transition-colors cursor-pointer hover:bg-gray-50";
                  if (isMe) {
                    rowClass += " bg-brand/5 font-bold"; // Highlight current user
                  } else if (rank === 1) {
                    rowClass += " bg-yellow-50"; // Gold
                  } else if (rank === 2) {
                    rowClass += " bg-slate-100"; // Silver
                  } else if (rank === 3) {
                    rowClass += " bg-orange-50"; // Bronze
                  }

                  return (
                    <tr 
                      key={player.uid} 
                      className={rowClass}
                      onClick={() => setSelectedUser({uid: player.uid, name: player.displayName})}
                    >
                      <td className="p-2 sm:p-3 text-center font-bold text-gray-800">
                        <div className="flex justify-center items-center gap-1">
                          {rank === 1 && <Medal className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500 drop-shadow-sm" />}
                          {rank === 2 && <Medal className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 drop-shadow-sm" />}
                          {rank === 3 && <Medal className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500 drop-shadow-sm" />}
                          <span className={rank <= 3 ? "w-4 text-base sm:text-lg" : "text-sm sm:text-base"}>{rank}</span>
                        </div>
                      </td>
                      <td className="p-2 sm:p-3 text-gray-900">
                        <div className="flex items-center gap-2 sm:gap-3">
                          {player.photoURL ? (
                            <img src={player.photoURL} alt={player.displayName} className="w-7 h-7 sm:w-10 sm:h-10 rounded-full border border-gray-200 shadow-sm shrink-0" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-full bg-gray-200 flex items-center justify-center border border-gray-300 shrink-0">
                              <UserIcon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500" />
                            </div>
                          )}
                          <div className="flex flex-col sm:flex-row sm:items-center min-w-0">
                            <span className={`block truncate max-w-[120px] sm:max-w-none ${isMe ? "text-[var(--brand-color,#2563eb)] text-sm sm:text-base font-bold" : "font-semibold text-sm sm:text-base"}`}>{player.displayName}</span>
                            {isMe && <span className="mt-0.5 sm:mt-0 sm:ml-2 text-[8px] sm:text-[10px] bg-[var(--brand-color,#2563eb)] text-white px-1.5 sm:px-2 py-0.5 rounded-full uppercase tracking-wider font-bold shadow-sm w-fit">Tú</span>}
                          </div>
                        </div>
                      </td>
                      {hasAreas && (
                        <td className="p-2 sm:p-3 text-gray-600 font-medium text-xs sm:text-sm hidden md:table-cell">
                          {(player as any).area || "-"}
                        </td>
                      )}
                      <td className="p-2 sm:p-3 text-right font-bold text-gray-900 pr-4 sm:pr-6 text-base sm:text-xl shrink-0">
                        {player.totalPoints}
                      </td>
                    </tr>
                  );
                })}
                {playersList.length === 0 && (
                  <tr>
                    <td colSpan={hasAreas ? 4 : 3} className="p-12 text-center text-gray-500 font-medium">
                      No se encontraron jugadores.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && !searchActive && (
            <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-between items-center sm:px-6">
              <div className="flex gap-1">
                <Button 
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-8 px-2 sm:px-3 text-xs"
                >
                  &laquo; Ant.
                </Button>
                <Button 
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 px-2 sm:px-3 text-xs"
                >
                  Sig. &raquo;
                </Button>
              </div>
              
              <div className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                Página <span className="text-gray-900 font-bold">{currentPage}</span> / {totalPages}
              </div>
              
              <div className="text-[9px] sm:text-[10px] text-gray-400 hidden xs:block">
                {totalUsers} usuarios
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 px-4 sm:px-6 py-6 md:py-8">
      <CountdownBanner />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="text-white border-none" style={{ backgroundColor: 'var(--brand-color, #2563eb)' }}>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="font-medium mb-1 text-white/80">Mis Puntos</p>
              <h2 className="text-5xl font-bold">{myPoints}</h2>
              <p className="text-xs mt-2 text-white/70">Los puntos se calculan automáticamente según tus aciertos.</p>
            </div>
            <div className="bg-white/20 p-4 rounded-full">
              <Trophy className="h-10 w-10 text-white" />
            </div>
          </CardContent>
        </Card>

        <Card className="text-white border-none" style={{ backgroundColor: 'color-mix(in srgb, var(--brand-color, #4f46e5) 80%, black)' }}>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="font-medium mb-1 text-white/80">Mi Posición en {companyName}</p>
              <h2 className="text-5xl font-bold">#{myRank || "-"}</h2>
            </div>
            <div className="bg-white/20 p-4 rounded-full">
              <Medal className="h-10 w-10 text-white/90" />
            </div>
          </CardContent>
        </Card>
      </div>

      {companyDetails?.prizes && (companyDetails.prizes.first || companyDetails.prizes.second || companyDetails.prizes.third) && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Gift className="w-5 h-5 text-purple-600" style={{ color: 'var(--brand-color, #9333ea)' }} /> Premios en Juego
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {companyDetails.prizes.first && (
              <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200 flex items-center gap-3">
                <div className="bg-yellow-100 p-2 rounded-full"><Trophy className="w-5 h-5 text-yellow-600" /></div>
                <div><p className="text-xs text-yellow-800 font-bold uppercase">1º Puesto</p><p className="text-sm font-medium text-gray-900">{companyDetails.prizes.first}</p></div>
              </div>
            )}
            {companyDetails.prizes.second && (
              <div className="bg-gray-50 p-4 rounded-md border border-gray-200 flex items-center gap-3">
                <div className="bg-gray-200 p-2 rounded-full"><Medal className="w-5 h-5 text-gray-600" /></div>
                <div><p className="text-xs text-gray-600 font-bold uppercase">2º Puesto</p><p className="text-sm font-medium text-gray-900">{companyDetails.prizes.second}</p></div>
              </div>
            )}
            {companyDetails.prizes.third && (
              <div className="bg-orange-50 p-4 rounded-md border border-orange-200 flex items-center gap-3">
                <div className="bg-orange-100 p-2 rounded-full"><Medal className="w-5 h-5 text-orange-600" /></div>
                <div><p className="text-xs text-orange-800 font-bold uppercase">3º Puesto</p><p className="text-sm font-medium text-gray-900">{companyDetails.prizes.third}</p></div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">Ranking de {companyName}</h2>
        <p className="text-sm text-gray-800">Competí contra todos los compañeros de tu empresa. Acá vas a ver la posición de cada jugador dentro de tu organización.</p>
        
        {hasAreas && (
          <div className="space-y-6">
            <Card className="border-t-4 border-brand">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 text-brand">
                  <Building2 className="w-5 h-5" /> Torneo de Áreas
                </CardTitle>
                <p className="text-sm text-gray-800 font-normal">Promedio de puntos por sector. ¡Llevá a tu equipo a lo más alto!</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {areaStats.map((stat, index) => (
                    <div key={stat.name} className="flex items-center justify-between p-3 rounded-lg border bg-gray-50">
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 flex items-center justify-center font-bold rounded-full text-xs ${
                          index === 0 ? 'bg-yellow-100 text-yellow-700' : 
                          index === 1 ? 'bg-gray-200 text-gray-700' : 
                          index === 2 ? 'bg-orange-100 text-orange-700' : 
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {index + 1}
                        </div>
                        <span className="font-bold text-gray-800">{stat.name}</span>
                        <span className="text-xs text-gray-700">({stat.count} jugadores)</span>
                      </div>
                      <div className="font-mono font-bold text-purple-700">
                        {stat.average} pts
                      </div>
                    </div>
                  ))}
                  {areaStats.length === 0 && (
                    <p className="text-center text-gray-700 py-4 text-sm">Aún no hay suficientes datos para el torneo de áreas.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="bg-white p-4 rounded-lg shadow-sm border flex flex-col sm:flex-row items-center gap-4">
              <label className="font-medium text-gray-700 whitespace-nowrap">Filtrar ranking individual por área:</label>
              <select 
                className="flex-1 w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                value={selectedAreaFilter}
                onChange={(e) => setSelectedAreaFilter(e.target.value)}
              >
                <option value="all">Todas las áreas (Ranking General)</option>
                {companyDetails.areas.map((area: string) => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {renderLeaderboard(selectedAreaFilter === 'all' ? `Tabla de Posiciones de ${companyName}` : `Clasificación: ${selectedAreaFilter}`, filteredPlayers)}
      </div>

      {selectedUser && (
        <UserPredictionsModal 
          userId={selectedUser.uid} 
          userName={selectedUser.name} 
          onClose={() => setSelectedUser(null)} 
        />
      )}
    </div>
  );
}
