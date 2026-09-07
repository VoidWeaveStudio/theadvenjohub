// src/features/game/ui/FactionUpgradesPanel.tsx
"use client";

import { Globe, Sparkles, Ticket } from "lucide-react";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { FactionDetail } from "../network/NetworkManager";
import { FactionHeader } from "./FactionHeader";
import { CopyableText } from "./shell/CopyableText";
import { PurchaseButton } from "@/features/shared/PurchaseButton";
import { useShopQuote } from "./hooks/useShopQuote";
import { factionPageUrl } from "@/core/lib/siteUrl";

interface FactionUpgradesPanelProps {
    faction: FactionDetail;
    myWallet: string;
    onPurchased: () => void;
}

export function FactionUpgradesPanel({ faction, myWallet, onPurchased }: FactionUpgradesPanelProps) {
    const { t } = useLanguage();
    const canManage = faction.founderWallet === myWallet || faction.verifiedCreatorWallet === myWallet;
    const quote = useShopQuote("faction_promo_code", canManage && !faction.promoCode);
    const seatQuote = useShopQuote("faction_promo_seats", canManage && !!faction.promoCode);

    const seats = faction.promoSeats ?? 0;
    const seatsUsed = faction.promoSeatsUsed ?? 0;
    const seatsLeft = Math.max(seats - seatsUsed, 0);
    const seatPercent = seats > 0 ? Math.min(100, Math.round((seatsUsed / seats) * 100)) : 0;
    const publicUrl = faction.slug ? factionPageUrl(faction.slug) : null;

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
                        {quote?.payableTnj ? (
                            <PurchaseButton factionId={faction.id} quoteItemId="faction_promo_code" price={quote.payableTnj} onSuccess={onPurchased} />
                        ) : (
                            <p className="text-[#6B7280] text-xs text-center py-2">{t("g.pay.preparing")}</p>
                        )}
                    </div>
                ) : (
                    <p className="text-[#8B8F98] text-sm text-center py-4">
                        {t("g.factionUp.promoWaiting")}
                    </p>
                )}
            </div>

            {faction.promoCode && (
                <div className="bg-[rgba(255,255,255,0.03)] border border-white/10 rounded-lg p-6 space-y-3">
                    <div className="flex items-center gap-2 text-[#E5E7EB] font-bold">
                        <Ticket className="w-4 h-4 text-[#4FD1FF]" />
                        {t("g.factionUp.seatsTitle")}
                    </div>

                    <p className="text-[#8B8F98] text-xs">{t("g.factionUp.seatsHint")}</p>

                    <div className="space-y-1.5">
                        <div className="flex items-baseline justify-between text-xs">
                            <span className="text-[#8B8F98]">{t("g.factionUp.seatsLeft")}</span>
                            <span className="text-[#E5E7EB] font-bold tabular-nums">{seatsLeft} / {seats}</span>
                        </div>
                        <div className="h-2 rounded-full bg-[rgba(255,255,255,0.08)] overflow-hidden">
                            <div className="h-full rounded-full bg-[#4FD1FF]" style={{ width: `${seatPercent}%` }} />
                        </div>
                    </div>

                    {canManage && (
                        seatQuote?.payableTnj ? (
                            <PurchaseButton
                                factionId={faction.id}
                                factionUpgrade="promo-seats"
                                quoteItemId="faction_promo_seats"
                                price={seatQuote.payableTnj}
                                onSuccess={onPurchased}
                            />
                        ) : (
                            <p className="text-[#6B7280] text-xs text-center py-2">{t("g.pay.preparing")}</p>
                        )
                    )}
                </div>
            )}

            {publicUrl && (
                <div className="bg-[rgba(255,255,255,0.03)] border border-white/10 rounded-lg p-6 space-y-3">
                    <div className="flex items-center gap-2 text-[#E5E7EB] font-bold">
                        <Globe className="w-4 h-4 text-[#4ADE80]" />
                        {t("g.factionUp.pageTitle")}
                    </div>
                    <p className="text-[#8B8F98] text-xs">{t("g.factionUp.pageHint")}</p>
                    <div className="bg-[rgba(79,209,255,0.06)] border border-[rgba(79,209,255,0.2)] rounded-lg px-4 py-3">
                        <CopyableText value={publicUrl} className="text-[#4FD1FF] text-xs font-mono break-all" />
                    </div>
                </div>
            )}
        </div>
    );
}
