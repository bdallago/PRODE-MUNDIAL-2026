"use client";

import React, { useState, useEffect } from 'react';
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

  const [isPressing, setIsPressing] = useState(false);

  // Clear pressing state when dnd-kit takes over
  useEffect(() => {
    if (isDragging) setIsPressing(false);
  }, [isDragging]);

  // Extract dnd-kit's onPointerDown so we can merge with our own
  const { onPointerDown: dndPointerDown, ...restListeners } = (listeners || {}) as any;

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsPressing(true);
    dndPointerDown?.(e);
  };

  const clearPressing = () => setIsPressing(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.85 : (disabled ? 0.6 : 1),
  };

  const flagCode = TEAM_FLAGS[team];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(!disabled ? attributes : {})}
      {...(!disabled ? restListeners : {})}
      onPointerDown={!disabled ? handlePointerDown : undefined}
      onPointerUp={clearPressing}
      onPointerCancel={clearPressing}
      onPointerLeave={clearPressing}
      className={[
        'relative flex items-center gap-3 p-3 mb-2 rounded-lg border overflow-hidden select-none',
        'transition-all duration-150',
        isDragging
          ? 'bg-brand/10 border-brand shadow-lg scale-[1.02]'
          : isPressing && !disabled
          ? 'bg-brand/5 border-brand/50 scale-[1.01]'
          : disabled
          ? 'bg-gray-50 border-gray-200'
          : 'bg-white border-gray-200 hover:border-gray-300',
      ].join(' ')}
    >
      {/* Long-press progress bar */}
      {isPressing && !disabled && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            height: '2px',
            width: '100%',
            backgroundColor: 'var(--brand-color, #2563eb)',
            transformOrigin: 'left center',
            animation: 'press-progress 250ms linear forwards',
          }}
        />
      )}

      {/* Grip handle */}
      {!disabled && (
        <div className={`p-1 shrink-0 transition-colors duration-150 ${isPressing || isDragging ? 'text-brand' : 'text-gray-300'}`}>
          <GripVertical size={18} />
        </div>
      )}

      {/* Position badge */}
      <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold shrink-0 transition-colors duration-150 ${
        index === 0 ? 'bg-green-100 text-green-800' :
        index === 1 ? 'bg-green-50 text-green-700' :
        'bg-gray-100 text-gray-600'
      }`}>
        {index + 1}
      </div>

      {/* Flag */}
      {flagCode && (
        <img
          src={`https://flagcdn.com/w40/${flagCode}.png`}
          alt={`Bandera de ${team}`}
          className="w-6 h-4 object-cover rounded-sm shadow-sm shrink-0"
          referrerPolicy="no-referrer"
        />
      )}

      <span className="font-medium truncate flex-1">{team}</span>

      {/* "Mantené" hint — visible only while pressing */}
      {isPressing && !isDragging && (
        <span className="text-[10px] font-semibold text-brand/70 shrink-0 animate-pulse">
          Mantené…
        </span>
      )}
    </div>
  );
}
