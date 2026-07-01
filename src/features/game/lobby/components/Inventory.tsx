//src\features\game\lobby\components\Inventory.tsx
"use client";

import { HotbarItem } from './Hotbar';

interface InventoryProps {
  items: HotbarItem[];
  onClose: () => void;
}

export function Inventory({ items, onClose }: InventoryProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-md z-50">
      <div className="relative bg-gradient-to-br from-zinc-900/95 to-black/95 border border-cyan-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <div className="text-center mb-4">
          <h2 className="text-2xl font-black text-white">Inventory</h2>
          <p className="text-zinc-400 text-xs">Items cannot be dropped</p>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="relative w-full aspect-square rounded-lg border-2 border-zinc-700 bg-zinc-800/50 flex flex-col items-center justify-center"
            >
              <span className="text-3xl">{item.icon}</span>
              <span className="text-[10px] text-white font-semibold mt-1">{item.name}</span>
              <div className="absolute top-1 right-1 text-[10px] text-zinc-500">🔒</div>
            </div>
          ))}
          {Array.from({ length: 8 - items.length }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="w-full aspect-square rounded-lg border-2 border-zinc-800 bg-zinc-900/30"
            />
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full mt-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-xl transition-all border border-zinc-700/50 font-semibold text-sm"
        >
          Close (I / ESC)
        </button>
      </div>
    </div>
  );
}