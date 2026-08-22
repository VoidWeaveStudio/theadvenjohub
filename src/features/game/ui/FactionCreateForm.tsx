// src/features/game/ui/FactionCreateForm.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

import { Users, Loader2 } from "lucide-react";
import { useAuth } from "@/core/auth/AuthProvider";
import { gameFetch } from "../utils/gameFetch";
import { payTnj, PayTnjError, type PayStage } from "@/core/blockchain/payTnj";
import { clearPendingPayment, readPendingPayment, savePendingPayment } from "@/core/blockchain/pendingPayment";
import { useLanguage } from "@/core/i18n/LanguageContext";


type PayState = false | "connecting" | "signing" | "confirming";

interface TokenPreview {
    name: string;
    symbol: string;
    image: string | null;
}

interface FactionCreateFormProps {
    gameSlug: string;
    onCreated: (factionName: string) => void;
}

interface LivePrice {
    payableTnj: number;
    currency: string;
    priceUsdCents: number;
}

export function buildFactionDescriptionPreview(name: string, symbol: string): string {
    return symbol ? `Community faction for ${name} ($${symbol}).` : `Community faction for ${name}.`;
}

// Returns a translation key, or the raw server code when there is no mapping
// for it — the caller runs it through t(), which falls back to the code itself.
export function mapCreateError(code: string): string {
    switch (code) {
        case "no_license": return "g.factionCreate.noLicense";
        case "token_not_found": return "g.factionCreate.tokenNotFound";
        case "insufficient_token_balance": return "g.factionCreate.noBalance";
        case "balance_check_failed": return "g.factionCreate.balanceCheckFailed";
        case "name_taken": return "g.factionCreate.nameTaken";
        case "signature_already_used": return "g.factionCreate.signatureUsed";
        case "wrong_signer": return "g.factionCreate.wrongSigner";
        case "transfer_verification_failed": return "g.factionCreate.transferUnverified";
        case "transaction_not_found": return "g.factionCreate.txNotFound";
        case "invalid_csrf_token": case "Invalid CSRF token": return "g.factionCreate.sessionExpired";
        case "too_many_attempts": return "g.factionCreate.tooManyAttempts";
        case "price_unavailable": return "g.factionCreate.priceUnavailable";
        case "not_for_sale": return "g.factionCreate.disabled";
        default: return code || "g.factionCreate.failed";
    }
}

