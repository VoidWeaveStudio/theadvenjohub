// src/features/game/ui/FactionUpgradesPanel.tsx
"use client";

import { Sparkles } from "lucide-react";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { FactionDetail } from "../network/NetworkManager";
import { FactionHeader } from "./FactionHeader";
import { CopyableText } from "./shell/CopyableText";
import { PurchaseButton } from "@/features/shared/PurchaseButton";

interface FactionUpgradesPanelProps {
    faction: FactionDetail;
    myWallet: string;
    onPurchased: () => void;
}

const PROMO_CODE_PRICE_TNJ = 1_000_000;

export function FactionUpgradesPanel({ faction, myWallet, onPurchased }: FactionUpgradesPanelProps) {
    const { t } = useLanguage();
    const canManage = faction.founderWallet === myWallet || faction.verifiedCreatorWallet === myWallet;

    return (
        <div className="space-y-4">
            <FactionHeader faction={faction} />

            <div className="bg-[rgba(255,255,255,0.03)] border border-white/10 rounded-lg p-6 space-y-3">
                <div className="flex items-center gap-2 text-[#E5E7EB] font-bold">
                    <Sparkles className="w-4 h-4 text-[#FFD166]" />
                    {t("g.faction.promoCode")}
                </div>

                {faction.promoCode ? (
                    <div className="space-y-2">
                        <p className="text-[#8B8F98] text-xs">
                            {t("g.factionUp.promoShare")}
                        </p>
                        <div className="bg-[rgba(255,209,102,0.08)] border border-[rgba(255,209,102,0.25)] rounded-lg px-4 py-3">
                            <CopyableText value={faction.promoCode} className="text-[#FFD166] text-lg font-bold tracking-widest" />
                        </div>
                    </div>
                ) : canManage ? (
                    <div className="space-y-2">
                        <p className="text-[#8B8F98] text-xs">
                            {t("g.factionUp.promoUnlock")}
                        </p>
                        <PurchaseButton factionId={faction.id} price={PROMO_CODE_PRICE_TNJ} onSuccess={onPurchased} />
                    </div>
                ) : (
                    <p className="text-[#8B8F98] text-sm text-center py-4">
                        {t("g.factionUp.promoWaiting")}
                    </p>
                )}
            </div>
        </div>
    );
}
