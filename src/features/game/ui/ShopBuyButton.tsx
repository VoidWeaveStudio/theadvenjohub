// src/features/game/ui/ShopBuyButton.tsx
"use client";

import { useCallback, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddress, createTransferInstruction } from "@solana/spl-token";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { useAuth } from "@/core/auth/AuthProvider";
import { createRpcConnection, confirmSignature } from "@/core/lib/solanaClient";
import { gameFetch } from "../utils/gameFetch";
import { fetchPayableTnj } from "../utils/shopQuote";

const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

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
    ]);
    if (known.has(raw)) return `g.shopBuy.err.${raw}`;
    if (raw === "transaction_not_found" || raw === "payment_timestamp_unavailable") return "g.shopBuy.err.pending";
    return "g.shopBuy.err.failed";
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
        if (typeof (wallet.adapter as any).signTransaction !== "function") {
            setError(errorKey("no_signing"));
            return;
        }

        isProcessingRef.current = true;
        setError(null);
        setPayState("quoting");

        try {
            const configRes = await fetch("/api/marketplace/config");
            if (!configRes.ok) throw new Error("config_failed");
            const config = await configRes.json();

            const connection = createRpcConnection();
            const mintPubkey = new PublicKey(config.tokenMint);
            const treasuryPubkey = new PublicKey(config.treasuryWallet);
            const decimals = parseInt(config.decimals || "6");

            const priceTnj = await fetchPayableTnj(itemId, gameSlug);

            const userATA = await getAssociatedTokenAddress(mintPubkey, publicKey, false, TOKEN_2022_PROGRAM_ID);
            const treasuryATA = await getAssociatedTokenAddress(mintPubkey, treasuryPubkey, true, TOKEN_2022_PROGRAM_ID);
            const amountToSend = BigInt(priceTnj) * (10n ** BigInt(decimals));

            setPayState("signing");

            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
            const transferInstruction = createTransferInstruction(
                userATA, treasuryATA, publicKey, amountToSend, [], TOKEN_2022_PROGRAM_ID
            );
            const tx = new Transaction({ feePayer: publicKey, recentBlockhash: blockhash }).add(transferInstruction);

            let signedTx;
            try {
                signedTx = await (wallet.adapter as any).signTransaction(tx);
            } catch (signError: any) {
                if (signError?.code === 4001 || signError?.message?.includes("rejected")) {
                    throw new Error("rejected");
                }
                throw signError;
            }

            const signature = await connection.sendRawTransaction(signedTx.serialize(), {
                skipPreflight: false,
                preflightCommitment: "confirmed",
            });

            setPayState("confirming");
            try {
                await confirmSignature(connection, signature, lastValidBlockHeight);
            } catch (confirmErr: any) {
                console.warn("[ShopBuy] confirmation timeout, relying on backend verification:", confirmErr?.message);
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

            onPurchased(itemId);
        } catch (err: any) {
            console.error("[ShopBuy] purchase error:", err);
            setError(errorKey(err?.message || "failed"));
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
