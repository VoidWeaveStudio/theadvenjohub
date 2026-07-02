//src\features\game\lobby\components\LobbyUI.tsx
"use client";

interface LobbyUIProps {
  username: string;
  playersCount: number;
  isInSafeZone: boolean;
  activeMechanic: string;
}

export function LobbyUI({ username, playersCount, isInSafeZone, activeMechanic }: LobbyUIProps) {
  return (
    <>
      <div className="absolute top-4 left-4 pointer-events-none z-20">
        <div className="bg-black/70 backdrop-blur-md px-4 py-2 rounded-lg border border-white/10">
          <div className="text-white text-sm font-bold">{username}</div>
          <div className="text-zinc-400 text-xs">
            {isInSafeZone ? '🛡️ Safe Zone' : '⚔️ Combat Zone'} • {activeMechanic}
          </div>
        </div>
      </div>

      <div className="absolute top-4 right-4 pointer-events-none z-20">
        <div className="bg-black/70 backdrop-blur-md px-4 py-2 rounded-lg border border-white/10">
          <div className="text-cyan-400 text-xs font-bold">Players Online</div>
          <div className="text-white text-2xl font-black">{playersCount}</div>
        </div>
      </div>

      <div className="absolute bottom-28 left-1/2 -translate-x-1/2 pointer-events-none z-20">
        <div className="bg-black/70 backdrop-blur-md px-4 py-2 rounded-lg border border-white/10">
          <div className="text-zinc-400 text-xs text-center">
            Press <kbd className="px-1.5 py-0.5 bg-zinc-700 rounded text-white font-mono">ESC</kbd> for menu
          </div>
        </div>
      </div>
    </>
  );
}