// src/features/game/ui/AppearanceTab.tsx
"use client";

import { useEffect } from "react";
import { Shirt, Sparkles } from "lucide-react";
import { COSMETICS, CosmeticId } from "../data/cosmetics";
import { CosmeticStateData } from "../network/NetworkManager";
import { CosmeticCard } from "./CosmeticCard";
import { useLanguage } from "@/core/i18n/LanguageContext";

interface AppearanceTabProps {
    cosmetics: CosmeticStateData;
    onRequestCosmetics: () => void;
    onEquip: (skinId: CosmeticId | null, accessoryId: CosmeticId | null) => void;
}

export function AppearanceTab({ cosmetics, onRequestCosmetics, onEquip }: AppearanceTabProps) {
    const { t } = useLanguage();
    useEffect(() => {
        onRequestCosmetics();
    }, []);

    const owned = new Set(cosmetics.owned);
    const skins = COSMETICS.filter((c) => c.slot === "skin");
    const accessories = COSMETICS.filter((c) => c.slot === "accessory");
    const ownedSkins = skins.filter((c) => owned.has(c.id));
    const ownedAccessories = accessories.filter((c) => owned.has(c.id));
    const hasSkinEquipped = !!cosmetics.skinId;

    return (
        <div className="space-y-5">
            <p className="text-[#8B8F98] text-xs">
                Buy outfits from Alfredo in the Main Hall. A full skin replaces your whole look, so an accessory can only be
                worn while no full skin is equipped.
            </p>

            <div>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[#8B8F98] text-xs font-bold tracking-wider flex items-center gap-1.5">
                        <Shirt className="w-3.5 h-3.5" />
                        {t("g.appearance.fullSkins")}
                    </span>
                    {hasSkinEquipped && (
                        <button
                            onClick={() => onEquip(null, cosmetics.accessoryId)}
                            className="text-[#8B8F98] hover:text-[#E5E7EB] text-xs font-bold transition-colors"
                        >
                            {t("g.appearance.takeOff")}
                        </button>
                    )}
                </div>

                {ownedSkins.length === 0 ? (
                    <p className="text-[#6B7280] text-sm py-3">{t("g.appearance.noSkins")}</p>
                ) : (
                    <div className="space-y-2">
                        {ownedSkins.map((cosmetic) => (
                            <CosmeticCard
                                key={cosmetic.id}
                                cosmetic={cosmetic}
                                owned
                                equipped={cosmetics.skinId === cosmetic.id}
                                actionLabel="Equip"
                                onAction={() => onEquip(cosmetic.id, null)}
                            />
                        ))}
                    </div>
                )}
            </div>

            <div>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[#8B8F98] text-xs font-bold tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        {t("g.appearance.accessories")}
                    </span>
                    {cosmetics.accessoryId && (
                        <button
                            onClick={() => onEquip(cosmetics.skinId, null)}
                            className="text-[#8B8F98] hover:text-[#E5E7EB] text-xs font-bold transition-colors"
                        >
                            Take off accessory
                        </button>
                    )}
                </div>

                {ownedAccessories.length === 0 ? (
                    <p className="text-[#6B7280] text-sm py-3">{t("g.appearance.noAccessories")}</p>
                ) : (
                    <div className="space-y-2">
                        {ownedAccessories.map((cosmetic) => (
                            <CosmeticCard
                                key={cosmetic.id}
                                cosmetic={cosmetic}
                                owned
                                equipped={cosmetics.accessoryId === cosmetic.id}
                                blocked={hasSkinEquipped}
                                blockedReason={hasSkinEquipped ? t("g.appearance.takeOffFirst") : undefined}
                                actionLabel="Equip"
                                onAction={() => onEquip(null, cosmetic.id)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
