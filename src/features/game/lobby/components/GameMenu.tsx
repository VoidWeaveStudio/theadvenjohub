//src\features\game\lobby\components\GameMenu.tsx
"use client";

import { useState, useCallback } from "react";

interface GameMenuProps {
  username: string;
  onUsernameChange: (username: string) => void;
  onExit: () => void;
  onClose: () => void;
}

export function GameMenu({ username, onUsernameChange, onExit, onClose }: GameMenuProps) {
  const [inputValue, setInputValue] = useState(username);

  const handleSave = useCallback(() => {
    if (inputValue.trim() && inputValue !== username) {
      onUsernameChange(inputValue.trim());
    }
  }, [inputValue, username, onUsernameChange]);

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md z-50">
      <div className="relative bg-gradient-to-br from-zinc-900/95 to-black/95 border border-cyan-500/30 rounded-2xl p-8 max-w-md w-full shadow-2xl">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-black bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            GAME MENU
          </h2>
        </div>

        <div className="space-y-4">
          <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700">
            <label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">
              Username
            </label>
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                className="flex-1 px-3 py-2 bg-black/50 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 text-sm"
                maxLength={20}
              />
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition-all text-sm"
              >
                Save
              </button>
            </div>
          </div>

          <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700">
            <div className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2">
              Controls
            </div>
            <div className="space-y-1.5 text-sm">
              {[
                { key: 'WASD', action: 'Move' },
                { key: 'Mouse', action: 'Look around' },
                { key: 'LMB', action: 'Use item / Shoot' },
                { key: 'RMB', action: 'Place block' },
                { key: 'R', action: 'Reload' },
                { key: '1-9', action: 'Select hotbar slot' },
                { key: 'B', action: 'Emote wheel' },
                { key: 'I', action: 'Inventory' },
                { key: 'ESC', action: 'Menu' },
              ].map(({ key, action }) => (
                <div key={key} className="flex justify-between items-center">
                  <kbd className="px-2 py-0.5 bg-zinc-700 rounded text-white font-mono text-xs">
                    {key}
                  </kbd>
                  <span className="text-zinc-300 text-xs">{action}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-all border border-zinc-700/50 font-semibold"
            >
              Resume
            </button>
            <button
              onClick={onExit}
              className="flex-1 py-3 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-xl transition-all border border-red-500/50 font-semibold"
            >
              Exit Game
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}