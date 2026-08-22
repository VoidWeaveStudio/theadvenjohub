// src/features/game/ui/ShopBuyButton.tsx
"use client";

import { useCallback, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { useAuth } from "@/core/auth/AuthProvider";
import { PayTnjError, payTnj, type PayStage } from "@/core/blockchain/payTnj";
import { clearPendingPayment, readPendingPayment, savePendingPayment } from "@/core/blockchain/pendingPayment";
import { gameFetch } from "../utils/gameFetch";
import { fetchPayableTnj } from "../utils/shopQuote";
import { SoundManager } from "../core/SoundManager";

type PayState = false | "quoting" | "signing" | "confirming" | "verifying";

interface ShopBuyButtonProps {
    itemId: string;
    gameSlug: string;
    owned: boolean;
    onPurchased: (itemId: string) => void;
}

function errorKey(raw: string): string {
    const known = new Set([
        "not_for_sale",
        "price_unavailable",
        "already_owned",
        "signature_already_used",
        "no_progress",
        "rejected",
        "connect_wallet",
        "session_expired",
        "no_signing",
        "config_failed",
        "no_token_account",
        "insufficient",
    ]);
    if (known.has(raw)) return `g.shopBuy.err.${raw}`;
    if (raw === "transaction_not_found" || raw === "payment_timestamp_unavailable") return "g.shopBuy.err.pending";
    return "g.shopBuy.err.failed";
}

function payErrorKey(error: PayTnjError): string {
    switch (error.code) {
        case "user_rejected": return errorKey("rejected");
        case "no_token_account": return errorKey("no_token_account");
        case "insufficient_balance": return errorKey("insufficient");
        case "wallet_not_connected": return errorKey("connect_wallet");
        case "config_failed": return errorKey("config_failed");
        default: return errorKey("failed");
    }
}

export function ShopBuyButton({ itemId, gameSlug, owned, onPurchased }: ShopBuyButtonProps) {
    const { t } = useLanguage();
    const { publicKey, connected, wallet } = useWallet();
    const { isAuthorized } = useAuth();
    const [payState, setPayState] = useState<PayState>(false);
    const [error, setError] = useState<string | null>(null);
    const isProcessingRef = useRef(false);

    const handleBuy = useCallback(async () => {
        if (isProcessingRef.current || owned) return;
        if (!publicKey || !connected || !wallet?.adapter) {
            setError(errorKey("connect_wallet"));
            return;
        }
        if (!isAuthorized) {
            setError(errorKey("session_expired"));
            return;
        }

        const paymentKey = `shop:${itemId}`;

        isProcessingRef.current = true;
        setError(null);
        setPayState("quoting");

        try {
            let signature = readPendingPayment(paymentKey)?.signature ?? null;

            if (!signature) {
                const priceTnj = await fetchPayableTnj(itemId, gameSlug);

                signature = await payTnj({
                    adapter: wallet.adapter,
                    payer: publicKey,
                    amountTnj: priceTnj,
                    onStage: (stage: PayStage) => setPayState(stage === "preparing" ? "quoting" : stage),
                });

                savePendingPayment({ key: paymentKey, signature, amountTnj: priceTnj });
            }

            setPayState("verifying");
            const res = await gameFetch("/api/game/shop/purchase", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ signature, itemId, gameSlug }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `purchase_failed_${res.status}`);
            }

            clearPendingPayment(paymentKey);
            SoundManager.getInstance().play("shop-buy", { volume: 0.6 });
            onPurchased(itemId);
        } catch (err: any) {
            console.error("[ShopBuy] purchase error:", err);
            SoundManager.getInstance().play("shop-fail", { volume: 0.5 });
            setError(err instanceof PayTnjError ? payErrorKey(err) : errorKey(err?.message || "failed"));
        } finally {
            isProcessingRef.current = false;
            setPayState(false);
        }
    }, [itemId, gameSlug, owned, publicKey, connected, wallet, isAuthorized, onPurchased]);

    if (owned) {
        return (
            <span className="text-[#4ADE80] text-xs font-bold px-3 flex-shrink-0">
                {t("g.shopBuy.owned")}
            </span>
        );
    }

    const label =
        payState === "quoting" ? t("g.pay.preparing") :
            payState === "signing" ? t("g.pay.confirmInWallet") :
                payState === "confirming" ? t("g.pay.confirming") :
                    payState === "verifying" ? t("g.shopBuy.verifying") :
                        t("g.shopBuy.buy");

    return (
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <button
                onClick={handleBuy}
                disabled={payState !== false}
                className="bg-gradient-to-r from-[#4FD1FF] to-[#2C9BC4] text-[rgba(12,12,14,0.9)] font-bold px-4 py-2 rounded-[8px] text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
                {payState !== false && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {label}
            </button>
            {error && <span className="text-[#FF5757] text-[11px] max-w-[220px] text-right">{t(error)}</span>}
        </div>
    );
}
