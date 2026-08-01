// src/features/game/ui/SettingsWindow.tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { Info, Keyboard, TriangleAlert, LifeBuoy } from "lucide-react";
import { WindowFrame } from "./shell/WindowFrame";

type SettingsTab = "controls" | "about";

interface SettingsWindowProps {
    isOpen: boolean;
    onClose: () => void;
    onTeleportToSafeZone?: () => void;
    onOpenSupport?: () => void;
}

const KEYBINDS: [string, string][] = [
    ["WASD", "Movement"],
    ["Shift", "Sprint"],
    ["Space", "Jump"],
    ["Mouse", "Look Around"],
    ["Left Click", "Shoot"],
    ["R", "Reload"],
    ["E", "Interact"],
    ["I", "Inventory"],
    ["L", "Social Menu"],
    ["G (Hold)", "Voice Chat"],
    ["Esc", "Toggle Pointer Lock"],
];

export function SettingsWindow({ isOpen, onClose, onTeleportToSafeZone, onOpenSupport }: SettingsWindowProps) {
    const [activeTab, setActiveTab] = useState<SettingsTab>("controls");

    return (
        <WindowFrame
            isOpen={isOpen}
            onClose={onClose}
            title="Settings"
            icon={
                <Image
                    src="/icons/topmenu/settings-v2.webp"
                    alt=""
                    width={100}
                    height={200}
                    className="h-11 w-auto object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
                />
            }
            size="md"
            tabs={[
                { id: "controls", label: "Controls", icon: <Keyboard className="w-3.5 h-3.5" /> },
                { id: "about", label: "About", icon: <Info className="w-3.5 h-3.5" /> },
            ]}
            activeTab={activeTab}
            onTabChange={(id) => setActiveTab(id as SettingsTab)}
            footer={
                <div className="space-y-2">
                    <button
                        onClick={() => {
                            onTeleportToSafeZone?.();
                            onClose();
                        }}
                        className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold py-3 rounded-lg shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-2 group border border-orange-400/30"
                    >
                        <TriangleAlert className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        <span>I&apos;m Stuck (Teleport to SafeZone)</span>
                    </button>
                    <button
                        onClick={() => {
                            onOpenSupport?.();
                            onClose();
                        }}
                        className="w-full bg-gradient-to-r from-[#4FD1FF] to-[#3B9FD9] hover:brightness-110 text-[rgba(12,12,14,0.9)] font-bold py-3 rounded-lg shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 group border border-cyan-400/30"
                    >
                        <LifeBuoy className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        <span>Contact Support</span>
                    </button>
                </div>
            }
        >
            {activeTab === "controls" && (
                <div className="space-y-1">
                    {KEYBINDS.map(([key, action], index) => (
                        <div
                            key={key}
                            className={`flex justify-between items-center py-3 px-3 rounded-lg ${index % 2 === 0 ? "bg-[rgba(255,255,255,0.02)]" : ""}`}
                        >
                            <span className="text-[#E5E7EB] font-medium text-sm">{action}</span>
                            <kbd className="bg-[rgba(79,209,255,0.15)] border border-[rgba(79,209,255,0.3)] px-3 py-1.5 rounded-md text-[#4FD1FF] font-bold text-xs">
                                {key}
                            </kbd>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === "about" && (
                <div className="space-y-4">
                    <p className="text-[#E5E7EB] leading-relaxed font-medium text-sm">
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
        </WindowFrame>
    );
}
