"use client";

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { TEAM_FLAGS } from '../data';

export const SortableItem: React.FC<{ id: string, team: string, index: number, disabled?: boolean }> = ({ id, team, index, disabled = false }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : (disabled ? 0.6 : 1),
  };

  const flagCode = TEAM_FLAGS[team];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(!disabled ? attributes : {})}
      {...(!disabled ? listeners : {})}
      className={`flex items-center gap-2 md:gap-3 p-1.5 md:p-3 mb-1 md:mb-2 rounded-md border ${isDragging ? 'bg-brand/10 border-brand/30 shadow-md' : 'bg-white border-gray-200'} ${disabled ? 'bg-gray-50' : 'cursor-grab active:cursor-grabbing hover:bg-gray-50'} transition-colors touch-none`}
    >
      {!disabled && (
        <div className="text-gray-400 p-0.5 md:p-1 shrink-0">
          <GripVertical className="w-4 h-4 md:w-5 md:h-5" />
        </div>
      )}
      <div className={`w-5 h-5 md:w-6 md:h-6 flex items-center justify-center rounded-full text-[10px] md:text-xs font-bold shrink-0 ${
        index === 0 ? 'bg-green-100 text-green-700' : 
        index === 1 ? 'bg-green-50 text-green-600' : 
        'bg-gray-100 text-gray-500'
      }`}>
        {index + 1}
      </div>
      {flagCode && (
        <img 
          src={`https://flagcdn.com/w40/${flagCode}.png`} 
          alt={`Bandera de ${team}`}
          className="w-5 h-3.5 md:w-6 md:h-4 object-cover rounded-sm shadow-sm shrink-0"
          referrerPolicy="no-referrer"
        />
      )}
      <span className="font-semibold md:font-medium text-xs md:text-sm truncate">{team}</span>
    </div>
  );
}
