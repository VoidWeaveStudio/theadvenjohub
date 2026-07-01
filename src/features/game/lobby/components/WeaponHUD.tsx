//src\features\game\lobby\components\WeaponHUD.tsx
"use client";

import { WEAPON_CONFIG } from '../../config/gameConfig';

interface WeaponHUDProps {
  ammo: number;
  maxAmmo: number;
  isReloading: boolean;
  reloadProgress?: number;
}

export function WeaponHUD({ ammo, maxAmmo, isReloading, reloadProgress = 0 }: WeaponHUDProps) {
  const ammoPercentage = (ammo / maxAmmo) * 100;
  const isLowAmmo = ammo <= 5;

  return (
    <div className="absolute bottom-28 right-8 pointer-events-none z-30">
      <div className="bg-black/80 backdrop-blur-md rounded-xl border border-white/10 p-4 min-w-[240px]">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
          <span className="text-2xl">🔫</span>
          <div>
            <div className="text-white text-sm font-black uppercase tracking-wider">Assault Rifle</div>
            <div className="text-zinc-500 text-[10px]">Standard Issue</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Ammo</span>
            <div className="flex items-baseline gap-1">
              <span className={`text-3xl font-black tabular-nums ${
                isReloading ? 'text-yellow-400 animate-pulse' :
                isLowAmmo ? 'text-red-400 animate-pulse' : 'text-white'
              }`}>
                {isReloading ? '...' : ammo}
              </span>
              <span className="text-zinc-500 text-lg font-bold">/ {maxAmmo}</span>
            </div>
          </div>

          <div className="relative w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-200 ${
                isReloading ? 'bg-yellow-500' :
                isLowAmmo ? 'bg-red-500' : 'bg-cyan-400'
              }`}
              style={{ width: `${ammoPercentage}%` }}
            />
          </div>

          <div className="flex gap-0.5 flex-wrap">
            {Array.from({ length: maxAmmo }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 min-w-[2px] rounded-full transition-all duration-150 ${
                  i < ammo
                    ? isReloading ? 'bg-yellow-500/50' :
                      isLowAmmo ? 'bg-red-500' : 'bg-cyan-400'
                    : 'bg-zinc-700'
                }`}
              />
            ))}
          </div>
        </div>

        {isReloading && (
          <div className="mt-3 pt-2 border-t border-white/10">
            <div className="flex items-center gap-2">
              <div className="text-yellow-400 text-xs font-bold animate-pulse">⟳ RELOADING</div>
            </div>
            <div className="mt-1 w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-400 transition-all"
                style={{ width: `${reloadProgress * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="mt-3 pt-2 border-t border-white/10 space-y-1">
          <div className="flex items-center gap-2 text-[10px]">
            <kbd className="px-1.5 py-0.5 bg-zinc-700 rounded text-white font-mono">LMB</kbd>
            <span className="text-zinc-400">Shoot</span>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <kbd className="px-1.5 py-0.5 bg-zinc-700 rounded text-white font-mono">R</kbd>
            <span className="text-zinc-400">Reload</span>
          </div>
        </div>
      </div>
    </div>
  );
}