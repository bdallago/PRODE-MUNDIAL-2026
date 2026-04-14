"use client";

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(!disabled ? attributes : {})}
      {...(!disabled ? listeners : {})}
      className={`flex items-center gap-3 p-3 mb-2 rounded-md border ${isDragging ? 'bg-blue-50 border-blue-300 shadow-md' : 'bg-white border-gray-200'} ${disabled ? 'bg-gray-50' : 'cursor-grab active:cursor-grabbing hover:bg-gray-50'} transition-colors touch-none`}
    >
      {!disabled && (
        <div className="text-gray-400 p-1 shrink-0">
          <GripVertical size={20} />
        </div>
      )}
      <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
        index === 0 ? 'bg-green-100 text-green-700' : 
        index === 1 ? 'bg-green-50 text-green-600' : 
        'bg-gray-100 text-gray-500'
      }`}>
        {index + 1}
      </div>
      <span className="font-medium">{team}</span>
    </div>
  );
}
