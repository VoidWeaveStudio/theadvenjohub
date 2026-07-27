// src/features/game/ui/TopMenu.tsx
"use client";

import { Flag, Users, ShoppingBag, Trophy, Settings, LucideIcon } from "lucide-react";

export type TopWindowId = "factions" | "social" | "shop" | "leaderboards" | "settings";

interface TopMenuProps {
    active: TopWindowId | null;
    onSelect: (id: TopWindowId) => void;
}

const ITEMS: { id: TopWindowId; icon: LucideIcon; label: string }[] = [
    { id: "factions", icon: Flag, label: "Factions" },
    { id: "social", icon: Users, label: "Social" },
    { id: "shop", icon: ShoppingBag, label: "Shop" },
    { id: "leaderboards", icon: Trophy, label: "Leaderboards" },
    { id: "settings", icon: Settings, label: "Settings" },
];

export function TopMenu({ active, onSelect }: TopMenuProps) {
    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 pointer-events-auto font-oxanium select-none">
            <div className="flex items-center gap-1 bg-[rgba(10,14,20,0.85)] backdrop-blur-md border border-[rgba(79,209,255,0.15)] rounded-xl p-1.5 shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
                {ITEMS.map(({ id, icon: Icon, label }) => (
                    <button
                        key={id}
                        onClick={() => onSelect(id)}
                        title={label}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-all ${active === id
                            ? "bg-[rgba(79,209,255,0.18)] text-[#4FD1FF] border-[rgba(79,209,255,0.35)]"
                            : "text-[#8B8F98] hover:text-[#E5E7EB] hover:bg-[rgba(255,255,255,0.06)] border-transparent"
                            }`}
                    >
                        <Icon className="w-5 h-5" />
                    </button>
                ))}
            </div>
        </div>
    );
}
