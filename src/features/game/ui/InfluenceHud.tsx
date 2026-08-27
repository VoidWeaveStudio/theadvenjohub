// src/features/game/ui/InfluenceHud.tsx
"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/core/i18n/LanguageContext";
import type { InfluenceCaptureData, InfluenceStateData } from "../network/NetworkManager";
import { INFLUENCE_LOCATION_ID } from "../world/locations/influence/InfluencePoint";

interface InfluenceHudProps {
    locationId: string;
    state: InfluenceStateData | null;
    capture: InfluenceCaptureData | null;
}

export function InfluenceHud({ locationId, state, capture }: InfluenceHudProps) {
    const { t } = useLanguage();
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (locationId !== INFLUENCE_LOCATION_ID) return;
        const timer = setInterval(() => setNow(Date.now()), 250);
        return () => clearInterval(timer);
    }, [locationId]);

    if (locationId !== INFLUENCE_LOCATION_ID || !state) return null;

    const fraction = Math.max(0, Math.min(1, state.crystalHealth / Math.max(1, state.crystalMaxHealth)));
    const sieging = state.phase === "siege" || state.phase === "collapse";
    const captureRemaining = capture ? Math.max(0, capture.until - now) : 0;
    const captureProgress = capture ? 1 - captureRemaining / Math.max(1, capture.duration) : 0;

    return (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 pointer-events-none font-oxanium flex flex-col items-center gap-2 w-[min(92vw,420px)]">
            <div className="w-full bg-[rgba(8,10,20,0.72)] border border-white/10 rounded-lg px-3 py-2 backdrop-blur-sm">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-wide mb-1">
                    <span className="text-[#9aa0ad]">
                        {state.ownerFactionName ?? t("g.influence.unclaimed")}
                    </span>
                    <span className={sieging ? "text-[#ff8a6b] font-bold" : "text-[#6fd8ff]"}>
                        {state.phase === "collapse"
                            ? t("g.influence.hudCollapse")
                            : state.phase === "siege"
                                ? t("g.influence.hudSiege", { wave: state.siegeWave })
                                : t("g.influence.hudCrystal")}
                    </span>
                </div>

                <div className="h-2 bg-black/60 rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-[width] duration-300 ${sieging
                            ? "bg-gradient-to-r from-[#ff5a48] to-[#ffb347]"
                            : "bg-gradient-to-r from-[#6fd8ff] to-[#9d6bff]"
                            }`}
                        style={{ width: `${fraction * 100}%` }}
                    />
                </div>
            </div>

            {capture && (
                <div className="w-full bg-[rgba(20,8,8,0.78)] border border-[#ff5a48]/40 rounded-lg px-3 py-2 backdrop-blur-sm">
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-wide mb-1">
                        <span className="text-[#ffd9a0] font-bold">{capture.factionName}</span>
                        <span className="text-[#ff8a8a]">
                            {capture.contested
                                ? t("g.influence.contested")
                                : `${Math.ceil(captureRemaining / 1000)}s`}
                        </span>
                    </div>
                    <div className="h-1.5 bg-black/60 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-[#ffb347] to-[#ff5a48]"
                            style={{ width: `${captureProgress * 100}%` }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
