// src/features/game/ui/AlaricPanel.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddress, createTransferInstruction } from "@solana/spl-token";
import { Flag, Users, Loader2 } from "lucide-react";
import { useAuth } from "@/core/auth/AuthProvider";
import { getCsrfToken } from "@/core/lib/clientUtils";
import { SoundManager } from "../core/SoundManager";
import { FactionSummary } from "../network/NetworkManager";

const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const FACTION_CREATION_PRICE_TNJ = 1_000_000;

type Stage = "already-founder" | "intro" | "responsibility" | "create" | "success";
type PayState = false | "connecting" | "signing" | "confirming";

interface TokenPreview {
    name: string;
    symbol: string;
    image: string | null;
}

interface AlaricPanelProps {
    isOpen: boolean;
    onClose: () => void;
    myFactions: FactionSummary[];
    skipIntro: boolean;
    gameSlug: string;
    onCreated: () => void;
}

function buildFactionDescriptionPreview(name: string, symbol: string): string {
    return symbol ? `Community faction for ${name} ($${symbol}).` : `Community faction for ${name}.`;
}

function mapCreateError(code: string): string {
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
        default: return code || "Faction creation failed.";
    }
}

export function AlaricPanel({ isOpen, onClose, myFactions, skipIntro, gameSlug, onCreated }: AlaricPanelProps) {
    const { publicKey, connected, wallet } = useWallet();
    const { isAuthorized } = useAuth();

    const [stage, setStage] = useState<Stage>("intro");
    const [createCa, setCreateCa] = useState("");
    const [tokenPreview, setTokenPreview] = useState<TokenPreview | null>(null);
    const [previewStatus, setPreviewStatus] = useState<"idle" | "loading" | "not_found">("idle");
    const [payState, setPayState] = useState<PayState>(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [createdFactionName, setCreatedFactionName] = useState<string | null>(null);

    const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isProcessingRef = useRef(false);
    const wasOpenRef = useRef(false);

    const existingFounded = myFactions.find((f) => f.role === "founder") ?? null;

    useEffect(() => {
        if (isOpen && !wasOpenRef.current) {
            SoundManager.getInstance().play('modal-open');
        }
        wasOpenRef.current = isOpen;
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) {
            setCreateCa("");
            setTokenPreview(null);
            setPreviewStatus("idle");
            setCreateError(null);
            setCreatedFactionName(null);
            return;
        }
        if (existingFounded) {
            setStage("already-founder");
        } else if (skipIntro) {
            setStage("create");
        } else {
            setStage("intro");
        }
    }, [isOpen]);

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
            const amountToSend = BigInt(FACTION_CREATION_PRICE_TNJ) * (10n ** BigInt(decimals));

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
                console.warn("[Alaric] confirmation timeout, relying on backend verification:", confirmErr.message);
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
            setCreatedFactionName(data.faction?.name ?? tokenPreview.name);
            onCreated();
            setStage("success");
        } catch (err: any) {
            console.error("[Alaric] faction creation error:", err);
            setCreateError(mapCreateError(err.message));
        } finally {
            isProcessingRef.current = false;
            setPayState(false);
        }
    }, [tokenPreview, publicKey, connected, wallet, isAuthorized, createCa, gameSlug, onCreated]);

    if (!isOpen) return null;

    const payButtonLabel =
        payState === "connecting" ? "Preparing payment..." :
            payState === "signing" ? "Confirm in wallet..." :
                payState === "confirming" ? "Confirming payment..." :
                    `Pay ${FACTION_CREATION_PRICE_TNJ.toLocaleString("en-US")} TNJ & Create`;

    return (
        <div className="absolute inset-0 bg-[rgba(6,6,8,0.85)] backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto font-oxanium p-4">
            <div className="w-full max-w-md bg-[rgba(18,10,24,0.95)] border-2 border-[#a855f7]/40 rounded-[16px] p-6 shadow-[0_0_35px_rgba(168,85,247,0.15)]">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Flag className="w-5 h-5 text-[#a855f7]" />
                        <h2 className="text-xl font-black text-[#E5E7EB]">Alaric</h2>
                    </div>
                    <button onClick={onClose} className="bg-transparent border-0 p-0 text-[#8B8F98] hover:text-[#E5E7EB] transition-colors">
                        ✕
                    </button>
                </div>

                {stage === "already-founder" && (
                    <div className="space-y-5">
                        <p className="text-[#8B8F98] text-sm">
                            You already lead <span className="text-[#E5E7EB] font-bold">{existingFounded?.name}</span>. One faction
                            is enough to answer for at a time.
                        </p>
                        <button onClick={onClose} className="btn-secondary px-4 py-2 text-sm w-full">
                            Understood
                        </button>
                    </div>
                )}

                {stage === "intro" && (
                    <div className="space-y-5">
                        <p className="text-[#6B7280] text-sm">You've got that look — someone thinking about starting something of their own.</p>
                        <p className="text-[#E5E7EB] text-base font-bold">Do you want to found a faction?</p>
                        <div className="flex gap-2">
                            <button onClick={() => setStage("responsibility")} className="btn-primary px-4 py-2 text-sm flex-1">
                                Yes
                            </button>
                            <button onClick={onClose} className="btn-secondary px-4 py-2 text-sm flex-1">
                                No
                            </button>
                        </div>
                    </div>
                )}

                {stage === "responsibility" && (
                    <div className="space-y-5">
                        <p className="text-[#8B8F98] text-sm">
                            A faction isn't just a badge you slap on your name — people will follow it, grind for it, trust you
                            to lead it somewhere. If you're only in it for a quick payout and planning to vanish, you'll burn
                            everyone who joined in good faith. Only go through with this if you mean to stick around and build
                            something real.
                        </p>
                        <div className="flex gap-2">
                            <button onClick={() => setStage("create")} className="btn-primary px-4 py-2 text-sm flex-1">
                                I understand — continue
                            </button>
                            <button onClick={onClose} className="btn-secondary px-4 py-2 text-sm flex-1">
                                Not right now
                            </button>
                        </div>
                    </div>
                )}

                {stage === "create" && (
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
                            autoFocus
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
                            disabled={!tokenPreview || !!payState}
                            className="btn-primary px-4 py-2 text-sm w-full disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {payState && <Loader2 className="w-4 h-4 animate-spin" />}
                            {payButtonLabel}
                        </button>

                        <div className="mt-2 pt-3 border-t border-[rgba(255,255,255,0.08)] flex gap-2">
                            <span className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-[8px] text-xs font-bold bg-[#a855f7]/15 text-[#a855f7]">
                                <Flag className="w-3.5 h-3.5" />
                                Create Faction
                            </span>
                        </div>
                    </div>
                )}

                {stage === "success" && (
                    <div className="space-y-5">
                        <p className="text-[#8B8F98] text-sm">
                            It's done — <span className="text-[#E5E7EB] font-bold">{createdFactionName}</span> exists now. Lead
                            them well. Good luck out there.
                        </p>
                        <button onClick={onClose} className="btn-primary px-4 py-2 text-sm w-full">
                            Close
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
