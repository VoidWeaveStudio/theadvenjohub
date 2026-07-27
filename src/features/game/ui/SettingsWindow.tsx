// src/features/game/ui/SettingsWindow.tsx
"use client";

import { useState } from "react";
import { Settings, Info, Keyboard, TriangleAlert } from "lucide-react";
import { WindowFrame } from "./shell/WindowFrame";

type SettingsTab = "controls" | "about";

interface SettingsWindowProps {
    isOpen: boolean;
    onClose: () => void;
    onTeleportToSafeZone?: () => void;
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

export function SettingsWindow({ isOpen, onClose, onTeleportToSafeZone }: SettingsWindowProps) {
    const [activeTab, setActiveTab] = useState<SettingsTab>("controls");

    return (
        <WindowFrame
            isOpen={isOpen}
            onClose={onClose}
            title="Settings"
            icon={<Settings className="w-4 h-4" />}
            size="md"
            tabs={[
                { id: "controls", label: "Controls", icon: <Keyboard className="w-3.5 h-3.5" /> },
                { id: "about", label: "About", icon: <Info className="w-3.5 h-3.5" /> },
            ]}
            activeTab={activeTab}
            onTabChange={(id) => setActiveTab(id as SettingsTab)}
            footer={
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
