// src/features/game/ui/GateStewardPanel.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { DoorOpen, Loader2 } from "lucide-react";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { useAuth } from "@/core/auth/AuthProvider";
import { gameFetch } from "../utils/gameFetch";
import { NpcPanelFrame } from "./shell/NpcPanelFrame";
import { payTnj, PayTnjError, type PayStage } from "@/core/blockchain/payTnj";
import { clearPendingPayment, readPendingPayment, savePendingPayment } from "@/core/blockchain/pendingPayment";
import { fetchPayableTnj } from "../utils/shopQuote";
import { useShopQuote } from "./hooks/useShopQuote";

export interface GateFactionResult {
    id: string;
    name: string;
    symbol: string | null;
    image: string | null;
    tokenCa: string | null;
}

interface LookupResult {
    faction: GateFactionResult | null;
    hasGate: boolean;
    canPurchase: boolean;
}

export interface StewardFaction {
    id: string;
    name: string;
    symbol: string | null;
    image: string | null;
    tokenCa?: string | null;
}

interface GateStewardPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onPurchased: (faction: GateFactionResult) => void;
    onTeleport: (faction: GateFactionResult) => void;
    myFactions: StewardFaction[];
    gateFactionIds: string[];
    onEnterPersonalRoom: () => void;
}

type PayState = false | "connecting" | "signing" | "confirming";
type StewardTab = "rooms" | "purchase" | "find";

const ACCENT = "#E8A33D";

const STEWARD_TABS: { id: StewardTab; labelKey: string }[] = [
    { id: "rooms", labelKey: "g.gate.tab.rooms" },
    { id: "purchase", labelKey: "g.gate.tab.buy" },
    { id: "find", labelKey: "g.gate.tab.find" },
];

function mapPurchaseError(code: string): string {
    switch (code) {
        case "not_authorized": return "g.gate.err.notAuthorized";
        case "already_purchased": return "g.gate.err.alreadyPurchased";
        case "faction_not_found": return "g.gate.err.factionNotFound";
        case "signature_already_used": return "g.gate.err.signatureUsed";
        case "wrong_signer": return "g.gate.err.wrongSigner";
        case "transfer_verification_failed": return "g.gate.err.transferUnverified";
        case "transaction_not_found": return "g.gate.err.txNotFound";
        case "too_many_attempts": return "g.gate.err.tooManyAttempts";
        default: return code || "g.gate.err.failed";
    }
}

function mapLookupError(message: string): string {
    return message === "invalid_ca" ? "g.gate.err.invalidCa" : "g.gate.err.lookupFailed";
}

