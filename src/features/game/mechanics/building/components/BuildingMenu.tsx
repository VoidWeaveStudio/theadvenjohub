"use client";

import { BuildingPieceType } from '../types';
import { PIECE_CONFIGS } from '../config';

interface BuildingMenuProps {
  onSelect: (type: BuildingPieceType) => void;
  onClose: () => void;
  isOpen: boolean;
}

export function BuildingMenu({ onSelect, onClose, isOpen }: BuildingMenuProps) {
  if (!isOpen) return null;

  const types: BuildingPieceType[] = ['wall', 'stairs', 'door', 'wall_with_doorway', 'window', 'floor'];

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50">
      <div className="relative bg-gradient-to-br from-zinc-900/95 to-black/95 border border-cyan-500/30 rounded-2xl p-6 max-w-2xl w-full shadow-2xl">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-black bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            BUILDING MENU
          </h2>
          <p className="text-zinc-400 text-xs mt-1">Select a building piece</p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {types.map((type) => {
            const config = PIECE_CONFIGS[type];
            return (
              <button
                key={type}
                onClick={() => onSelect(type)}
                className="flex flex-col items-center gap-3 p-4 bg-zinc-800/50 hover:bg-cyan-600/30 border border-zinc-700 hover:border-cyan-500 rounded-xl transition-all group"
              >
                <div className="text-4xl group-hover:scale-110 transition-transform">
                  {config.icon}
                </div>
                <div>
                  <div className="text-white font-bold text-sm">{config.name}</div>
                  <div className="text-zinc-500 text-xs">
                    {config.size.x}×{config.size.y}×{config.size.z}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <button
          onClick={onClose}
          className="w-full mt-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-xl transition-all border border-zinc-700/50 font-semibold"
        >
          Cancel (ESC or Q)
        </button>
      </div>
    </div>
  );
}