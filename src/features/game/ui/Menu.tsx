// src/features/game/ui/Menu.tsx
"use client";

import { useState } from "react";
import { X, Settings, Info, Save, ChevronRight, Keyboard, TriangleAlert, Castle } from "lucide-react";

interface MenuProps {
    isOpen: boolean;
    onClose: () => void;
    nickname: string;
    onNicknameChange: (nickname: string) => void;
    onTeleportToSafeZone?: () => void;
    onTeleportToTower?: () => void;
}

export function Menu({ isOpen, onClose, nickname, onNicknameChange, onTeleportToSafeZone, onTeleportToTower }: MenuProps) {
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
        <div className="absolute inset-0 bg-[rgba(6,6,8,0.92)] backdrop-blur-md flex items-center justify-center z-50 pointer-events-auto font-oxanium">
            <div className="bg-[rgba(12,12,14,0.85)] border border-[rgba(255,255,255,0.08)] rounded-[16px] p-8 max-w-lg w-full mx-4 shadow-2xl">
                <div className="text-center mb-8">
                    <h2 className="text-5xl font-black bg-gradient-to-r from-[#4FD1FF] to-[#3B82F6] bg-clip-text text-transparent">
                        TANJO World
                    </h2>
                    <p className="text-[#8B8F98] text-sm mt-2 font-medium">Game Menu</p>
                </div>

                <div className="flex gap-1 mb-8 bg-[rgba(255,255,255,0.03)] p-1 rounded-[10px]">
                    {[
                        { id: "main" as const, icon: ChevronRight, label: "Main" },
                        { id: "controls" as const, icon: Keyboard, label: "Controls" },
                        { id: "about" as const, icon: Info, label: "About" },
                    ].map(({ id, icon: Icon, label }) => (
                        <button
                            key={id}
                            onClick={() => setTab(id)}
                            className={`
                                flex-1 py-2.5 px-4 rounded-[8px] text-sm font-bold capitalize 
                                flex items-center justify-center gap-2
                                transition-all duration-200
                                ${tab === id
                                    ? "bg-[rgba(79,209,255,0.15)] text-[#4FD1FF] border border-[rgba(79,209,255,0.3)]"
                                    : "text-[#8B8F98] hover:text-[#E5E7EB] hover:bg-[rgba(255,255,255,0.05)]"
                                }
                            `}
                        >
                            <Icon className="w-4 h-4" />
                            {label}
                        </button>
                    ))}
                </div>

                {tab === "main" && (
                    <div className="space-y-5">
                        <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] rounded-[10px] p-5">
                            <h3 className="text-[#E5E7EB] font-bold mb-4 text-sm tracking-wider">NICKNAME</h3>
                            {editNickname ? (
                                <div className="flex gap-3">
                                    <input
                                        type="text"
                                        value={tempNickname}
                                        onChange={(e) => setTempNickname(e.target.value.slice(0, 20))}
                                        onKeyDown={(e) => e.key === "Enter" && handleSaveNickname()}
                                        autoFocus
                                        className="flex-1 bg-[rgba(255,255,255,0.05)] text-[#E5E7EB] px-4 py-3 rounded-[8px] border border-[rgba(255,255,255,0.1)] focus:border-[#4FD1FF] outline-none font-medium transition-colors"
                                        placeholder="Enter nickname..."
                                    />
                                    <button
                                        onClick={handleSaveNickname}
                                        className="bg-[#4ADE80] hover:bg-[#4ADE80]/90 text-[rgba(12,12,14,0.9)] px-6 py-3 rounded-[8px] font-bold flex items-center gap-2 transition-all"
                                    >
                                        <Save className="w-4 h-4" />
                                        Save
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between">
                                    <span className="text-[#E5E7EB] text-xl font-bold">{nickname}</span>
                                    <button
                                        onClick={() => {
                                            setTempNickname(nickname);
                                            setEditNickname(true);
                                        }}
                                        className="text-[#4FD1FF] hover:text-[#4FD1FF]/80 text-sm font-bold transition-colors"
                                    >
                                        Change
                                    </button>
                                </div>
                            )}
                        </div>

                        {onTeleportToTower && (
                            <button
                                onClick={() => {
                                    onTeleportToTower();
                                    onClose();
                                }}
                                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-4 rounded-[10px] shadow-lg shadow-purple-500/20 transition-all flex items-center justify-center gap-2 group border border-purple-400/30"
                            >
                                <Castle className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                <span>Teleport to Tower</span>
                            </button>
                        )}

                        <button
                            onClick={() => {
                                onTeleportToSafeZone?.();
                                onClose();
                            }}
                            className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold py-4 rounded-[10px] shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-2 group border border-orange-400/30"
                        >
                            <TriangleAlert className="w-5 h-5 group-hover:scale-110 transition-transform" />
                            <span>I'm Stuck (Teleport to SafeZone)</span>
                        </button>

                        <button
                            onClick={onClose}
                            className="w-full bg-gradient-to-r from-[#4FD1FF] to-[#3B82F6] hover:from-[#4FD1FF]/90 hover:to-[#3B82F6]/90 text-white font-bold py-4 rounded-[10px] shadow-lg shadow-[#4FD1FF]/20 transition-all flex items-center justify-center gap-2 group"
                        >
                            <span>Close Menu</span>
                            <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                        </button>
                    </div>
                )}

                {tab === "controls" && (
                    <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] rounded-[10px] p-5">
                        <div className="space-y-1">
                            {[
                                ["WASD", "Movement"],
                                ["Shift", "Sprint"],
                                ["Space", "Jump"],
                                ["Mouse", "Look Around"],
                                ["Left Click", "Shoot"],
                                ["R", "Reload"],
                                ["E", "Interact"],
                                ["I", "Inventory"],
                                ["Esc", "Open Menu"],
                            ].map(([key, action], index) => (
                                <div
                                    key={key}
                                    className={`
                                        flex justify-between items-center py-3 px-3 rounded-[8px]
                                        ${index % 2 === 0 ? 'bg-[rgba(255,255,255,0.02)]' : ''}
                                    `}
                                >
                                    <span className="text-[#E5E7EB] font-medium">{action}</span>
                                    <kbd className="bg-[rgba(79,209,255,0.15)] border border-[rgba(79,209,255,0.3)] px-3 py-1.5 rounded-[6px] text-[#4FD1FF] font-bold text-xs">
                                        {key}
                                    </kbd>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {tab === "about" && (
                    <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] rounded-[10px] p-5 space-y-4">
                        <p className="text-[#E5E7EB] leading-relaxed font-medium">
                            TANJO World is a multiplayer online web game. Explore the world, battle other players, and participate in events.
                        </p>
                        <p className="text-[#8B8F98] text-sm leading-relaxed">
                            You spawn in a safe zone around the crystal. Step outside to engage in combat.
                        </p>
                        <div className="pt-3 border-t border-[rgba(255,255,255,0.08)]">
                            <div className="text-xs text-[#8B8F98] font-mono">Version 0.1.0</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}