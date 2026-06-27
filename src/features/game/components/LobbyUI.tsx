//src\features\game\components\LobbyUI.tsx
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
            <div className="absolute top-8 left-8 bg-black/80 backdrop-blur px-6 py-4 rounded-lg border border-cyan-500/30">
                <div className="text-cyan-400 text-xl font-bold mb-3">PLAYER PROFILE</div>
                <div className="space-y-2">
                    <label className="text-zinc-400 text-sm">Username:</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyPress={handleKeyPress}
                            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white focus:outline-none focus:border-cyan-500 w-48"
                            maxLength={20}
                            placeholder="Enter username"
                        />
                        <button
                            onClick={handleUsernameChange}
                            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded transition-colors"
                        >
                            Save
                        </button>
                    </div>
                    <div className="text-zinc-500 text-xs">Press Enter or click Save to update</div>
                </div>
            </div>

            <div className="absolute top-8 right-8 bg-black/80 backdrop-blur px-6 py-4 rounded-lg border border-cyan-500/30">
                <div className="text-cyan-400 text-xl font-bold mb-3">CONTROLS</div>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-8">
                        <span className="text-zinc-400">Move:</span>
                        <span className="text-white font-bold">W A S D</span>
                    </div>
                    <div className="flex justify-between gap-8">
                        <span className="text-zinc-400">Look around:</span>
                        <span className="text-white font-bold">Mouse</span>
                    </div>
                    <div className="flex justify-between gap-8">
                        <span className="text-zinc-400">Interact:</span>
                        <span className="text-white font-bold">E</span>
                    </div>
                    <div className="flex justify-between gap-8">
                        <span className="text-zinc-400">Leave queue:</span>
                        <span className="text-white font-bold">Q</span>
                    </div>
                    <div className="flex justify-between gap-8">
                        <span className="text-zinc-400">Exit lobby:</span>
                        <span className="text-white font-bold">ESC</span>
                    </div>
                </div>
            </div>

            <div className="absolute bottom-8 right-8 bg-black/80 backdrop-blur px-6 py-4 rounded-lg border border-cyan-500/30">
                <div className="text-cyan-400 text-xl font-bold mb-3">GAME MODES</div>
                <div className="space-y-3">
                    <div className="flex items-center justify-between gap-6">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                            <span className="text-white font-bold">5 vs 5</span>
                        </div>
                        <span className="text-cyan-400 font-bold">{queues['5v5'].count}/{queues['5v5'].max}</span>
                    </div>
                    <div className="flex items-center justify-between gap-6">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                            <span className="text-white font-bold">FFA</span>
                        </div>
                        <span className="text-cyan-400 font-bold">{queues['ffa'].count}/{queues['ffa'].max}</span>
                    </div>
                </div>
            </div>

            <div className="absolute bottom-8 left-8 bg-black/80 backdrop-blur px-6 py-4 rounded-lg border border-cyan-500/30">
                <div className="text-cyan-400 text-xl font-bold mb-2">PLAYERS ONLINE</div>
                <div className="text-white text-3xl font-bold">{playersCount}</div>
            </div>

            <div className="absolute bottom-32 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur px-6 py-3 rounded-lg border border-cyan-500/30">
                <div className="text-cyan-400 text-lg font-bold text-center">Walk to the portal and press E to queue</div>
            </div>
        </>
    );
}