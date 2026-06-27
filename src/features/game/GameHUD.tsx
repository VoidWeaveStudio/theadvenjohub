//src\features\game\GameHUD.tsx
"use client";

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
  myUsername
}: GameHUDProps) {
  const sortedPlayers = [...players].sort((a, b) => b.kills - a.kills);

  const myPlace = mode === 'ffa' ? sortedPlayers.findIndex(p => p.username === myUsername) + 1 : null;

  return (
    <>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <div className="w-6 h-6 relative">
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white -translate-y-1/2" />
          <div className="absolute left-1/2 top-0 h-full w-0.5 bg-white -translate-x-1/2" />
        </div>
      </div>

      <div className="absolute top-28 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur px-6 py-2 rounded-lg">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${mode === '5v5' ? 'bg-blue-500' : 'bg-yellow-500'}`} />
          <span className="text-white font-bold text-lg">{myUsername}</span>
          {mode === 'ffa' && myPlace && (
            <span className={`font-bold ${myPlace === 1 ? 'text-yellow-400' : myPlace === 2 ? 'text-zinc-300' : myPlace === 3 ? 'text-orange-400' : 'text-zinc-500'}`}>
              #{myPlace}
            </span>
          )}
        </div>
      </div>

      <div className="absolute bottom-8 left-8 space-y-2">
        <div className="bg-black/70 backdrop-blur px-4 py-2 rounded-lg">
          <div className="text-white text-sm mb-1">Health</div>
          <div className="flex items-center gap-2">
            <div className="w-48 h-4 bg-zinc-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-500 to-red-600 transition-all"
                style={{ width: `${health}%` }}
              />
            </div>
            <span className="text-white font-bold">{health}</span>
          </div>
        </div>

        <div className="bg-black/70 backdrop-blur px-4 py-2 rounded-lg">
          <div className="text-white text-sm mb-1">Ammo</div>
          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-2xl">
              {isReloading ? "..." : ammo}
            </span>
            <span className="text-zinc-400">/ {maxAmmo}</span>
          </div>
        </div>
      </div>

      {mode === '5v5' ? (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur px-6 py-3 rounded-lg">
          <div className="flex items-center gap-8">
            <div className="text-center">
              <div className="text-blue-400 text-sm">Blue Team</div>
              <div className="text-white font-bold text-2xl">{scores[1] || 0}</div>
            </div>
            <div className="text-zinc-500 text-2xl">vs</div>
            <div className="text-center">
              <div className="text-red-400 text-sm">Red Team</div>
              <div className="text-white font-bold text-2xl">{scores[2] || 0}</div>
            </div>
          </div>
          <div className="text-center text-xs text-zinc-500 mt-1">First to 50</div>
        </div>
      ) : (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur px-6 py-3 rounded-lg">
          <div className="text-center">
            <div className="text-yellow-400 text-sm font-bold">SURVIVAL</div>
            <div className="text-white font-bold text-xl">First to 50 kills</div>
          </div>
        </div>
      )}

      <div className="absolute top-8 left-8 bg-black/70 backdrop-blur px-4 py-2 rounded-lg">
        <div className="flex gap-4">
          <div>
            <div className="text-zinc-400 text-xs">Kills</div>
            <div className="text-green-400 font-bold text-xl">{kills}</div>
          </div>
          <div>
            <div className="text-zinc-400 text-xs">Deaths</div>
            <div className="text-red-400 font-bold text-xl">{deaths}</div>
          </div>
        </div>
      </div>

      {roomId && (
        <div className="absolute top-8 right-8 bg-black/70 backdrop-blur px-4 py-2 rounded-lg">
          <div className="text-zinc-400 text-xs">Room</div>
          <div className="text-white font-mono font-bold">{roomId}</div>
        </div>
      )}

      <div className="absolute top-32 right-8 bg-black/70 backdrop-blur px-4 py-3 rounded-lg max-w-xs">
        <div className="text-white font-semibold mb-2">
          {mode === '5v5' ? 'Players' : 'Leaderboard'} ({players.length})
        </div>
        <div className="space-y-1 text-sm">
          {mode === '5v5' ? (
            <>
              {players.filter(p => p.team === 1).map((player) => (
                <div key={player.id} className={`flex items-center gap-2 ${player.username === myUsername ? 'bg-blue-500/20 -mx-2 px-2 py-0.5 rounded' : ''}`}>
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-white flex-1 truncate">{player.username}</span>
                  <span className="text-zinc-400">{player.kills}/{player.deaths}</span>
                </div>
              ))}
              {players.filter(p => p.team === 2).map((player) => (
                <div key={player.id} className={`flex items-center gap-2 ${player.username === myUsername ? 'bg-red-500/20 -mx-2 px-2 py-0.5 rounded' : ''}`}>
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-white flex-1 truncate">{player.username}</span>
                  <span className="text-zinc-400">{player.kills}/{player.deaths}</span>
                </div>
              ))}
            </>
          ) : (
            sortedPlayers.map((player, index) => (
              <div key={player.id} className={`flex items-center gap-2 ${player.username === myUsername ? 'bg-yellow-500/20 -mx-2 px-2 py-0.5 rounded' : ''}`}>
                <span className={`font-bold w-6 ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-zinc-300' : index === 2 ? 'text-orange-400' : 'text-zinc-500'}`}>
                  #{index + 1}
                </span>
                <span className="text-white flex-1 truncate">{player.username}</span>
                <span className="text-green-400 font-bold">{player.kills}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="absolute bottom-8 right-8 bg-black/70 backdrop-blur px-4 py-2 rounded-lg text-xs text-zinc-400">
        <div>Click - Shoot</div>
        <div>R - Reload</div>
        <div>ESC - Exit</div>
      </div>
    </>
  );
}