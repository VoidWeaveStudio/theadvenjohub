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
            <div className="absolute top-8 left-8 bg-gradient-to-br from-black/90 via-zinc-900/90 to-black/90 backdrop-blur-xl px-6 py-5 rounded-2xl border border-cyan-500/30 shadow-2xl shadow-cyan-500/10 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5" />
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
                
                <div className="relative">
                    <div className="text-cyan-400 text-xl font-black mb-3 flex items-center gap-2">
                        <span className="text-2xl">👤</span>
                        <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                            PLAYER PROFILE
                        </span>
                    </div>
                    <div className="space-y-2">
                        <label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Username:</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyPress={handleKeyPress}
                                className="px-3 py-2 bg-black/50 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 focus:shadow-lg focus:shadow-cyan-500/20 w-48 transition-all font-semibold"
                                maxLength={20}
                                placeholder="Enter username"
                            />
                            <button
                                onClick={handleUsernameChange}
                                className="px-4 py-2 bg-gradient-to-br from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 text-white font-bold rounded-lg transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50"
                            >
                                Save
                            </button>
                        </div>
                        <div className="text-zinc-500 text-xs">Press Enter or click Save</div>
                    </div>
                </div>
            </div>

            <div className="absolute top-8 right-8 bg-gradient-to-br from-black/90 via-zinc-900/90 to-black/90 backdrop-blur-xl px-6 py-5 rounded-2xl border border-cyan-500/30 shadow-2xl shadow-cyan-500/10 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5" />
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
                
                <div className="relative">
                    <div className="text-cyan-400 text-xl font-black mb-3 flex items-center gap-2">
                        <span className="text-2xl">🎮</span>
                        <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                            CONTROLS
                        </span>
                    </div>
                    <div className="space-y-2.5 text-sm">
                        {[
                            { label: 'Move', keys: ['W', 'A', 'S', 'D'] },
                            { label: 'Look around', value: 'Mouse' },
                            { label: 'Interact (Portal)', keys: ['E'] },
                            { label: 'Leave queue', keys: ['Q'] },
                            { label: 'Exit lobby', keys: ['ESC'] }
                        ].map((control, i) => (
                            <div key={i} className="flex justify-between gap-12 items-center">
                                <span className="text-zinc-400 font-semibold">{control.label}:</span>
                                {control.keys ? (
                                    <div className="flex gap-1">
                                        {control.keys.map(k => (
                                            <kbd key={k} className="px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-white font-mono text-xs shadow-lg">
                                                {k}
                                            </kbd>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-white font-bold">{control.value}</span>
                                )}
                            </div>
                        ))}
                        <div className="border-t border-zinc-700/50 pt-2 mt-2">
                            <div className="text-zinc-500 text-xs italic">Click anywhere to capture mouse</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="absolute bottom-8 right-8 bg-gradient-to-br from-black/90 via-zinc-900/90 to-black/90 backdrop-blur-xl px-6 py-5 rounded-2xl border border-cyan-500/30 shadow-2xl shadow-cyan-500/10 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5" />
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
                
                <div className="relative">
                    <div className="text-cyan-400 text-xl font-black mb-3 flex items-center gap-2">
                        <span className="text-2xl">⚔️</span>
                        <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                            GAME MODES
                        </span>
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between gap-6 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50 animate-pulse" />
                                <span className="text-white font-black">5 vs 5</span>
                            </div>
                            <span className="text-cyan-400 font-black font-mono text-lg">
                                {queues['5v5'].count}<span className="text-zinc-500">/{queues['5v5'].max}</span>
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-6 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500 shadow-lg shadow-red-500/50 animate-pulse" />
                                <span className="text-white font-black">FFA</span>
                            </div>
                            <span className="text-cyan-400 font-black font-mono text-lg">
                                {queues['ffa'].count}<span className="text-zinc-500">/{queues['ffa'].max}</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="absolute bottom-8 left-8 bg-gradient-to-br from-black/90 via-zinc-900/90 to-black/90 backdrop-blur-xl px-6 py-5 rounded-2xl border border-cyan-500/30 shadow-2xl shadow-cyan-500/10 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5" />
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
                
                <div className="relative">
                    <div className="text-cyan-400 text-sm font-black mb-2 flex items-center gap-2 uppercase tracking-wider">
                        <span className="text-xl">🌐</span>
                        <span>Players Online</span>
                    </div>
                    <div className="text-white text-5xl font-black drop-shadow-lg bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                        {playersCount}
                    </div>
                </div>
            </div>

            <div className="absolute bottom-32 left-1/2 -translate-x-1/2 bg-gradient-to-r from-black/90 via-zinc-900/90 to-black/90 backdrop-blur-xl px-8 py-3 rounded-2xl border border-cyan-500/30 shadow-2xl shadow-cyan-500/10">
                <div className="text-cyan-400 text-lg font-black text-center flex items-center gap-3">
                    <span className="text-2xl">🌀</span>
                    <span>
                        Walk to the portal and press{' '}
                        <kbd className="px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-white font-mono shadow-lg">E</kbd>
                        {' '}to queue
                    </span>
                </div>
            </div>
        </>
    );
}