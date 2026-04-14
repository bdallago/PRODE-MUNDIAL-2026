"use client";

import React, { useRef, useState } from 'react';

interface MatchProps {
  matchNumber: number;
  team1?: string;
  team2?: string;
}

const MatchBox = ({ matchNumber, team1 = "Por definir", team2 = "Por definir" }: MatchProps) => (
  <div className="flex flex-col w-40 bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden text-xs">
    <div className="bg-gray-100 px-2 py-1 text-[10px] font-bold text-gray-500 border-b border-gray-200">
      Partido {matchNumber}
    </div>
    <div className="px-2 py-1.5 border-b border-gray-100 truncate font-medium text-gray-700">
      {team1}
    </div>
    <div className="px-2 py-1.5 truncate font-medium text-gray-700">
      {team2}
    </div>
  </div>
);

const RoundColumn = ({ title, matches, align = 'left' }: { title: string, matches: number[], align?: 'left' | 'right' | 'center' }) => (
  <div className="flex flex-col gap-4">
    <h3 className={`font-bold text-sm text-gray-700 mb-2 ${align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'}`}>
      {title}
    </h3>
    <div className="flex flex-col justify-around flex-1 gap-2">
      {matches.map(m => (
        <MatchBox key={m} matchNumber={m} />
      ))}
    </div>
  </div>
);

export function Bracket() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 0.8; // Multiplicador de velocidad reducido para menor sensibilidad
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setStartX(e.touches[0].pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !scrollRef.current) return;
    const x = e.touches[0].pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 0.8;
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  return (
    <div 
      ref={scrollRef}
      className={`w-full overflow-x-auto pb-6 custom-scrollbar bg-gray-50 p-4 rounded-xl border border-gray-200 ${isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
      onMouseDown={handleMouseDown}
      onMouseLeave={handleMouseLeave}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      style={{ touchAction: 'pan-y' }}
    >
      <div className="min-w-[1000px] flex justify-between gap-6 pointer-events-none md:pointer-events-auto">
        
        {/* Left Bracket */}
        <div className="flex gap-6 flex-1">
          <RoundColumn title="16avos" matches={[1, 2, 3, 4, 5, 6, 7, 8]} />
          <RoundColumn title="Octavos" matches={[17, 18, 19, 20]} />
          <RoundColumn title="Cuartos" matches={[25, 26]} />
          <RoundColumn title="Semifinal" matches={[29]} />
        </div>

        {/* Center - Final */}
        <div className="flex flex-col justify-center items-center px-4">
          <h3 className="font-bold text-lg text-purple-800 mb-4 uppercase tracking-wider">Final</h3>
          <div className="flex flex-col w-48 bg-white border-2 border-purple-300 rounded-lg shadow-md overflow-hidden text-sm transform scale-110">
            <div className="bg-purple-100 px-3 py-1.5 text-xs font-bold text-purple-800 border-b border-purple-200 text-center">
              Campeón del Mundo
            </div>
            <div className="px-3 py-3 border-b border-gray-100 truncate font-bold text-gray-800 text-center">
              Por definir
            </div>
            <div className="px-3 py-3 truncate font-bold text-gray-800 text-center">
              Por definir
            </div>
          </div>
        </div>

        {/* Right Bracket */}
        <div className="flex gap-6 flex-1 flex-row-reverse">
          <RoundColumn title="16avos" matches={[9, 10, 11, 12, 13, 14, 15, 16]} align="right" />
          <RoundColumn title="Octavos" matches={[21, 22, 23, 24]} align="right" />
          <RoundColumn title="Cuartos" matches={[27, 28]} align="right" />
          <RoundColumn title="Semifinal" matches={[30]} align="right" />
        </div>

      </div>
    </div>
  );
}
