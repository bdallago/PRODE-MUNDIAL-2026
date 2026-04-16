"use client";

import { useEffect, useState, useMemo } from "react";
import { User } from "firebase/auth";
import { collection, query, where, onSnapshot, doc } from "firebase/firestore";
import { db } from "../firebase";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Trophy, Medal, User as UserIcon, Gift, Building2 } from "lucide-react";
import { CountdownBanner } from "../components/CountdownBanner";
import { UserPredictionsModal } from "../components/UserPredictionsModal";

interface Player {
  uid: string;
  displayName: string;
  photoURL: string;
  totalPoints: number;
  role?: string;
}

export default function Dashboard({ user, userData, companyName, companyDetails }: { user: User, userData: any, companyName: string, companyDetails?: any }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<{uid: string, name: string} | null>(null);
  const [selectedAreaFilter, setSelectedAreaFilter] = useState<string>('all');
  const [localCompanyDetails, setLocalCompanyDetails] = useState<any>(companyDetails);
  
  // New states for ranking
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const playersPerPage = 50;

  useEffect(() => {
    if (!userData?.companyId) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, "users"), where("companyId", "==", userData.companyId));
    const unsubscribeUsers = onSnapshot(q, (snapshot) => {
      const playersData = snapshot.docs
        .map((doc) => ({ ...doc.data(), uid: doc.id } as Player))
        .filter(p => p.role !== 'admin'); // Hide admins from ranking
      // Sort client-side to avoid needing a composite index in Firestore
      playersData.sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));
      setPlayers(playersData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching leaderboard", error);
      setLoading(false);
    });

    // Listen to company details for real-time banner updates
    const unsubscribeCompany = onSnapshot(doc(db, "companies", userData.companyId), (docSnap) => {
      if (docSnap.exists()) {
        setLocalCompanyDetails(docSnap.data());
      }
    });

    return () => {
      unsubscribeUsers();
      unsubscribeCompany();
    };
  }, [userData?.companyId]);

  const filteredPlayers = selectedAreaFilter === 'all' 
    ? players 
    : players.filter(p => (p as any).area === selectedAreaFilter);

  const myPoints = players.find((p) => p.uid === user.uid)?.totalPoints || 0;
  const myRank = players.findIndex((p) => p.totalPoints === myPoints) + 1;

  const isPremium = localCompanyDetails?.plan === 'premium';
  const hasAreas = isPremium && companyDetails?.areas && companyDetails.areas.length > 0;

  const areaStats = useMemo(() => {
    if (!hasAreas) return [];
    const stats: Record<string, { totalPoints: number, count: number, name: string }> = {};
    players.forEach(p => {
      const area = (p as any).area;
      if (area) {
        if (!stats[area]) stats[area] = { totalPoints: 0, count: 0, name: area };
        stats[area].totalPoints += (p.totalPoints || 0);
        stats[area].count += 1;
      }
    });
    return Object.values(stats)
      .map(s => ({ ...s, average: Math.round(s.totalPoints / s.count) }))
      .sort((a, b) => b.average - a.average);
  }, [players, hasAreas]);

  if (loading) {
    return <div className="text-center py-10">Cargando clasificación...</div>;
  }

  const renderLeaderboard = (title: string, playersList: Player[]) => {
    // 1. Filter by search query
    const searchedPlayers = playersList.filter(p => 
      p.displayName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // 2. Pagination logic
    const totalPages = Math.ceil(searchedPlayers.length / playersPerPage) || 1;
    const startIndex = (currentPage - 1) * playersPerPage;
    const paginatedPlayers = searchedPlayers.slice(startIndex, startIndex + playersPerPage);

    const handleJumpToMe = () => {
      const myIndex = searchedPlayers.findIndex(p => p.uid === user.uid);
      if (myIndex !== -1) {
        const myPage = Math.floor(myIndex / playersPerPage) + 1;
        setCurrentPage(myPage);
        setSearchQuery(""); // Clear search to ensure we see the full list context
      }
    };

    return (
      <Card className="border border-gray-300 shadow-md overflow-hidden border-t-4" style={{ borderTopColor: 'var(--brand-color, #2563eb)' }}>
        <div className="bg-gray-50 p-4 border-b-2 border-gray-200 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5 text-blue-600" style={{ color: 'var(--brand-color, #2563eb)' }} /> {title}
          </h3>
        </div>
        
        <CardContent className="p-0">
          {/* Header Controls */}
          <div className="p-4 bg-white border-b-2 border-gray-200 flex flex-col md:flex-row gap-6 justify-between items-center">
            
            {/* Left side: Icon and Selects */}
            <div className="flex items-center gap-6 w-full md:w-auto flex-1">
              <div className="hidden md:flex w-20 h-20 bg-blue-50 border-2 border-blue-100 rounded-xl items-center justify-center shadow-sm shrink-0">
                <Trophy className="w-10 h-10 text-blue-600" style={{ color: 'var(--brand-color, #2563eb)' }} />
              </div>
              
              <div className="flex flex-col gap-3 w-full max-w-sm">
                <select className="w-full p-2 border border-gray-300 bg-white rounded-md text-sm text-gray-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm">
                  <option>Puntuación total</option>
                </select>
                <div className="flex gap-2 w-full">
                  <select 
                    className="p-2 border border-gray-300 bg-white rounded-md text-sm text-gray-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 shadow-sm"
                    value={currentPage}
                    onChange={(e) => setCurrentPage(Number(e.target.value))}
                  >
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <option key={i} value={i + 1}>
                        {i * playersPerPage + 1} - {Math.min((i + 1) * playersPerPage, Math.max(searchedPlayers.length, 1))}
                      </option>
                    ))}
                  </select>
                  <button 
                    onClick={handleJumpToMe}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-800 text-sm font-bold shadow-sm hover:bg-gray-50 active:bg-gray-100 transition-colors whitespace-nowrap"
                  >
                    Mi Posición
                  </button>
                </div>
              </div>
            </div>

            {/* Right side: Search */}
            <div className="flex flex-col gap-1.5 w-full md:w-64 shrink-0">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Buscar jugador</label>
              <input 
                type="text" 
                placeholder="Escribí un nombre..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1); // Reset to first page on search
                }}
                className="w-full p-2 border border-gray-300 bg-white rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-700 text-sm border-b-2 border-gray-300">
                  <th className="p-3 text-center w-20 font-bold uppercase tracking-wider text-xs">Posición</th>
                  <th className="p-3 font-bold uppercase tracking-wider text-xs">Jugador</th>
                  {hasAreas && <th className="p-3 font-bold uppercase tracking-wider text-xs hidden md:table-cell">Área</th>}
                  <th className="p-3 text-right font-bold uppercase tracking-wider text-xs pr-6">Puntos</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPlayers.map((player, index) => {
                  // Real rank based on the full sorted list
                  const rank = playersList.findIndex(p => p.totalPoints === player.totalPoints) + 1;
                  const isMe = player.uid === user.uid;
                  
                  // Row styling
                  let rowClass = "border-b border-gray-200 transition-colors cursor-pointer hover:bg-gray-50";
                  if (isMe) {
                    rowClass += " bg-blue-50 font-bold"; // Highlight current user
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
                      <td className="p-3 text-center font-bold text-gray-800 flex justify-center items-center gap-1.5">
                        {rank === 1 && <Medal className="w-5 h-5 text-yellow-500 drop-shadow-sm" />}
                        {rank === 2 && <Medal className="w-5 h-5 text-slate-400 drop-shadow-sm" />}
                        {rank === 3 && <Medal className="w-5 h-5 text-orange-500 drop-shadow-sm" />}
                        <span className={rank <= 3 ? "w-4 text-lg" : "text-base"}>{rank}</span>
                      </td>
                      <td className="p-3 text-gray-900">
                        <div className="flex items-center gap-3">
                          {player.photoURL ? (
                            <img src={player.photoURL} alt={player.displayName} className="w-10 h-10 rounded-full border-2 border-gray-200 shadow-sm" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-300">
                              <UserIcon className="h-5 w-5 text-gray-500" />
                            </div>
                          )}
                          <span className={isMe ? "text-blue-700 text-base" : "font-semibold text-base"}>{player.displayName}</span>
                          {isMe && <span className="ml-2 text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider font-bold shadow-sm">Tú</span>}
                        </div>
                      </td>
                      {hasAreas && (
                        <td className="p-3 text-gray-600 font-medium text-sm hidden md:table-cell">
                          {(player as any).area || "-"}
                        </td>
                      )}
                      <td className="p-3 text-right font-bold text-gray-900 pr-6 text-xl">
                        {player.totalPoints}
                      </td>
                    </tr>
                  );
                })}
                {paginatedPlayers.length === 0 && (
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
          {totalPages > 1 && (
            <div className="p-4 bg-gray-100 border-t-2 border-gray-200 flex justify-center items-center gap-6">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-800 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors shadow-sm"
              >
                &laquo; Anterior
              </button>
              <span className="text-sm font-medium text-gray-600">
                Página <span className="font-bold text-gray-900">{currentPage}</span> de {totalPages}
              </span>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-800 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors shadow-sm"
              >
                Siguiente &raquo;
              </button>
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
        <p className="text-sm text-gray-500">Competí contra todos los compañeros de tu empresa. Acá vas a ver la posición de cada jugador dentro de tu organización.</p>
        
        {hasAreas && (
          <div className="space-y-6">
            <Card className="border-t-4 border-t-purple-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 text-purple-900">
                  <Building2 className="w-5 h-5" /> Torneo de Áreas
                </CardTitle>
                <p className="text-sm text-gray-500 font-normal">Promedio de puntos por sector. ¡Llevá a tu equipo a lo más alto!</p>
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
                        <span className="text-xs text-gray-500">({stat.count} jugadores)</span>
                      </div>
                      <div className="font-mono font-bold text-purple-700">
                        {stat.average} pts
                      </div>
                    </div>
                  ))}
                  {areaStats.length === 0 && (
                    <p className="text-center text-gray-500 py-4 text-sm">Aún no hay suficientes datos para el torneo de áreas.</p>
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
