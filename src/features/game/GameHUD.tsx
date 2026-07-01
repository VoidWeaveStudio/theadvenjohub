// src/features/game/GameHUD.tsx
"use client";

import { useEffect, useState, useMemo } from 'react';
import { WEAPON_CONFIG, UI_CONFIG } from './config/gameConfig';
import type { Player } from './types';

interface KillFeedEntry {
  id: string;
  killer: string;
  victim: string;
  killerTeam: number;
  victimTeam: number;
  timestamp: number;
  weapon?: string;
}

interface DamageIndicator {
  id: string;
  angle: number;
  timestamp: number;
  damage: number;
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
  killFeed?: KillFeedEntry[];
  damageIndicators?: DamageIndicator[];
  showHitMarker?: boolean;
  lastHitTime?: number;
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
  spawnProtectionUntil,
  killFeed = [],
  damageIndicators = [],
  showHitMarker = false,
  lastHitTime = 0
}: GameHUDProps) {
  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => b.kills - a.kills),
    [players]
  );

  const [timeLeft, setTimeLeft] = useState<string>('');
  const [hasSpawnProtection, setHasSpawnProtection] = useState(false);
  const [visibleKillFeed, setVisibleKillFeed] = useState<KillFeedEntry[]>([]);
  
  const [isHitMarkerVisible, setIsHitMarkerVisible] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

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

  useEffect(() => {
    setVisibleKillFeed(killFeed.slice(-UI_CONFIG.killFeed.maxEntries));

    const cleanup = setInterval(() => {
      const now = Date.now();
      setVisibleKillFeed(prev => prev.filter(k => now - k.timestamp < UI_CONFIG.killFeed.duration));
    }, 1000);

    return () => clearInterval(cleanup);
  }, [killFeed]);

  useEffect(() => {
    if (showHitMarker && lastHitTime > 0) {
      setIsHitMarkerVisible(true);
      const timer = setTimeout(() => {
        setIsHitMarkerVisible(false);
      }, UI_CONFIG.hitMarker.duration);
      return () => clearTimeout(timer);
    }
  }, [showHitMarker, lastHitTime]);

  const getHealthColor = () => {
    if (health > UI_CONFIG.healthBar.mediumHealthThreshold) return 'from-emerald-400 via-green-500 to-green-600';
    if (health > UI_CONFIG.healthBar.lowHealthThreshold) return 'from-yellow-400 via-amber-500 to-orange-500';
    return 'from-red-400 via-red-500 to-red-700';
  };

  const getHealthGlow = () => {
    if (health > UI_CONFIG.healthBar.mediumHealthThreshold) return 'shadow-green-500/50';
    if (health > UI_CONFIG.healthBar.lowHealthThreshold) return 'shadow-yellow-500/50';
    return 'shadow-red-500/50';
  };

  return (
    <>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-40">
        <div className="relative w-8 h-8">
          <div className="absolute top-1/2 left-0 w-2 h-0.5 bg-white -translate-y-1/2 shadow-lg shadow-black/50" />
          <div className="absolute top-1/2 right-0 w-2 h-0.5 bg-white -translate-y-1/2 shadow-lg shadow-black/50" />
          <div className="absolute left-1/2 top-0 w-0.5 h-2 bg-white -translate-x-1/2 shadow-lg shadow-black/50" />
          <div className="absolute left-1/2 bottom-0 w-0.5 h-2 bg-white -translate-x-1/2 shadow-lg shadow-black/50" />
          <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-red-500 rounded-full -translate-x-1/2 -translate-y-1/2 shadow-lg shadow-red-500/50" />

          {isHitMarkerVisible && (
            <div className="absolute inset-0 animate-ping">
              <div className="absolute top-1/2 left-1/2 w-6 h-6 -translate-x-1/2 -translate-y-1/2">
                <div className="absolute top-0 left-1/2 w-0.5 h-2 bg-white -translate-x-1/2 rotate-45" />
                <div className="absolute bottom-0 left-1/2 w-0.5 h-2 bg-white -translate-x-1/2 rotate-45" />
                <div className="absolute left-0 top-1/2 w-2 h-0.5 bg-white -translate-y-1/2 rotate-45" />
                <div className="absolute right-0 top-1/2 w-2 h-0.5 bg-white -translate-y-1/2 rotate-45" />
              </div>
            </div>
          )}
        </div>
      </div>

      {damageIndicators.map((indicator) => {
        const age = now - indicator.timestamp;
        if (age > UI_CONFIG.damageIndicators.duration) return null;

        return (
          <div
            key={indicator.id}
            className="absolute top-1/2 left-1/2 pointer-events-none z-30"
            style={{
              transform: `translate(-50%, -50%) rotate(${indicator.angle}deg)`,
              opacity: Math.max(0, 1 - age / UI_CONFIG.damageIndicators.duration)
            }}
          >
            <div className="absolute top-[-150px] left-1/2 -translate-x-1/2">
              <div className="w-1 h-16 bg-gradient-to-t from-transparent via-red-500 to-red-600 shadow-lg shadow-red-500/50" />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-b-[12px] border-l-transparent border-r-transparent border-b-red-600" />
            </div>
          </div>
        );
      })}

      {hasSpawnProtection && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600/90 via-cyan-600/90 to-blue-600/90 backdrop-blur-md px-8 py-3 rounded-lg animate-pulse shadow-2xl border border-cyan-400/50 z-40">
          <div className="text-white text-sm font-bold flex items-center gap-3">
            <div className="text-2xl animate-bounce">🛡️</div>
            <div>
              <div className="text-xs text-cyan-200 uppercase tracking-wider">Shield Active</div>
              <div className="text-lg font-black">SPAWN PROTECTION</div>
            </div>
          </div>
        </div>
      )}

      <div className="absolute top-20 right-8 space-y-2 pointer-events-none z-30">
        {visibleKillFeed.map((kill) => (
          <div
            key={kill.id}
            className="flex items-center gap-2 bg-black/70 backdrop-blur-md px-4 py-2 rounded-lg border border-white/10 shadow-lg animate-[slideIn_0.3s_ease-out]"
            style={{
              animation: 'slideIn 0.3s ease-out'
            }}
          >
            <span className={`font-bold text-sm ${kill.killerTeam === 1 ? 'text-blue-400' :
              kill.killerTeam === 2 ? 'text-red-400' : 'text-white'
              }`}>
              {kill.killer}
            </span>
            <div className="text-white text-lg">🔫</div>
            <span className={`font-bold text-sm ${kill.victimTeam === 1 ? 'text-blue-400' :
              kill.victimTeam === 2 ? 'text-red-400' : 'text-white'
              }`}>
              {kill.victim}
            </span>
          </div>
        ))}
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-end gap-4 pointer-events-none z-30">
        <div className="relative bg-gradient-to-br from-black/90 via-zinc-900/90 to-black/90 backdrop-blur-xl px-6 py-4 rounded-xl shadow-2xl border border-white/10 min-w-[320px] overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-black/0 via-white/5 to-black/0" />

          <div className="relative flex items-center gap-4">
            <div className="relative">
              <div className="text-3xl">❤️</div>
              <div className={`absolute inset-0 blur-xl opacity-50 ${health > UI_CONFIG.healthBar.mediumHealthThreshold ? 'bg-green-500' : health > UI_CONFIG.healthBar.lowHealthThreshold ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
            </div>

            <div className="flex-1">
              <div className="flex justify-between items-center mb-2">
                <span className="text-white/60 text-xs font-bold uppercase tracking-widest">Health</span>
                <span className={`text-white font-black text-2xl tabular-nums ${health <= UI_CONFIG.healthBar.lowHealthThreshold ? 'animate-pulse text-red-400' : ''
                  }`}>
                  {health}
                </span>
              </div>

              <div className="relative w-full h-4 bg-zinc-800/80 rounded-full overflow-hidden shadow-inner border border-black/50">
                <div
                  className={`h-full bg-gradient-to-r ${getHealthColor()} transition-all duration-500 ease-out shadow-lg ${getHealthGlow()} relative overflow-hidden`}
                  style={{ width: `${health}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_2s_infinite]" />
                </div>

                <div className="absolute inset-0 flex">
                  {[25, 50, 75].map(mark => (
                    <div
                      key={mark}
                      className="absolute top-0 bottom-0 w-px bg-black/30"
                      style={{ left: `${mark}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative bg-gradient-to-br from-black/90 via-zinc-900/90 to-black/90 backdrop-blur-xl px-6 py-4 rounded-xl shadow-2xl border border-white/10 min-w-[200px] overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-black/0 via-white/5 to-black/0" />

          <div className="relative flex items-center gap-4">
            <div className="relative">
              <div className="text-3xl">🔫</div>
              <div className={`absolute inset-0 blur-xl opacity-50 ${isReloading ? 'bg-yellow-500' : 'bg-white'
                }`} />
            </div>

            <div className="flex-1">
              <div className="text-white/60 text-xs font-bold uppercase tracking-widest mb-2">Ammo</div>
              <div className="flex items-baseline gap-2">
                <span className={`text-4xl font-black tabular-nums transition-all ${isReloading
                  ? 'text-yellow-400 animate-pulse'
                  : ammo <= 5
                    ? 'text-red-400 animate-pulse'
                    : 'text-white'
                  }`}>
                  {isReloading ? "..." : ammo}
                </span>
                <span className="text-zinc-500 text-xl font-bold">/ {maxAmmo}</span>
              </div>

              <div className="flex gap-0.5 mt-2">
                {Array.from({ length: Math.min(maxAmmo, WEAPON_CONFIG.maxAmmo) }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-all duration-200 ${i < ammo
                      ? isReloading
                        ? 'bg-yellow-500/50'
                        : 'bg-white'
                      : 'bg-zinc-700'
                      }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {mode === '5v5' && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 pointer-events-none z-30">
          <div className="relative bg-gradient-to-br from-black/90 via-zinc-900/90 to-black/90 backdrop-blur-xl px-10 py-4 rounded-xl shadow-2xl border border-white/10 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-transparent to-red-500/10" />

            <div className="relative flex items-center gap-16">
              <div className="text-center">
                <div className="text-blue-400 text-xs font-black uppercase tracking-widest mb-2">
                  Blue Team
                </div>
                <div className="text-white font-black text-5xl drop-shadow-lg tabular-nums">
                  {scores[1] || 0}
                </div>
              </div>

              <div className="flex flex-col items-center">
                <div className="text-zinc-600 text-2xl font-light">VS</div>
                <div className="text-zinc-500 text-xs font-bold mt-1">FIRST TO 50</div>
              </div>

              <div className="text-center">
                <div className="text-red-400 text-xs font-black uppercase tracking-widest mb-2">
                  Red Team
                </div>
                <div className="text-white font-black text-5xl drop-shadow-lg tabular-nums">
                  {scores[2] || 0}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {timeLeft && (
        <div className="absolute top-8 right-8 pointer-events-none z-30">
          <div className="relative bg-gradient-to-br from-black/90 via-zinc-900/90 to-black/90 backdrop-blur-xl px-6 py-3 rounded-xl shadow-2xl border border-white/10 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-black/0 via-white/5 to-black/0" />

            <div className="relative">
              <div className="text-zinc-500 text-xs font-black uppercase tracking-widest mb-1">
                Time Left
              </div>
              <div className={`font-mono font-black text-3xl drop-shadow-lg tabular-nums ${timeLeft === '0:00' || timeLeft.startsWith('0:') && parseInt(timeLeft.split(':')[1]) < 30
                ? 'text-red-400 animate-pulse'
                : 'text-white'
                }`}>
                {timeLeft}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="absolute top-8 left-8 pointer-events-none z-30">
        <div className="relative bg-gradient-to-br from-black/90 via-zinc-900/90 to-black/90 backdrop-blur-xl px-6 py-3 rounded-xl shadow-2xl border border-white/10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-black/0 via-white/5 to-black/0" />

          <div className="relative flex gap-8">
            <div>
              <div className="text-zinc-500 text-xs font-black uppercase tracking-widest">Kills</div>
              <div className="text-emerald-400 font-black text-3xl drop-shadow-lg tabular-nums">
                {kills}
              </div>
            </div>
            <div className="w-px bg-white/10" />
            <div>
              <div className="text-zinc-500 text-xs font-black uppercase tracking-widest">Deaths</div>
              <div className="text-red-400 font-black text-3xl drop-shadow-lg tabular-nums">
                {deaths}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute top-32 right-8 pointer-events-none z-30">
        <div className="relative bg-gradient-to-br from-black/90 via-zinc-900/90 to-black/90 backdrop-blur-xl px-5 py-4 rounded-xl shadow-2xl border border-white/10 max-w-xs overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-black/0 via-white/5 to-black/0" />

          <div className="relative">
            <div className="text-white font-black mb-3 flex items-center gap-2 pb-2 border-b border-white/10">
              <span className="text-xl">{mode === '5v5' ? '👥' : '🏆'}</span>
              <span className="text-sm uppercase tracking-wider">
                {mode === '5v5' ? 'Players' : 'Leaderboard'}
              </span>
              <span className="ml-auto text-zinc-500 text-xs font-bold">{players.length}</span>
            </div>

            <div className="space-y-1 text-sm max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
              {mode === '5v5' ? (
                <>
                  <div className="text-blue-400 text-xs font-black uppercase tracking-wider mb-1 mt-2">
                    Blue Team
                  </div>
                  {players.filter(p => p.team === 1).map((player) => (
                    <div
                      key={player.id}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${player.username === myUsername
                        ? 'bg-blue-500/30 border border-blue-400/50 shadow-lg shadow-blue-500/20'
                        : 'hover:bg-white/5'
                        }`}
                    >
                      <div className="w-2 h-2 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50" />
                      <span className="text-white flex-1 truncate font-semibold text-xs">
                        {player.username}
                        {player.username === myUsername && (
                          <span className="text-blue-400 ml-1 text-[10px]">(YOU)</span>
                        )}
                      </span>
                      <div className="flex gap-1 font-mono text-xs">
                        <span className="text-emerald-400 font-bold">{player.kills}</span>
                        <span className="text-zinc-600">/</span>
                        <span className="text-red-400">{player.deaths}</span>
                      </div>
                    </div>
                  ))}

                  <div className="text-red-400 text-xs font-black uppercase tracking-wider mb-1 mt-3">
                    Red Team
                  </div>
                  {players.filter(p => p.team === 2).map((player) => (
                    <div
                      key={player.id}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${player.username === myUsername
                        ? 'bg-red-500/30 border border-red-400/50 shadow-lg shadow-red-500/20'
                        : 'hover:bg-white/5'
                        }`}
                    >
                      <div className="w-2 h-2 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />
                      <span className="text-white flex-1 truncate font-semibold text-xs">
                        {player.username}
                        {player.username === myUsername && (
                          <span className="text-red-400 ml-1 text-[10px]">(YOU)</span>
                        )}
                      </span>
                      <div className="flex gap-1 font-mono text-xs">
                        <span className="text-emerald-400 font-bold">{player.kills}</span>
                        <span className="text-zinc-600">/</span>
                        <span className="text-red-400">{player.deaths}</span>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                sortedPlayers.map((player, index) => (
                  <div
                    key={player.id}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${player.username === myUsername
                      ? 'bg-yellow-500/30 border border-yellow-400/50 shadow-lg shadow-yellow-500/20'
                      : 'hover:bg-white/5'
                      }`}
                  >
                    <span className={`font-black w-6 text-lg tabular-nums ${index === 0 ? 'text-yellow-400' :
                      index === 1 ? 'text-zinc-300' :
                        index === 2 ? 'text-orange-400' :
                          'text-zinc-600'
                      }`}>
                      #{index + 1}
                    </span>
                    <span className="text-white flex-1 truncate font-semibold text-xs">
                      {player.username}
                      {player.username === myUsername && (
                        <span className="text-yellow-400 ml-1 text-[10px]">(YOU)</span>
                      )}
                    </span>
                    <div className="flex gap-1 font-mono text-xs">
                      <span className="text-emerald-400 font-bold">{player.kills}</span>
                      <span className="text-zinc-600">/</span>
                      <span className="text-red-400">{player.deaths}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 right-8 pointer-events-none z-30">
        <div className="relative bg-gradient-to-br from-black/80 via-zinc-900/80 to-black/80 backdrop-blur-xl px-4 py-3 rounded-xl shadow-2xl border border-white/10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-black/0 via-white/5 to-black/0" />

          <div className="relative text-xs space-y-1.5">
            <div className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-2">
              Controls
            </div>
            {[
              { key: 'LMB', action: 'Shoot' },
              { key: 'R', action: 'Reload' },
              { key: 'V', action: 'Voice Chat' },
              { key: 'Y', action: 'Text Chat' },
              { key: 'ESC', action: 'Exit' }
            ].map(({ key, action }) => (
              <div key={key} className="flex items-center gap-3">
                <kbd className="px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-white font-mono text-[10px] shadow-lg">
                  {key}
                </kbd>
                <span className="text-zinc-400 text-[11px]">{action}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
    @keyframes shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
    }
    
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .scrollbar-thin::-webkit-scrollbar {
        width: 4px;
    }
    
    .scrollbar-thin::-webkit-scrollbar-track {
        background: transparent;
    }
    
    .scrollbar-thin::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 2px;
    }
    
    .scrollbar-thin::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.2);
    }
`}</style>
    </>
  );
}