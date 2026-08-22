// src/features/game/ui/SettingsWindow.tsx
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Info, Keyboard, TriangleAlert, LifeBuoy, MonitorCog } from "lucide-react";
import { WindowFrame } from "./shell/WindowFrame";
import { GraphicsTab } from "./GraphicsTab";
import { useLanguage } from "@/core/i18n/LanguageContext";

type SettingsTab = "controls" | "graphics" | "about";

interface SettingsWindowProps {
    isOpen: boolean;
    onClose: () => void;
    onTeleportToSafeZone?: () => void;
    isInCombat?: boolean;
    stuckCooldownUntil?: number;
    onOpenSupport?: () => void;
}

function formatCooldown(ms: number): string {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes <= 0) return `${seconds}s`;
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

const KEYBIND_GROUPS: { titleKey: string; binds: [string, string][] }[] = [
    {
        titleKey: "g.keys.movement",
        binds: [
            ["WASD", "g.bind.move"],
            ["Shift", "g.bind.sprint"],
            ["Space", "g.bind.jump"],
            ["Ctrl", "g.bind.descend"],
            ["Mouse", "g.bind.look"],
        ],
    },
    {
        titleKey: "g.keys.combat",
        binds: [
            ["Left Click", "g.bind.shoot"],
            ["R", "g.bind.reload"],
            ["B", "g.bind.fireMode"],
            ["1 – 6", "g.bind.skillSlots"],
            ["K", "g.bind.skillTree"],
        ],
    },
    {
        titleKey: "g.keys.items",
        binds: [
            ["Q F", "g.bind.hotbar"],
            ["X", "g.bind.toolWheel"],
            ["C", "g.bind.emoteWheel"],
            ["V", "g.bind.degenWheel"],
            ["1 – 9", "g.bind.wheelPick"],
            ["I", "g.bind.inventory"],
        ],
    },
    {
        titleKey: "g.keys.world",
        binds: [
            ["E", "g.bind.interact"],
            ["L", "g.bind.socialMenu"],
            ["M", "g.bind.bubbleMap"],
            ["Enter", "g.bind.chat"],
            ["G (hold)", "g.bind.voice"],
            ["Esc", "g.bind.escape"],
        ],
    },
];

export function SettingsWindow({ isOpen, onClose, onTeleportToSafeZone, isInCombat = false, stuckCooldownUntil = 0, onOpenSupport }: SettingsWindowProps) {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<SettingsTab>("controls");
    const [cooldownLeft, setCooldownLeft] = useState(0);

    useEffect(() => {
        if (!isOpen) return;

        const tick = () => {
            const left = stuckCooldownUntil - Date.now();
            setCooldownLeft(left > 0 ? left : 0);
        };

        tick();
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, [isOpen, stuckCooldownUntil]);

    const stuckBlockedReason = isInCombat
        ? t("g.settings.stuckInCombat")
        : cooldownLeft > 0
            ? `${t("g.settings.stuckRecharging")} — ${formatCooldown(cooldownLeft)}`
            : null;

    return (
        <WindowFrame
            isOpen={isOpen}
            onClose={onClose}
            title={t("g.menu.settings")}
            icon={
                <Image
                    src="/icons/topmenu/settings-v2.webp"
                    alt=""
                    width={100}
                    height={200}
                    className="h-11 w-auto object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
                />
            }
            size="lg"
            tabs={[
                { id: "controls", label: t("g.settings.controls"), icon: <Keyboard className="w-3.5 h-3.5" /> },
                { id: "graphics", label: t("g.settings.graphics"), icon: <MonitorCog className="w-3.5 h-3.5" /> },
                { id: "about", label: t("g.settings.about"), icon: <Info className="w-3.5 h-3.5" /> },
            ]}
            activeTab={activeTab}
            onTabChange={(id) => setActiveTab(id as SettingsTab)}
            footer={
                <div className="space-y-2">
                    <button
                        disabled={stuckBlockedReason !== null}
                        onClick={() => {
                            onTeleportToSafeZone?.();
                            onClose();
                        }}
                        className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:from-white/10 disabled:to-white/10 disabled:text-white/40 disabled:border-white/10 disabled:shadow-none disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg shadow-lg shadow-orange-500/20 transition-all flex flex-col items-center justify-center gap-0.5 group border border-orange-400/30"
                    >
                        <span className="flex items-center gap-2">
                            <TriangleAlert className="w-4 h-4 group-enabled:group-hover:scale-110 transition-transform" />
                            <span>{t("g.settings.stuck")}</span>
                        </span>
                        <span className="text-[11px] font-normal opacity-70">
                            {stuckBlockedReason ?? t("g.settings.stuckHint")}
                        </span>
                    </button>
                    <button
                        onClick={() => {
                            onOpenSupport?.();
                            onClose();
                        }}
                        className="w-full bg-gradient-to-r from-[#4FD1FF] to-[#3B9FD9] hover:brightness-110 text-[rgba(12,12,14,0.9)] font-bold py-3 rounded-lg shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 group border border-cyan-400/30"
                    >
                        <LifeBuoy className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        <span>{t("g.settings.support")}</span>
                    </button>
                </div>
            }
        >
            {activeTab === "controls" && (
                <div className="space-y-4">
                    {KEYBIND_GROUPS.map((group) => (
                        <div key={group.titleKey}>
                            <div className="text-[#6B7280] text-[10px] font-black tracking-wider mb-1.5">
                                {t(group.titleKey).toUpperCase()}
                            </div>
                            <div className="space-y-0.5">
                                {group.binds.map(([key, actionKey], index) => (
                                    <div
                                        key={key}
                                        className={`flex justify-between items-center gap-3 py-2 px-3 rounded-lg ${index % 2 === 0 ? "bg-[rgba(255,255,255,0.02)]" : ""}`}
                                    >
                                        <span className="text-[#E5E7EB] font-medium text-[13px]">{t(actionKey)}</span>
                                        <kbd className="bg-[rgba(79,209,255,0.15)] border border-[rgba(79,209,255,0.3)] px-2.5 py-1 rounded-md text-[#4FD1FF] font-bold text-[11px] whitespace-nowrap flex-shrink-0">
                                            {key}
                                        </kbd>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === "graphics" && <GraphicsTab />}

            {activeTab === "about" && (
                <div className="space-y-4">
                    <p className="text-[#E5E7EB] leading-relaxed font-medium text-sm">
                        {t("g.about.intro")}
                    </p>
                    <p className="text-[#8B8F98] text-sm leading-relaxed">
                        {t("g.about.safeZone")}
                    </p>
                    <div className="pt-3 border-t border-[rgba(255,255,255,0.08)]">
                        <div className="text-xs text-[#8B8F98] font-mono">{t("g.about.version")} 0.1.0</div>
                    </div>
                </div>
            )}
        </WindowFrame>
    );
}