export function FactionCreateForm({ gameSlug, onCreated }: FactionCreateFormProps) {
    const { t } = useLanguage();
    const { publicKey, connected, wallet } = useWallet();
    const { isAuthorized } = useAuth();

    const [createCa, setCreateCa] = useState("");
    const [tokenPreview, setTokenPreview] = useState<TokenPreview | null>(null);
    const [previewStatus, setPreviewStatus] = useState<"idle" | "loading" | "not_found">("idle");
    const [payState, setPayState] = useState<PayState>(false);
    const [createError, setCreateError] = useState<string | null>(null);

    const [livePrice, setLivePrice] = useState<LivePrice | null>(null);

    const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isProcessingRef = useRef(false);

    const fetchPrice = useCallback(async (): Promise<LivePrice | null> => {
        try {
            const res = await fetch(`/api/game/shop-prices?gameSlug=${encodeURIComponent(gameSlug)}`);
            if (!res.ok) return null;
            const data = await res.json();
            const entry = (data.items || []).find((i: any) => i.itemId === "faction_creation");
            if (!entry || typeof entry.payableTnj !== "number") return null;
            return { payableTnj: entry.payableTnj, currency: entry.currency, priceUsdCents: entry.priceUsdCents };
        } catch {
            return null;
        }
    }, [gameSlug]);

    useEffect(() => {
        let cancelled = false;
        fetchPrice().then((price) => {
            if (!cancelled) setLivePrice(price);
        });
        const interval = setInterval(() => {
            fetchPrice().then((price) => {
                if (!cancelled) setLivePrice(price);
            });
        }, 30000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [fetchPrice]);

    useEffect(() => {
        if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
        setTokenPreview(null);

        const trimmed = createCa.trim();
        if (trimmed.length < 32) {
            setPreviewStatus("idle");
            return;
        }

        setPreviewStatus("loading");
        previewDebounceRef.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/token-by-ca?ca=${encodeURIComponent(trimmed)}`);
                const json = await res.json();
                if (json && json.name) {
                    setTokenPreview({ name: json.name, symbol: json.symbol || "", image: json.image || null });
                    setPreviewStatus("idle");
                } else {
                    setPreviewStatus("not_found");
                }
            } catch {
                setPreviewStatus("not_found");
            }
        }, 400);

        return () => {
            if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
        };
    }, [createCa]);

    const handlePayAndCreate = useCallback(async () => {
        if (!tokenPreview || isProcessingRef.current) return;
        if (!publicKey || !connected || !wallet?.adapter) {
            setCreateError("g.factionCreate.connectWallet");
            return;
        }
        if (!isAuthorized) {
            setCreateError("g.factionCreate.sessionExpired");
            return;
        }
        isProcessingRef.current = true;
        setCreateError(null);
        setPayState("connecting");

        const paymentKey = `faction-create:${createCa.trim()}`;

        try {
            let signature = readPendingPayment(paymentKey)?.signature ?? null;

            if (!signature) {
                const quoted = await fetchPrice();
                const payable = quoted?.payableTnj ?? livePrice?.payableTnj;
                if (!payable) {
                    throw new Error("price_unavailable");
                }
                setLivePrice(quoted ?? livePrice);

                signature = await payTnj({
                    adapter: wallet.adapter,
                    payer: publicKey,
                    amountTnj: payable,
                    onStage: (stage: PayStage) => setPayState(stage === "preparing" ? "connecting" : stage),
                });

                savePendingPayment({ key: paymentKey, signature, amountTnj: payable });
            }

            const res = await gameFetch("/api/faction/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ signature, ca: createCa.trim(), gameSlug }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `create_failed_${res.status}`);
            }

            const data = await res.json();
            clearPendingPayment(paymentKey);
            setCreateCa("");
            setTokenPreview(null);
            onCreated(data.faction?.name ?? tokenPreview.name);
        } catch (err: any) {
            console.error("[FactionCreate] faction creation error:", err);

            if (err instanceof PayTnjError) {
                setCreateError(
                    err.code === "user_rejected" ? "g.gate.err.rejected" :
                    err.code === "no_token_account" ? "g.shopBuy.err.no_token_account" :
                    err.code === "insufficient_balance" ? "g.shopBuy.err.insufficient" :
                    err.code === "config_failed" ? "g.gate.err.configFailed" :
                    mapCreateError(err.code)
                );
            } else {
                setCreateError(mapCreateError(err.message));
            }
        } finally {
            isProcessingRef.current = false;
            setPayState(false);
        }
    }, [tokenPreview, publicKey, connected, wallet, isAuthorized, createCa, gameSlug, onCreated, fetchPrice, livePrice]);

    const payButtonLabel =
        payState === "connecting" ? t("g.pay.preparing") :
            payState === "signing" ? t("g.pay.confirmInWallet") :
                payState === "confirming" ? t("g.pay.confirming") :
                    livePrice
                        ? t("g.factionCreate.payAndCreate", { amount: livePrice.payableTnj.toLocaleString("en-US") })
                        : t("g.factionCreate.loadingPrice");

    return (
        <div className="space-y-3">
            <p className="text-[#8B8F98] text-sm">
                {t("g.factionCreate.intro")}
            </p>

            <input
                type="text"
                value={createCa}
                onChange={(e) => setCreateCa(e.target.value.slice(0, 64))}
                placeholder={t("g.factionCreate.caPlaceholder")}
                disabled={!!payState}
                className="w-full bg-[rgba(255,255,255,0.04)] text-[#E5E7EB] px-3 py-2 rounded-lg text-sm border border-white/10 focus:border-[#a855f7]/50 outline-none font-mono disabled:opacity-50"
            />

            {previewStatus === "loading" && <p className="text-[#8B8F98] text-sm">{t("g.factionCreate.lookingUp")}</p>}
            {previewStatus === "not_found" && (
                <p className="text-red-400 text-sm">{t("g.factionCreate.tokenNotFound")}</p>
            )}

            {tokenPreview && (
                <div className="flex items-center gap-3 bg-[rgba(255,255,255,0.04)] rounded-lg p-3">
                    {tokenPreview.image ? (
                        <img src={tokenPreview.image} alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                    ) : (
                        <div className="w-12 h-12 rounded-full bg-[rgba(255,255,255,0.08)] flex items-center justify-center flex-shrink-0">
                            <Users className="w-6 h-6 text-[#8B8F98]" />
                        </div>
                    )}
                    <div className="flex-1">
                        <div className="text-[#E5E7EB] font-bold">
                            {tokenPreview.name}{" "}
                            {tokenPreview.symbol && <span className="text-[#8B8F98]">${tokenPreview.symbol}</span>}
                        </div>
                        <p className="text-[#8B8F98] text-xs mt-0.5">
                            {buildFactionDescriptionPreview(tokenPreview.name, tokenPreview.symbol)}
                        </p>
                    </div>
                </div>
            )}

            {createError && (
                <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {t(createError)}
                </p>
            )}

            <button
                onClick={handlePayAndCreate}
                disabled={!tokenPreview || !!payState || !livePrice}
                className="btn-primary px-4 py-2 text-sm w-full disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
                {payState && <Loader2 className="w-4 h-4 animate-spin" />}
                {payButtonLabel}
            </button>
        </div>
    );
}
