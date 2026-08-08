// src/features/game/ui/FactionCreateForm.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddress, createTransferInstruction } from "@solana/spl-token";
import { Users, Loader2 } from "lucide-react";
import { useAuth } from "@/core/auth/AuthProvider";
import { getCsrfToken } from "@/core/lib/clientUtils";

const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
export const FACTION_CREATION_PRICE_TNJ = 1_000_000;

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

export function mapCreateError(code: string): string {
    switch (code) {
        case "no_license": return "You need to own this game to found a faction.";
        case "token_not_found": return "Could not find a token for that address.";
        case "insufficient_token_balance": return "You need to hold this faction's token in your wallet.";
        case "balance_check_failed": return "Could not verify your token balance right now, try again shortly.";
        case "name_taken": return "A faction for that token already exists.";
        case "signature_already_used": return "This payment was already used.";
        case "wrong_signer": return "Payment signer mismatch, try again.";
        case "transfer_verification_failed": return "Could not verify the payment on-chain yet, wait a few seconds and try again.";
        case "transaction_not_found": return "Transaction not found yet, wait a few seconds and try again.";
        case "invalid_csrf_token": case "Invalid CSRF token": return "Session expired, reload and try again.";
        case "too_many_attempts": return "Too many attempts, try again later.";
        case "price_unavailable": return "Could not fetch the current TNJ price, try again in a moment.";
        case "not_for_sale": return "Faction creation is currently disabled.";
        default: return code || "Faction creation failed.";
    }
}

export function FactionCreateForm({ gameSlug, onCreated }: FactionCreateFormProps) {
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
            setCreateError("Connect your wallet first.");
            return;
        }
        if (!isAuthorized) {
            setCreateError("Your session expired, reload the page and try again.");
            return;
        }
        if (typeof (wallet.adapter as any).signTransaction !== "function") {
            setCreateError("This wallet doesn't support transaction signing.");
            return;
        }

        isProcessingRef.current = true;
        setCreateError(null);
        setPayState("connecting");

        try {
            const configRes = await fetch("/api/marketplace/config");
            if (!configRes.ok) throw new Error("Failed to load payment config");
            const config = await configRes.json();

            const connection = new Connection(config.publicRpc, "confirmed");
            const mintPubkey = new PublicKey(config.tokenMint);
            const treasuryPubkey = new PublicKey(config.treasuryWallet);
            const decimals = parseInt(config.decimals || "6");

            const userATA = await getAssociatedTokenAddress(mintPubkey, publicKey, false, TOKEN_2022_PROGRAM_ID);
            const treasuryATA = await getAssociatedTokenAddress(mintPubkey, treasuryPubkey, true, TOKEN_2022_PROGRAM_ID);
            const quoted = await fetchPrice();
            const payable = quoted?.payableTnj ?? livePrice?.payableTnj;
            if (!payable) {
                throw new Error("price_unavailable");
            }
            setLivePrice(quoted ?? livePrice);
            const amountToSend = BigInt(payable) * (10n ** BigInt(decimals));

            setPayState("signing");

            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
            const transferInstruction = createTransferInstruction(userATA, treasuryATA, publicKey, amountToSend, [], TOKEN_2022_PROGRAM_ID);
            const tx = new Transaction({ feePayer: publicKey, recentBlockhash: blockhash }).add(transferInstruction);

            let signedTx;
            try {
                signedTx = await (wallet.adapter as any).signTransaction(tx);
            } catch (signError: any) {
                if (signError.code === 4001 || signError.message?.includes("rejected")) {
                    throw new Error("Transaction rejected");
                }
                throw signError;
            }

            const signature = await connection.sendRawTransaction(signedTx.serialize(), {
                skipPreflight: false,
                preflightCommitment: "confirmed",
            });

            setPayState("confirming");
            try {
                await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
            } catch (confirmErr: any) {
                console.warn("[FactionCreate] confirmation timeout, relying on backend verification:", confirmErr.message);
            }

            const csrfToken = getCsrfToken();
            const res = await fetch("/api/faction/create", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
                },
                body: JSON.stringify({ signature, ca: createCa.trim(), gameSlug }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `create_failed_${res.status}`);
            }

            const data = await res.json();
            setCreateCa("");
            setTokenPreview(null);
            onCreated(data.faction?.name ?? tokenPreview.name);
        } catch (err: any) {
            console.error("[FactionCreate] faction creation error:", err);
            setCreateError(mapCreateError(err.message));
        } finally {
            isProcessingRef.current = false;
            setPayState(false);
        }
    }, [tokenPreview, publicKey, connected, wallet, isAuthorized, createCa, gameSlug, onCreated, fetchPrice, livePrice]);

    const payButtonLabel =
        payState === "connecting" ? "Preparing payment..." :
            payState === "signing" ? "Confirm in wallet..." :
                payState === "confirming" ? "Confirming payment..." :
                    livePrice
                        ? `Pay ${livePrice.payableTnj.toLocaleString("en-US")} TNJ & Create`
                        : "Loading price...";

    return (
        <div className="space-y-3">
            <p className="text-[#8B8F98] text-sm">
                Paste the contract address of the token your faction represents. Name, symbol and image are pulled
                automatically.
            </p>

            <input
                type="text"
                value={createCa}
                onChange={(e) => setCreateCa(e.target.value.slice(0, 64))}
                placeholder="Paste token CA..."
                disabled={!!payState}
                className="w-full bg-[rgba(255,255,255,0.04)] text-[#E5E7EB] px-3 py-2 rounded-lg text-sm border border-white/10 focus:border-[#a855f7]/50 outline-none font-mono disabled:opacity-50"
            />

            {previewStatus === "loading" && <p className="text-[#8B8F98] text-sm">Looking up token...</p>}
            {previewStatus === "not_found" && (
                <p className="text-red-400 text-sm">Token not found for that address.</p>
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
                    {createError}
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
