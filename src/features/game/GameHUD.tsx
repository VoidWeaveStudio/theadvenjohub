// src/features/game/GameHUD.tsx
"use client";

import { useEffect, useState } from 'react';

interface Player {
  id: string;
  username: string;
  team: number;
  health: number;
  kills: number;
  deaths: number;
}

interface GameHUDProps {
  health: number;
  kills: number;
  deaths: number;
  ammo: number;
  maxAmmo: number;
  isReloading: boolean;
  roomId: string | null;
  players: Player[];
  mode: '5v5' | 'ffa';
  scores: any;
  myUsername: string;
  matchEndTime: number | null;
  spawnProtectionUntil: number;
}

export function GameHUD({
  health,
  kills,
  deaths,
  ammo,
  maxAmmo,
  isReloading,
  roomId,
  players,
  mode,
  scores,
  myUsername,
  matchEndTime,
  spawnProtectionUntil
}: GameHUDProps) {
  const sortedPlayers = [...players].sort((a, b) => b.kills - a.kills);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [hasSpawnProtection, setHasSpawnProtection] = useState(false);

  useEffect(() => {
    if (!matchEndTime) return;

    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, matchEndTime - now);
      
      if (remaining <= 0) {
        setTimeLeft('0:00');
        return;
      }

      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [matchEndTime]);

  useEffect(() => {
    if (!spawnProtectionUntil) {
      setHasSpawnProtection(false);
      return;
    }

    const checkProtection = () => {
      const now = Date.now();
      setHasSpawnProtection(now < spawnProtectionUntil);
    };

    checkProtection();
    const interval = setInterval(checkProtection, 100);
    return () => clearInterval(interval);
  }, [spawnProtectionUntil]);

  const getHealthColor = () => {
    if (health > 70) return 'from-green-500 to-green-600';
    if (health > 40) return 'from-yellow-500 to-yellow-600';
    return 'from-red-500 to-red-600';
  };

  return (
    <>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <div className="w-6 h-6 relative">
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white/80 -translate-y-1/2 shadow-lg" />
          <div className="absolute left-1/2 top-0 h-full w-0.5 bg-white/80 -translate-x-1/2 shadow-lg" />
          <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-red-500 rounded-full -translate-x-1/2 -translate-y-1/2" />
        </div>
      </div>

      {hasSpawnProtection && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-blue-600/90 backdrop-blur-md px-6 py-3 rounded-lg animate-pulse shadow-lg border border-blue-400/50">
          <div className="text-white text-sm font-bold flex items-center gap-2">
            <span className="text-2xl">🛡️</span>
            <span>SPAWN PROTECTION</span>
          </div>
        </div>
      )}

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-end gap-6 pointer-events-none">
        <div className="bg-black/80 backdrop-blur-md px-6 py-4 rounded-xl shadow-2xl border border-white/10 min-w-[280px]">
          <div className="flex items-center gap-3 mb-2">
            <div className="text-2xl">❤️</div>
            <div className="flex-1">
              <div className="flex justify-between items-center mb-1">
                <span className="text-white/70 text-xs font-semibold uppercase tracking-wider">Health</span>
                <span className="text-white font-bold text-lg">{health}</span>
              </div>
              <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden shadow-inner">
                <div
                  className={`h-full bg-gradient-to-r ${getHealthColor()} transition-all duration-300 shadow-lg`}
                  style={{ width: `${health}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-black/80 backdrop-blur-md px-6 py-4 rounded-xl shadow-2xl border border-white/10 min-w-[200px]">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🔫</div>
            <div className="flex-1">
              <div className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-1">Ammo</div>
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-bold ${isReloading ? 'text-yellow-400 animate-pulse' : 'text-white'}`}>
                  {isReloading ? "..." : ammo}
                </span>
                <span className="text-zinc-400 text-lg">/ {maxAmmo}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {mode === '5v5' && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md px-8 py-4 rounded-xl shadow-2xl border border-white/10">
          <div className="flex items-center gap-12">
            <div className="text-center">
              <div className="text-blue-400 text-xs font-bold uppercase tracking-wider mb-1">Blue Team</div>
              <div className="text-white font-bold text-4xl drop-shadow-lg">{scores[1] || 0}</div>
            </div>
            <div className="text-zinc-500 text-3xl font-light">vs</div>
            <div className="text-center">
              <div className="text-red-400 text-xs font-bold uppercase tracking-wider mb-1">Red Team</div>
              <div className="text-white font-bold text-4xl drop-shadow-lg">{scores[2] || 0}</div>
            </div>
          </div>
          <div className="text-center text-xs text-zinc-400 mt-2 font-semibold">First to 50</div>
        </div>
      )}

      {timeLeft && (
        <div className="absolute top-8 right-8 bg-black/80 backdrop-blur-md px-6 py-3 rounded-xl shadow-2xl border border-white/10">
          <div className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-1">Time Left</div>
          <div className="text-white font-mono font-bold text-2xl drop-shadow-lg">{timeLeft}</div>
        </div>
      )}

      <div className="absolute top-8 left-8 bg-black/80 backdrop-blur-md px-6 py-3 rounded-xl shadow-2xl border border-white/10">
        <div className="flex gap-6">
          <div>
            <div className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Kills</div>
            <div className="text-green-400 font-bold text-2xl drop-shadow-lg">{kills}</div>
          </div>
          <div>
            <div className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Deaths</div>
            <div className="text-red-400 font-bold text-2xl drop-shadow-lg">{deaths}</div>
          </div>
        </div>
      </div>

      <div className="absolute top-32 right-8 bg-black/80 backdrop-blur-md px-5 py-4 rounded-xl shadow-2xl border border-white/10 max-w-xs">
        <div className="text-white font-bold mb-3 flex items-center gap-2">
          <span className="text-xl">{mode === '5v5' ? '👥' : '🏆'}</span>
          <span>{mode === '5v5' ? 'Players' : 'Leaderboard'} ({players.length})</span>
        </div>
        <div className="space-y-1.5 text-sm max-h-64 overflow-y-auto">
          {mode === '5v5' ? (
            <>
              {players.filter(p => p.team === 1).map((player) => (
                <div key={player.id} className={`flex items-center gap-2 px-2 py-1 rounded ${player.username === myUsername ? 'bg-blue-500/30 border border-blue-400/50' : ''}`}>
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-lg" />
                  <span className="text-white flex-1 truncate font-medium">{player.username}</span>
                  <span className="text-zinc-400 font-mono text-xs">{player.kills}/{player.deaths}</span>
                </div>
              ))}
              {players.filter(p => p.team === 2).map((player) => (
                <div key={player.id} className={`flex items-center gap-2 px-2 py-1 rounded ${player.username === myUsername ? 'bg-red-500/30 border border-red-400/50' : ''}`}>
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-lg" />
                  <span className="text-white flex-1 truncate font-medium">{player.username}</span>
                  <span className="text-zinc-400 font-mono text-xs">{player.kills}/{player.deaths}</span>
                </div>
              ))}
            </>
          ) : (
            sortedPlayers.map((player, index) => (
              <div key={player.id} className={`flex items-center gap-2 px-2 py-1 rounded ${player.username === myUsername ? 'bg-yellow-500/30 border border-yellow-400/50' : ''}`}>
                <span className={`font-bold w-6 text-lg ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-zinc-300' : index === 2 ? 'text-orange-400' : 'text-zinc-500'}`}>
                  #{index + 1}
                </span>
                <span className="text-white flex-1 truncate font-medium">{player.username}</span>
                <div className="flex gap-2 font-mono text-xs">
                  <span className="text-green-400 font-bold">{player.kills}</span>
                  <span className="text-red-400">/{player.deaths}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="absolute bottom-8 right-8 bg-black/80 backdrop-blur-md px-4 py-3 rounded-xl shadow-2xl border border-white/10 text-xs">
        <div className="text-zinc-400 space-y-1.5">
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-0.5 bg-zinc-700 rounded text-white font-mono">LMB</kbd>
            <span>Shoot</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-0.5 bg-zinc-700 rounded text-white font-mono">R</kbd>
            <span>Reload</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-0.5 bg-zinc-700 rounded text-white font-mono">T</kbd>
            <span>Voice Chat</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-0.5 bg-zinc-700 rounded text-white font-mono">Y</kbd>
            <span>Text Chat</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-0.5 bg-zinc-700 rounded text-white font-mono">ESC</kbd>
            <span>Exit</span>
          </div>
        </div>
      </div>
    </>
  );
}