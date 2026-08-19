// src/features/game/ui/TopMenu.tsx
"use client";

import Image from "next/image";
import { useLanguage } from "@/core/i18n/LanguageContext";

export type TopWindowId = "factions" | "quests" | "social" | "shop" | "leaderboards" | "settings";

interface TopMenuProps {
    active: TopWindowId | null;
    onSelect: (id: TopWindowId) => void;
    badges?: Partial<Record<TopWindowId, boolean>>;
}

const ITEMS: { id: TopWindowId; icon: string; labelKey: string }[] = [
    { id: "factions", icon: "/icons/topmenu/factions-v3.webp", labelKey: "g.menu.factions" },
    { id: "quests", icon: "/icons/topmenu/quests-v2.webp", labelKey: "g.menu.quests" },
    { id: "social", icon: "/icons/topmenu/social-v3.webp", labelKey: "g.menu.social" },
    { id: "shop", icon: "/icons/topmenu/shop-v2.webp", labelKey: "g.menu.shop" },
    { id: "leaderboards", icon: "/icons/topmenu/leaderboard-v2.webp", labelKey: "g.menu.leaderboards" },
    { id: "settings", icon: "/icons/topmenu/settings-v2.webp", labelKey: "g.menu.settings" },
];

export function TopMenu({ active, onSelect, badges }: TopMenuProps) {
    const { t } = useLanguage();

    return (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 pointer-events-auto font-oxanium select-none">
            <div className="flex items-start gap-5">
                {ITEMS.map(({ id, icon, labelKey }) => {
                    const label = t(labelKey);
                    return (
                    <button
                        key={id}
                        onClick={() => onSelect(id)}
                        title={label}
                        style={{ background: "transparent", border: "none", padding: 0, borderRadius: 0, boxShadow: "none" }}
                        className={`relative origin-top !bg-transparent !border-0 !p-0 !rounded-none !shadow-none transition-transform duration-200 ease-out hover:z-10 hover:!scale-[2] ${active === id ? "z-10 !scale-[2]" : "!scale-100"
                            }`}
                    >
                        <Image
                            src={icon}
                            alt={label}
                            width={100}
                            height={200}
                            className={`h-14 w-auto object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)] transition-[filter] duration-200 ${active === id
                                ? "brightness-125 drop-shadow-[0_0_14px_rgba(79,209,255,0.8)]"
                                : "hover:brightness-125 hover:drop-shadow-[0_0_14px_rgba(79,209,255,0.7)]"
                                }`}
                        />
                        {badges?.[id] && (
                            <span className="absolute top-0 right-1 w-3 h-3 rounded-full bg-[#FF4D4F] ring-2 ring-[rgba(10,14,20,0.9)]" />
                        )}
                    </button>
                    );
                })}
            </div>
        </div>
    );
}
