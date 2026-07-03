//src\features\game\ui\Menu.tsx
"use client";

import { useState } from "react";

interface MenuProps {
    isOpen: boolean;
    onClose: () => void;
    nickname: string;
    onNicknameChange: (nickname: string) => void;
}

export function Menu({ isOpen, onClose, nickname, onNicknameChange }: MenuProps) {
    const [editNickname, setEditNickname] = useState(false);
    const [tempNickname, setTempNickname] = useState(nickname);
    const [tab, setTab] = useState<"main" | "controls" | "about">("main");

    if (!isOpen) return null;

    const handleSaveNickname = () => {
        if (tempNickname.trim().length > 0) {
            onNicknameChange(tempNickname.trim());
        }
        setEditNickname(false);
    };

    return (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 pointer-events-auto">
            <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-700 rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl">
                <div className="text-center mb-6">
                    <h2 className="text-4xl font-black bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                        TANJO World
                    </h2>
                    <p className="text-zinc-400 text-sm mt-1">Game Menu</p>
                </div>

                <div className="flex gap-1 mb-6 bg-zinc-800/50 p-1 rounded-lg">
                    {(["main", "controls", "about"] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium capitalize transition-all ${tab === t ? "bg-cyan-500/20 text-cyan-300" : "text-zinc-400 hover:text-white"
                                }`}
                        >
                            {t}
                        </button>
                    ))}
                </div>

                {tab === "main" && (
                    <div className="space-y-4">
                        <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700">
                            <h3 className="text-white font-bold mb-3">Nickname</h3>
                            {editNickname ? (
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={tempNickname}
                                        onChange={(e) => setTempNickname(e.target.value.slice(0, 20))}
                                        onKeyDown={(e) => e.key === "Enter" && handleSaveNickname()}
                                        autoFocus
                                        className="flex-1 bg-zinc-900 text-white px-3 py-2 rounded border border-zinc-700 focus:border-cyan-500 outline-none"
                                    />
                                    <button
                                        onClick={handleSaveNickname}
                                        className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded font-medium"
                                    >
                                        Save
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between">
                                    <span className="text-white text-lg">{nickname}</span>
                                    <button
                                        onClick={() => {
                                            setTempNickname(nickname);
                                            setEditNickname(true);
                                        }}
                                        className="text-cyan-400 hover:text-cyan-300 text-sm"
                                    >
                                        Change
                                    </button>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={onClose}
                            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-3 rounded-lg shadow-lg transition-all"
                        >
                            ▶ Close Menu
                        </button>
                    </div>
                )}

                {tab === "controls" && (
                    <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700">
                        <div className="space-y-2 text-sm">
                            {[
                                ["WASD", "Move"],
                                ["Shift", "Sprint"],
                                ["Mouse", "Look around"],
                                ["Left Click", "Shoot"],
                                ["R", "Reload"],
                                ["E", "Interact"],
                                ["Esc", "Menu"],
                            ].map(([key, action]) => (
                                <div key={key} className="flex justify-between items-center py-1.5 border-b border-zinc-700/50 last:border-0">
                                    <span className="text-zinc-300">{action}</span>
                                    <kbd className="bg-zinc-900 px-2.5 py-1 rounded text-cyan-300 font-mono text-xs border border-zinc-700">
                                        {key}
                                    </kbd>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {tab === "about" && (
                    <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700 space-y-3">
                        <p className="text-zinc-300 leading-relaxed">
                            TANJO World is a multiplayer online web game. Explore the world, battle other players, and participate in events.
                        </p>
                        <p className="text-zinc-400 text-sm">
                            You spawn in a safe zone around the crystal. Step outside to engage in combat.
                        </p>
                        <div className="pt-2 text-xs text-zinc-500">Version 0.1.0</div>
                    </div>
                )}
            </div>
        </div>
    );
}