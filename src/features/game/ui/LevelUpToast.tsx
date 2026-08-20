// src/features/game/ui/LevelUpToast.tsx
"use client";

import { useEffect } from "react";
import { ChevronsUp, Sparkles, Swords } from "lucide-react";
import { LevelUpData } from "../network/NetworkManager";
import { TIERS, MEME_ABILITIES_BY_ID, WEAPON_TIERS } from "../data/progression";
import { SoundManager } from "../core/SoundManager";
import { useLanguage } from "@/core/i18n/LanguageContext";

interface LevelUpToastProps {
    event: LevelUpData | null;
    onDismiss: () => void;
}

const TIERS_BY_ID = new Map(TIERS.map((t) => [t.id, t]));
const WEAPON_TIERS_BY_INDEX = new Map(WEAPON_TIERS.map((t) => [t.tier, t]));

export function LevelUpToast({ event, onDismiss }: LevelUpToastProps) {
    const { t } = useLanguage();
    useEffect(() => {
        if (event) SoundManager.getInstance().play("modal-open");
    }, [event]);

    if (!event) return null;

    const tier = TIERS_BY_ID.get(event.tier);
    const accent = tier?.accent ?? "#4FD1FF";
    const memeAbility = event.newMemeAbility ? MEME_ABILITIES_BY_ID.get(event.newMemeAbility) : null;
    const weaponTier = event.weaponTierChanged ? WEAPON_TIERS_BY_INDEX.get(event.weaponTier) : null;

    return (
        <div className="pointer-events-auto font-oxanium" onClick={onDismiss}>
            <div
                className="bg-[rgba(12,12,14,0.92)] backdrop-blur-md border rounded-[12px] px-6 py-4 min-w-[280px] cursor-pointer"
                style={{ borderColor: `${accent}66`, boxShadow: `0 0 30px ${accent}22` }}
            >
                <div className="flex items-center gap-3">
                    <ChevronsUp className="w-6 h-6" style={{ color: accent }} />
                    <div>
                        <div className="text-[#E5E7EB] text-lg font-black tracking-wider leading-none">
                            LEVEL {event.level}
                        </div>
                        <div className="text-[#8B8F98] text-[11px] mt-1">
                            {event.skillPoints} skill point{event.skillPoints === 1 ? "" : "s"} available — press K
                        </div>
                    </div>
                </div>

                {event.tierChanged && (
                    <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2">
                        <span className="text-xl leading-none">{tier?.emoji}</span>
                        <span className="text-sm font-bold" style={{ color: accent }}>
                            {event.tierName} tier reached
                        </span>
                    </div>
                )}

                {memeAbility && (
                    <div className="mt-2 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#FFD166]" />
                        <span className="text-[#FFD166] text-xs font-bold">{memeAbility.name} unlocked</span>
                    </div>
                )}

                {weaponTier && (
                    <div className="mt-2 flex items-center gap-2">
                        <Swords className="w-4 h-4 text-[#7FE6CF]" />
                        <span className="text-[#7FE6CF] text-xs font-bold">Weapon upgraded to tier {weaponTier.tier}</span>
                    </div>
                )}

                {event.branchUnlocked && (
                    <div className="mt-3 pt-3 border-t border-white/10 text-[#4FD1FF] text-xs font-bold">
                        {t("g.notify.branchUnlocked")}
                    </div>
                )}
            </div>
        </div>
    );
}