export function GateStewardPanel({
    isOpen,
    onClose,
    onPurchased,
    onTeleport,
    myFactions,
    gateFactionIds,
    onEnterPersonalRoom,
}: GateStewardPanelProps) {
    const { t } = useLanguage();
    const { publicKey, connected, wallet } = useWallet();
    const { isAuthorized } = useAuth();

    const [activeTab, setActiveTab] = useState<StewardTab>("rooms");
    const gateQuote = useShopQuote("faction_gate", isOpen);

    const [ca, setCa] = useState("");
    const [searching, setSearching] = useState(false);
    const [result, setResult] = useState<LookupResult | null>(null);
    const [payState, setPayState] = useState<PayState>(false);
    const [error, setError] = useState<string | null>(null);

    const [findCa, setFindCa] = useState("");
    const [findSearching, setFindSearching] = useState(false);
    const [findResult, setFindResult] = useState<LookupResult | null>(null);
    const [findError, setFindError] = useState<string | null>(null);

    const isProcessingRef = useRef(false);

    useEffect(() => {
        if (!isOpen) {
            setActiveTab("rooms");
            setCa("");
            setResult(null);
            setError(null);
            setFindCa("");
            setFindResult(null);
            setFindError(null);
        }
    }, [isOpen]);

    const handleLookup = async () => {
        const trimmed = ca.trim();
        if (trimmed.length < 32 || searching) return;
        setSearching(true);
        setError(null);
        setResult(null);
        try {
            const res = await gameFetch(`/api/faction/gate/lookup?ca=${encodeURIComponent(trimmed)}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "lookup_failed");
            setResult(data);
        } catch (err: any) {
            setError(mapLookupError(err.message));
        } finally {
            setSearching(false);
        }
    };

    const handleFindLookup = async () => {
        const trimmed = findCa.trim();
        if (trimmed.length < 32 || findSearching) return;
        setFindSearching(true);
        setFindError(null);
        setFindResult(null);
        try {
            const res = await gameFetch(`/api/faction/gate/lookup?ca=${encodeURIComponent(trimmed)}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "lookup_failed");
            setFindResult(data);
        } catch (err: any) {
            setFindError(mapLookupError(err.message));
        } finally {
            setFindSearching(false);
        }
    };

    const handleTeleport = () => {
        if (!findResult?.faction || !findResult.hasGate) return;
        onTeleport(findResult.faction);
        onClose();
    };

    const handlePurchase = useCallback(async () => {
        if (!result?.faction || isProcessingRef.current) return;
        if (!publicKey || !connected || !wallet?.adapter) {
            setError("g.gate.err.connectWallet");
            return;
        }
        if (!isAuthorized) {
            setError("g.gate.err.sessionExpired");
            return;
        }
        isProcessingRef.current = true;
        setError(null);
        setPayState("connecting");

        const paymentKey = `faction-gate:${result.faction.id}`;

        try {
            let signature = readPendingPayment(paymentKey)?.signature ?? null;

            if (!signature) {
                const priceTnj = await fetchPayableTnj("faction_gate");

                signature = await payTnj({
                    adapter: wallet.adapter,
                    payer: publicKey,
                    amountTnj: priceTnj,
                    onStage: (stage: PayStage) => setPayState(stage === "preparing" ? "connecting" : stage),
                });

                savePendingPayment({ key: paymentKey, signature, amountTnj: priceTnj });
            }

            const res = await gameFetch("/api/faction/gate/purchase", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ signature, factionId: result.faction.id }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `purchase_failed_${res.status}`);
            }

            clearPendingPayment(paymentKey);
            onPurchased(result.faction);
            setResult((prev) => (prev ? { ...prev, hasGate: true, canPurchase: false } : prev));
        } catch (err: any) {
            console.error("[GateSteward] purchase error:", err);

            if (err instanceof PayTnjError) {
                setError(
                    err.code === "user_rejected" ? "g.gate.err.rejected" :
                    err.code === "no_token_account" ? "g.shopBuy.err.no_token_account" :
                    err.code === "insufficient_balance" ? "g.shopBuy.err.insufficient" :
                    err.code === "config_failed" ? "g.gate.err.configFailed" :
                    mapPurchaseError(err.code)
                );
            } else {
                setError(mapPurchaseError(err.message));
            }
        } finally {
            isProcessingRef.current = false;
            setPayState(false);
        }
    }, [result, publicKey, connected, wallet, isAuthorized, onPurchased]);

    const payButtonLabel =
        payState === "connecting" ? t("g.pay.preparing") :
            payState === "signing" ? t("g.pay.confirmInWallet") :
                payState === "confirming" ? t("g.pay.confirming") :
                    t("g.gate.buyPrice", { amount: (gateQuote?.payableTnj ?? 0).toLocaleString("en-US") });

    return (
        <NpcPanelFrame
            isOpen={isOpen}
            onClose={onClose}
            title={t("g.gate.title")}
            accent={ACCENT}
            background="rgba(20,16,8,0.95)"
            icon={<DoorOpen className="w-5 h-5" />}
            subheader={
                <div className="flex gap-1 bg-black/30 rounded-lg p-1">
                    {STEWARD_TABS.map(({ id, labelKey }) => (
                        <button
                            key={id}
                            onClick={() => setActiveTab(id)}
                            className={`flex-1 game-tap py-1.5 text-sm font-bold rounded-md transition-colors ${activeTab === id ? "bg-[#E8A33D]/20 text-[#E8A33D]" : "text-[#8B8F98] hover:text-[#E5E7EB]"}`}
                        >
                            {t(labelKey)}
                        </button>
                    ))}
                </div>
            }
        >
            {activeTab === "rooms" && (
                <>
                    <p className="text-[#8B8F98] text-sm mb-4">
                        {t("g.gate.rooms.intro")}
                    </p>

                    <button
                        onClick={() => { onEnterPersonalRoom(); onClose(); }}
                        className="btn-primary px-4 py-2 text-sm w-full mb-4"
                    >
                        {t("g.gate.rooms.enterMine")}
                    </button>

                    <div className="text-[#8B8F98] text-xs uppercase tracking-wide mb-2">{t("g.gate.rooms.factionRooms")}</div>

                    {myFactions.length === 0 ? (
                        <p className="text-[#8B8F98] text-sm">{t("g.gate.rooms.noFactions")}</p>
                    ) : (
                        <div className="space-y-2">
                            {myFactions.map((faction) => {
                                const hasRoom = gateFactionIds.includes(faction.id);
                                return (
                                    <div key={faction.id} className="flex items-center gap-3 bg-white/5 rounded-lg p-2.5">
                                        {faction.image ? (
                                            <img src={faction.image} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-white/10 flex-shrink-0" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[#E5E7EB] font-bold text-sm truncate">{faction.name}</div>
                                            {!hasRoom && <div className="text-[#8B8F98] text-xs">{t("g.gate.rooms.noRoom")}</div>}
                                        </div>
                                        <button
                                            onClick={() => {
                                                onTeleport({
                                                    id: faction.id,
                                                    name: faction.name,
                                                    symbol: faction.symbol,
                                                    image: faction.image,
                                                    tokenCa: faction.tokenCa ?? null,
                                                });
                                                onClose();
                                            }}
                                            disabled={!hasRoom}
                                            className="btn-secondary px-3 py-1.5 text-xs flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            {t("g.gate.rooms.enter")}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {activeTab === "purchase" && (
                <>
                    <p className="text-[#8B8F98] text-sm mb-4">
                        {t("g.gate.buy.intro")}
                    </p>

                    <div className="flex gap-2 mb-3">
                        <input
                            type="text"
                            value={ca}
                            onChange={(e) => setCa(e.target.value.slice(0, 64))}
                            placeholder={t("g.gate.ca.placeholder")}
                            autoFocus
                            className="flex-1 min-w-0 bg-[rgba(255,255,255,0.04)] text-[#E5E7EB] px-3 py-2 rounded-lg text-sm border border-white/10 focus:border-[#E8A33D]/50 outline-none font-mono"
                        />
                        <button
                            onClick={handleLookup}
                            disabled={ca.trim().length < 32 || searching}
                            className="btn-secondary px-4 py-2 text-sm flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {searching ? "..." : t("g.gate.buy.lookUp")}
                        </button>
                    </div>

                    {result && (
                        result.faction ? (
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 bg-white/5 rounded-lg p-3">
                                    {result.faction.image ? (
                                        <img src={result.faction.image} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-white/10 flex-shrink-0" />
                                    )}
                                    <div className="text-[#E5E7EB] font-bold text-sm">
                                        {result.faction.name} {result.faction.symbol && <span className="text-[#8B8F98]">${result.faction.symbol}</span>}
                                    </div>
                                </div>

                                {result.hasGate ? (
                                    <p className="text-[#4ADE80] text-sm">{t("g.gate.buy.hasGate")}</p>
                                ) : result.canPurchase ? (
                                    <button
                                        onClick={handlePurchase}
                                        disabled={!!payState}
                                        className="btn-primary px-4 py-2 text-sm w-full disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {payState && <Loader2 className="w-4 h-4 animate-spin" />}
                                        {payButtonLabel}
                                    </button>
                                ) : (
                                    <p className="text-[#FFD166] text-sm">{t("g.gate.buy.cannotBuy")}</p>
                                )}
                            </div>
                        ) : (
                            <p className="text-[#8B8F98] text-sm">{t("g.gate.noFactionForToken")}</p>
                        )
                    )}

                    {error && (
                        <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mt-3">
                            {t(error)}
                        </p>
                    )}
                </>
            )}

            {activeTab === "find" && (
                <>
                    <p className="text-[#8B8F98] text-sm mb-4">
                        {t("g.gate.find.intro")}
                    </p>

                    <div className="flex gap-2 mb-3">
                        <input
                            type="text"
                            value={findCa}
                            onChange={(e) => setFindCa(e.target.value.slice(0, 64))}
                            placeholder={t("g.gate.ca.placeholder")}
                            className="flex-1 min-w-0 bg-[rgba(255,255,255,0.04)] text-[#E5E7EB] px-3 py-2 rounded-lg text-sm border border-white/10 focus:border-[#E8A33D]/50 outline-none font-mono"
                        />
                        <button
                            onClick={handleFindLookup}
                            disabled={findCa.trim().length < 32 || findSearching}
                            className="btn-secondary px-4 py-2 text-sm flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {findSearching ? "..." : t("g.gate.find.search")}
                        </button>
                    </div>

                    {findResult && (
                        findResult.faction ? (
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 bg-white/5 rounded-lg p-3">
                                    {findResult.faction.image ? (
                                        <img src={findResult.faction.image} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-white/10 flex-shrink-0" />
                                    )}
                                    <div className="text-[#E5E7EB] font-bold text-sm">
                                        {findResult.faction.name} {findResult.faction.symbol && <span className="text-[#8B8F98]">${findResult.faction.symbol}</span>}
                                    </div>
                                </div>

                                {findResult.hasGate ? (
                                    <button
                                        onClick={handleTeleport}
                                        className="btn-primary px-4 py-2 text-sm w-full"
                                    >
                                        {t("g.gate.find.teleport")}
                                    </button>
                                ) : (
                                    <p className="text-[#FFD166] text-sm">{t("g.gate.find.noGate")}</p>
                                )}
                            </div>
                        ) : (
                            <p className="text-[#8B8F98] text-sm">{t("g.gate.noFactionForToken")}</p>
                        )
                    )}

                    {findError && (
                        <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mt-3">
                            {t(findError)}
                        </p>
                    )}
                </>
            )}
        </NpcPanelFrame>
    );
}
