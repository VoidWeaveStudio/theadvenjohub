// src/features/game/components/LobbyUI.tsx
"use client";

import { useState } from "react";

interface LobbyUIProps {
    username: string;
    onUsernameChange: (username: string) => void;
    playersCount: number;
    queues: { '5v5': { count: number; max: number }; 'ffa': { count: number; max: number } };
}

export function LobbyUI({ username, onUsernameChange, playersCount, queues }: LobbyUIProps) {
    const [inputValue, setInputValue] = useState(username);

    const handleUsernameChange = () => {
        if (inputValue.trim() && inputValue !== username) {
            onUsernameChange(inputValue.trim());
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleUsernameChange();
        }
    };

    return (
        <>
            <div className="absolute top-8 left-8 bg-black/80 backdrop-blur-md px-6 py-4 rounded-xl border border-cyan-500/30 shadow-2xl">
                <div className="text-cyan-400 text-xl font-bold mb-3 flex items-center gap-2">
                    <span>👤</span>
                    <span>PLAYER PROFILE</span>
                </div>
                <div className="space-y-2">
                    <label className="text-zinc-400 text-sm font-semibold">Username:</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyPress={handleKeyPress}
                            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 w-48 transition-colors"
                            maxLength={20}
                            placeholder="Enter username"
                        />
                        <button
                            onClick={handleUsernameChange}
                            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg transition-colors"
                        >
                            Save
                        </button>
                    </div>
                    <div className="text-zinc-500 text-xs">Press Enter or click Save to update</div>
                </div>
            </div>

            <div className="absolute top-8 right-8 bg-black/80 backdrop-blur-md px-6 py-4 rounded-xl border border-cyan-500/30 shadow-2xl">
                <div className="text-cyan-400 text-xl font-bold mb-3 flex items-center gap-2">
                    <span>🎮</span>
                    <span>CONTROLS</span>
                </div>
                <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between gap-12">
                        <span className="text-zinc-400">Move:</span>
                        <div className="flex gap-1">
                            <kbd className="px-2 py-0.5 bg-zinc-700 rounded text-white font-mono text-xs">W</kbd>
                            <kbd className="px-2 py-0.5 bg-zinc-700 rounded text-white font-mono text-xs">A</kbd>
                            <kbd className="px-2 py-0.5 bg-zinc-700 rounded text-white font-mono text-xs">S</kbd>
                            <kbd className="px-2 py-0.5 bg-zinc-700 rounded text-white font-mono text-xs">D</kbd>
                        </div>
                    </div>
                    <div className="flex justify-between gap-12">
                        <span className="text-zinc-400">Look around:</span>
                        <span className="text-white font-bold">Mouse</span>
                    </div>
                    <div className="flex justify-between gap-12">
                        <span className="text-zinc-400">Interact (Portal):</span>
                        <kbd className="px-2 py-0.5 bg-zinc-700 rounded text-white font-mono text-xs">E</kbd>
                    </div>
                    <div className="flex justify-between gap-12">
                        <span className="text-zinc-400">Leave queue:</span>
                        <kbd className="px-2 py-0.5 bg-zinc-700 rounded text-white font-mono text-xs">Q</kbd>
                    </div>
                    <div className="flex justify-between gap-12">
                        <span className="text-zinc-400">Exit lobby:</span>
                        <kbd className="px-2 py-0.5 bg-zinc-700 rounded text-white font-mono text-xs">ESC</kbd>
                    </div>
                    <div className="border-t border-zinc-700 pt-2 mt-2">
                        <div className="text-zinc-500 text-xs italic">Click anywhere to capture mouse</div>
                    </div>
                </div>
            </div>

            <div className="absolute bottom-8 right-8 bg-black/80 backdrop-blur-md px-6 py-4 rounded-xl border border-cyan-500/30 shadow-2xl">
                <div className="text-cyan-400 text-xl font-bold mb-3 flex items-center gap-2">
                    <span>⚔️</span>
                    <span>GAME MODES</span>
                </div>
                <div className="space-y-3">
                    <div className="flex items-center justify-between gap-6">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50"></div>
                            <span className="text-white font-bold">5 vs 5</span>
                        </div>
                        <span className="text-cyan-400 font-bold font-mono">{queues['5v5'].count}/{queues['5v5'].max}</span>
                    </div>
                    <div className="flex items-center justify-between gap-6">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500 shadow-lg shadow-red-500/50"></div>
                            <span className="text-white font-bold">FFA</span>
                        </div>
                        <span className="text-cyan-400 font-bold font-mono">{queues['ffa'].count}/{queues['ffa'].max}</span>
                    </div>
                </div>
            </div>

            <div className="absolute bottom-8 left-8 bg-black/80 backdrop-blur-md px-6 py-4 rounded-xl border border-cyan-500/30 shadow-2xl">
                <div className="text-cyan-400 text-xl font-bold mb-2 flex items-center gap-2">
                    <span>🌐</span>
                    <span>PLAYERS ONLINE</span>
                </div>
                <div className="text-white text-4xl font-bold drop-shadow-lg">{playersCount}</div>
            </div>

            <div className="absolute bottom-32 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md px-6 py-3 rounded-xl border border-cyan-500/30 shadow-2xl">
                <div className="text-cyan-400 text-lg font-bold text-center flex items-center gap-2">
                    <span>🚪</span>
                    <span>Walk to the portal and press <kbd className="px-2 py-0.5 bg-zinc-700 rounded text-white font-mono">E</kbd> to queue</span>
                </div>
            </div>
        </>
    );
}