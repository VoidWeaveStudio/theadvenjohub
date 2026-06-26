"use client";

import { useState } from "react";

interface GameLobbyProps {
  wallet: string;
  onStart: () => void;
  onExit: () => void;
}

export function GameLobby({ wallet, onStart, onExit }: GameLobbyProps) {
  const [username, setUsername] = useState(`Player_${wallet.substring(0, 4)}`);

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-black flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-8 max-w-md w-full space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-2">TANJO SHOOTER</h1>
          <p className="text-zinc-400">5v5 Block Shooter</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              maxLength={20}
            />
          </div>

          <div className="bg-zinc-800 rounded-lg p-4 space-y-2">
            <h3 className="text-white font-semibold">Controls</h3>
            <div className="text-sm text-zinc-400 space-y-1">
              <p><span className="text-white">WASD</span> - Move</p>
              <p><span className="text-white">Mouse</span> - Look around (click to capture)</p>
              <p><span className="text-white">Left Click</span> - Shoot</p>
              <p><span className="text-white">R</span> - Reload</p>
              <p><span className="text-white">ESC</span> - Exit</p>
            </div>
          </div>

          <div className="bg-zinc-800 rounded-lg p-4">
            <h3 className="text-white font-semibold mb-2">Game Rules</h3>
            <ul className="text-sm text-zinc-400 space-y-1 list-disc list-inside">
              <li>Teams: 5 vs 5</li>
              <li>Respawn after 3 seconds</li>
              <li>First team to 50 kills wins</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onExit}
              className="flex-1 px-6 py-3 bg-zinc-700 hover:bg-zinc-600 text-white font-semibold rounded-lg transition-colors"
            >
              Exit
            </button>
            <button
              onClick={onStart}
              className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            >
              PLAY
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}