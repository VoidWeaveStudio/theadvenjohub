//src\features\game\lobby\components\Hotbar.tsx
"use client";

import { MechanicId } from '../../mechanics/shared/types';

export interface HotbarItem {
  id: string;
  name: string;
  icon: string;
  mechanic: MechanicId;
  count?: number;
}

interface HotbarProps {
  items: HotbarItem[];
  selectedSlot: number;
  onSelect: (slot: number) => void;
}

export function Hotbar({ items, selectedSlot, onSelect }: HotbarProps) {
  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-none z-30">
      <div className="flex gap-2 bg-black/70 backdrop-blur-md p-2 rounded-xl border border-white/10">
        {items.map((item, index) => (
          <button
            key={item.id}
            onClick={() => onSelect(index)}
            className={`relative w-16 h-16 rounded-lg border-2 transition-all pointer-events-auto ${
              index === selectedSlot
                ? 'border-cyan-400 bg-cyan-400/20 shadow-lg shadow-cyan-500/30'
                : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-500'
            }`}
          >
            <div className="absolute top-1 left-1 text-[10px] text-zinc-500 font-mono">
              {index + 1}
            </div>
            <div className="flex flex-col items-center justify-center h-full">
              <span className="text-2xl">{item.icon}</span>
              <span className="text-[10px] text-white font-semibold mt-1">{item.name}</span>
            </div>
            {item.count !== undefined && (
              <div className="absolute bottom-1 right-1 text-xs text-white font-bold">
                {item.count}
              </div>
            )}
            {index === selectedSlot && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-400 rounded-full animate-pulse" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}