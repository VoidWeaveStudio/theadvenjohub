// src/features/game/ui/GateStewardPanel.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddress, createTransferInstruction } from "@solana/spl-token";
import { DoorOpen, Loader2 } from "lucide-react";
import { useAuth } from "@/core/auth/AuthProvider";
import { getCsrfToken } from "@/core/lib/clientUtils";
import { SoundManager } from "../core/SoundManager";

const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const GATE_PRICE_TNJ = 1_000_000;

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

interface GateStewardPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onPurchased: (faction: GateFactionResult) => void;
}

type PayState = false | "connecting" | "signing" | "confirming";

function mapPurchaseError(code: string): string {
    switch (code) {
        case "not_authorized": return "Only the faction's founder or verified creator can buy a gate.";
        case "already_purchased": return "This faction already has a gate.";
        case "faction_not_found": return "Faction not found.";
        case "signature_already_used": return "This payment was already used.";
        case "wrong_signer": return "Payment signer mismatch, try again.";
        case "transfer_verification_failed": return "Could not verify the payment on-chain yet, wait a few seconds and try again.";
        case "transaction_not_found": return "Transaction not found yet, wait a few seconds and try again.";
        case "too_many_attempts": return "Too many attempts, try again later.";
        default: return code || "Purchase failed.";
    }
}

export function GateStewardPanel({ isOpen, onClose, onPurchased }: GateStewardPanelProps) {
    const { publicKey, connected, wallet } = useWallet();
    const { isAuthorized } = useAuth();

    const [ca, setCa] = useState("");
    const [searching, setSearching] = useState(false);
    const [result, setResult] = useState<LookupResult | null>(null);
    const [payState, setPayState] = useState<PayState>(false);
    const [error, setError] = useState<string | null>(null);

    const wasOpenRef = useRef(false);
    const isProcessingRef = useRef(false);

    useEffect(() => {
        if (isOpen && !wasOpenRef.current) {
            SoundManager.getInstance().play('modal-open');
        }
        wasOpenRef.current = isOpen;
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) {
            setCa("");
            setResult(null);
            setError(null);
        }
    }, [isOpen]);

    const handleLookup = async () => {
        const trimmed = ca.trim();
        if (trimmed.length < 32 || searching) return;
        setSearching(true);
        setError(null);
        setResult(null);
        try {
            const res = await fetch(`/api/faction/gate/lookup?ca=${encodeURIComponent(trimmed)}`, { credentials: "include" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "lookup_failed");
            setResult(data);
        } catch (err: any) {
            setError(err.message === "invalid_ca" ? "That doesn't look like a valid contract address." : "Lookup failed, try again.");
        } finally {
            setSearching(false);
        }
    };

    const handlePurchase = useCallback(async () => {
        if (!result?.faction || isProcessingRef.current) return;
        if (!publicKey || !connected || !wallet?.adapter) {
            setError("Connect your wallet first.");
            return;
        }
        if (!isAuthorized) {
            setError("Your session expired, reload the page and try again.");
            return;
        }
        if (typeof (wallet.adapter as any).signTransaction !== "function") {
            setError("This wallet doesn't support transaction signing.");
            return;
        }

        isProcessingRef.current = true;
        setError(null);
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
            const amountToSend = BigInt(GATE_PRICE_TNJ) * (10n ** BigInt(decimals));

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
                console.warn("[GateSteward] confirmation timeout, relying on backend verification:", confirmErr.message);
            }

            const csrfToken = getCsrfToken();
            const res = await fetch("/api/faction/gate/purchase", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
                },
                body: JSON.stringify({ signature, factionId: result.faction.id }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `purchase_failed_${res.status}`);
            }

            onPurchased(result.faction);
            setResult((prev) => (prev ? { ...prev, hasGate: true, canPurchase: false } : prev));
        } catch (err: any) {
            console.error("[GateSteward] purchase error:", err);
            setError(mapPurchaseError(err.message));
        } finally {
            isProcessingRef.current = false;
            setPayState(false);
        }
    }, [result, publicKey, connected, wallet, isAuthorized, onPurchased]);

    if (!isOpen) return null;

    const payButtonLabel =
        payState === "connecting" ? "Preparing payment..." :
            payState === "signing" ? "Confirm in wallet..." :
                payState === "confirming" ? "Confirming payment..." :
                    `Buy Gate — ${GATE_PRICE_TNJ.toLocaleString("en-US")} TNJ`;

    return (
        <div className="absolute inset-0 bg-[rgba(6,6,8,0.85)] backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto font-oxanium p-4">
            <div className="w-full max-w-md bg-[rgba(20,16,8,0.95)] border-2 border-[#E8A33D]/40 rounded-[16px] p-6 shadow-[0_0_35px_rgba(232,163,61,0.15)]">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <DoorOpen className="w-5 h-5 text-[#E8A33D]" />
                        <h2 className="text-xl font-black text-[#E5E7EB]">Corwin</h2>
                    </div>
                    <button onClick={onClose} className="bg-transparent border-0 p-0 text-[#8B8F98] hover:text-[#E5E7EB] transition-colors">
                        ✕
                    </button>
                </div>

                <p className="text-[#8B8F98] text-sm mb-4">
                    Paste a token's contract address — I'll tell you if that faction already has a gate here.
                </p>

                <div className="flex gap-2 mb-3">
                    <input
                        type="text"
                        value={ca}
                        onChange={(e) => setCa(e.target.value.slice(0, 64))}
                        placeholder="Token contract address..."
                        autoFocus
                        className="flex-1 min-w-0 bg-[rgba(255,255,255,0.04)] text-[#E5E7EB] px-3 py-2 rounded-lg text-sm border border-white/10 focus:border-[#E8A33D]/50 outline-none font-mono"
                    />
                    <button
                        onClick={handleLookup}
                        disabled={ca.trim().length < 32 || searching}
                        className="btn-secondary px-4 py-2 text-sm flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {searching ? "..." : "Look Up"}
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
                                <p className="text-[#4ADE80] text-sm">This faction already has a gate here.</p>
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
                                <p className="text-[#FFD166] text-sm">No gate yet — only this faction's founder or verified creator can buy one.</p>
                            )}
                        </div>
                    ) : (
                        <p className="text-[#8B8F98] text-sm">No faction is using that token yet.</p>
                    )
                )}

                {error && (
                    <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mt-3">
                        {error}
                    </p>
                )}
            </div>
        </div>
    );
}
