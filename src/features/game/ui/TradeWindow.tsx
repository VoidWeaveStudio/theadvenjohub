// src/features/game/ui/TradeWindow.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { X, ArrowLeftRight, Package, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { TradeSessionData } from "../network/NetworkManager";
import { PLACEABLE_ITEMS } from "../data/placeableItems";
import { TradeItemPicker } from "./TradeItemPicker";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { CopyableText } from "./shell/CopyableText";
import { SoundManager } from "../core/SoundManager";
import { PayTnjError, payTnj, type PayStage } from "@/core/blockchain/payTnj";
import { clearPendingPayment, readPendingPayment, savePendingPayment } from "@/core/blockchain/pendingPayment";

const TERMINAL_PHASES = new Set(["completed", "failed", "declined", "cancelled", "expired"]);

function truncateWallet(wallet: string) {
    return wallet.length > 10 ? `${wallet.slice(0, 4)}...${wallet.slice(-4)}` : wallet;
}

type PayState = false | "connecting" | "signing" | "confirming";

function PayButton({
    tradeId,
    sellerWallet,
    priceTnj,
    onSubmitPayment,
    onPaid,
}: {
    tradeId: string;
    sellerWallet: string;
    priceTnj: number;
    onSubmitPayment: (tradeId: string, signature: string) => void;
    onPaid: (signature: string) => void;
}) {
    const { t: tr } = useLanguage();
    const { publicKey, connected, wallet } = useWallet();
    const [state, setState] = useState<PayState>(false);
    const [error, setError] = useState<string | null>(null);
    const isProcessingRef = useRef(false);

    const handlePay = useCallback(async () => {
        if (!publicKey || !connected || !wallet?.adapter) {
            setError(tr("g.trade.connectWallet"));
            return;
        }
        if (isProcessingRef.current) return;

        const paymentKey = `trade:${tradeId}`;

        isProcessingRef.current = true;
        setError(null);
        setState("connecting");

        try {
            let signature = readPendingPayment(paymentKey)?.signature ?? null;

            if (!signature) {
                signature = await payTnj({
                    adapter: wallet.adapter,
                    payer: publicKey,
                    amountTnj: priceTnj,
                    recipient: sellerWallet,
                    onStage: (stage: PayStage) => setState(stage === "preparing" ? "connecting" : stage),
                });

                savePendingPayment({ key: paymentKey, signature, amountTnj: priceTnj });
            }

            onPaid(signature);
            onSubmitPayment(tradeId, signature);
            clearPendingPayment(paymentKey);
        } catch (err: any) {
            console.error("[Trade] Payment error:", err);

            if (err instanceof PayTnjError) {
                setError(
                    err.code === "user_rejected" ? tr("g.gate.err.rejected") :
                    err.code === "no_token_account" ? tr("g.shopBuy.err.no_token_account") :
                    err.code === "insufficient_balance" ? tr("g.shopBuy.err.insufficient") :
                    tr("g.trade.paymentFailed")
                );
            } else {
                setError(err?.message?.includes("rejected") ? tr("g.gate.err.rejected") : err?.message || tr("g.trade.paymentFailed"));
            }
        } finally {
            isProcessingRef.current = false;
            setState(false);
        }
    }, [publicKey, connected, wallet, tradeId, sellerWallet, priceTnj, onSubmitPayment, onPaid, tr]);

    if (!publicKey || !connected) {
        return <p className="text-[#8B8F98] text-xs text-center">{tr("g.trade.connectWallet")}</p>;
    }

    const label =
        state === "connecting" ? tr("g.trade.preparing") :
        state === "signing" ? tr("g.trade.signWallet") :
        state === "confirming" ? tr("g.trade.confirming") :
        `Pay ${priceTnj.toLocaleString("en-US")} TNJ`;

    return (
        <div className="space-y-1.5">
            <button
                onClick={handlePay}
                disabled={!!state}
                className="w-full bg-gradient-to-r from-[#4ADE80] to-[#22C55E] disabled:opacity-50 disabled:cursor-not-allowed text-[rgba(12,12,14,0.9)] font-bold px-4 py-2.5 rounded-[8px] transition-all flex items-center justify-center gap-2"
            >
                {!!state && <Loader2 className="w-4 h-4 animate-spin" />}
                {label}
            </button>
            {error && <p className="text-red-400 text-xs text-center">{error}</p>}
        </div>
    );
}

interface TradeWindowProps {
    session: TradeSessionData | null;
    myUserId: string;
    placeables: Record<string, number>;
    onSetOffer: (tradeId: string, itemId: string | null, priceTnj: number | null) => void;
    onSetReady: (tradeId: string, ready: boolean) => void;
    onSubmitPayment: (tradeId: string, signature: string) => void;
    onCancel: (tradeId: string) => void;
    onDismiss: () => void;
}

export function TradeWindow({ session, myUserId, placeables, onSetOffer, onSetReady, onSubmitPayment, onCancel, onDismiss }: TradeWindowProps) {
    const { t } = useLanguage();
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [pendingItemId, setPendingItemId] = useState<string | null>(null);
    const [priceInput, setPriceInput] = useState("");
    const [paidSignature, setPaidSignature] = useState<string | null>(null);

    const wasOpenRef = useRef(false);
    useEffect(() => {
        const isOpen = !!session;
        if (isOpen && !wasOpenRef.current) {
            SoundManager.getInstance().play("modal-open");
        }
        wasOpenRef.current = isOpen;
    }, [session]);

    useEffect(() => {
        if (!session || !TERMINAL_PHASES.has(session.phase)) return;
        const timer = setTimeout(() => onDismiss(), 2500);
        return () => clearTimeout(timer);
    }, [session, onDismiss]);

    useEffect(() => {
        setPendingItemId(null);
        setPriceInput("");
        setPaidSignature(null);
    }, [session?.tradeId]);

    if (!session) return null;

    const me = session.participants.find((p) => p.userId === myUserId);
    const them = session.participants.find((p) => p.userId !== myUserId);
    const isSeller = session.sellerId === myUserId;
    const isBuyer = session.sellerId !== null && session.sellerId !== myUserId;
    const isNegotiating = session.phase === "negotiating";
    const canOffer = isNegotiating && (session.sellerId === null || isSeller);
    const isTerminal = TERMINAL_PHASES.has(session.phase);

    const pendingItem = pendingItemId ? PLACEABLE_ITEMS.find((i) => i.id === pendingItemId) : null;

    const handleClose = () => {
        if (isTerminal) {
            onDismiss();
        } else if (session.phase !== "settling") {
            onCancel(session.tradeId);
        }
    };

    const confirmPendingOffer = () => {
        const price = Number.parseInt(priceInput, 10);
        if (!pendingItemId || !Number.isInteger(price) || price <= 0) return;
        onSetOffer(session.tradeId, pendingItemId, price);
        setPendingItemId(null);
        setPriceInput("");
    };

    const phaseLabel: Record<string, string> = {
        pending_accept: t("g.trade.pending"),
        negotiating: t("g.trade.negotiating"),
        awaiting_payment: t("g.trade.awaitingPayment"),
        settling: t("g.trade.settling"),
        completed: t("g.trade.completed"),
        failed: t("g.trade.failed"),
        declined: t("g.trade.declined"),
        cancelled: t("g.trade.cancelled"),
        expired: t("g.trade.expired"),
    };

    return (
        <div className="absolute inset-0 bg-[rgba(6,6,8,0.85)] backdrop-blur-sm flex flex-col items-center justify-center z-50 pointer-events-auto font-oxanium gap-4 p-2 sm:p-4">
            <div className="flex items-center justify-between w-full max-w-2xl">
                <div className="flex items-center gap-2">
                    <ArrowLeftRight className="w-5 h-5 text-[#4FD1FF]" />
                    <h2 className="text-xl font-black text-[#E5E7EB]">{t("g.trade.title")}</h2>
                    <span className="text-xs text-[#8B8F98] font-semibold ml-2">{phaseLabel[session.phase] ?? session.phase}</span>
                </div>
                <button
                    onClick={handleClose}
                    disabled={session.phase === "settling"}
                    className="bg-transparent border-0 p-0 text-[#8B8F98] hover:text-[#E5E7EB] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {isTerminal && (
                <div className="w-full max-w-2xl flex items-center justify-center gap-2 py-2">
                    {session.phase === "completed" ? (
                        <CheckCircle2 className="w-5 h-5 text-[#4ADE80]" />
                    ) : (
                        <XCircle className="w-5 h-5 text-red-400" />
                    )}
                    <span className="text-[#E5E7EB] font-bold">{phaseLabel[session.phase]}</span>
                </div>
            )}

            {session.phase !== "pending_accept" && them && (
                <div className="flex gap-4 w-full max-w-2xl">
                    {[me, them].map((p, idx) => (
                        <div
                            key={p?.userId ?? idx}
                            className="flex-1 bg-[rgba(12,12,14,0.92)] border border-[rgba(255,255,255,0.1)] rounded-[16px] p-4 shadow-2xl"
                        >
                            <div className="text-[#8B8F98] text-[10px] font-bold tracking-wider mb-2">{idx === 0 ? t("g.trade.you") : t("g.trade.them")}</div>
                            <div className="text-[#E5E7EB] font-bold mb-1 truncate">{p?.nickname ?? "..."}</div>
                            {p && <CopyableText value={p.wallet} display={truncateWallet(p.wallet)} className="text-[11px] text-[#6B7280]" />}
                            <label className="flex items-center gap-2 mt-3 text-sm text-[#C9CDD3]">
                                <input
                                    type="checkbox"
                                    checked={p?.ready ?? false}
                                    disabled={idx !== 0 || !isNegotiating || !session.itemId}
                                    onChange={(e) => onSetReady(session.tradeId, e.target.checked)}
                                    className="w-4 h-4 accent-[#4FD1FF]"
                                />
                                {t("g.trade.ready")}
                            </label>
                        </div>
                    ))}
                </div>
            )}

            {session.phase !== "pending_accept" && (
                <div className="w-full max-w-2xl bg-[rgba(20,16,8,0.92)] border-2 border-[#FFD166]/50 rounded-[16px] p-4 shadow-[0_0_35px_rgba(255,209,102,0.15)]">
                    <div className="flex items-center gap-2 mb-3">
                        <Package className="w-4 h-4 text-[#FFD166]" />
                        <span className="text-[#FFD166] text-xs font-bold tracking-wider">{t("g.trade.itemForSale")}</span>
                    </div>

                    {pendingItem ? (
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">{pendingItem.icon}</span>
                            <span className="flex-1 text-[#E5E7EB] font-bold">{t(pendingItem.name)}</span>
                            <input
                                type="number"
                                min={1}
                                step={1}
                                value={priceInput}
                                onChange={(e) => setPriceInput(e.target.value)}
                                placeholder={t("g.trade.pricePlaceholder")}
                                className="w-32 bg-black/40 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-[#E5E7EB]"
                            />
                            <button
                                onClick={confirmPendingOffer}
                                disabled={!Number.isInteger(Number.parseInt(priceInput, 10)) || Number.parseInt(priceInput, 10) <= 0}
                                className="bg-[#4FD1FF] disabled:opacity-40 text-[rgba(12,12,14,0.9)] font-bold px-3 py-1.5 rounded-lg text-sm"
                            >
                                {t("g.trade.confirm")}
                            </button>
                            <button
                                onClick={() => { setPendingItemId(null); setPriceInput(""); }}
                                className="bg-transparent border-0 text-[#8B8F98] hover:text-[#E5E7EB] text-sm"
                            >
                                {t("g.trade.cancel")}
                            </button>
                        </div>
                    ) : session.itemId ? (
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">{PLACEABLE_ITEMS.find((i) => i.id === session.itemId)?.icon ?? "📦"}</span>
                            <span className="flex-1 text-[#E5E7EB] font-bold">{session.itemName ? t(session.itemName) : ""}</span>
                            <span className="text-[#FFD166] font-bold">{session.priceTnj?.toLocaleString("en-US")} TNJ</span>
                            {canOffer && (
                                <button
                                    onClick={() => onSetOffer(session.tradeId, null, null)}
                                    className="bg-transparent border-0 text-[#8B8F98] hover:text-red-400 text-sm"
                                >
                                    {t("g.trade.remove")}
                                </button>
                            )}
                        </div>
                    ) : canOffer ? (
                        <button
                            onClick={() => setIsPickerOpen(true)}
                            className="w-full bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,209,102,0.12)] border border-dashed border-[#FFD166]/40 rounded-lg py-3 text-[#FFD166] text-sm font-bold transition-colors"
                        >
                            {t("g.trade.addItem")}
                        </button>
                    ) : (
                        <p className="text-[#6B7280] text-sm text-center py-2">{t("g.trade.waitingOffer")}</p>
                    )}
                </div>
            )}

            {session.phase === "awaiting_payment" && isBuyer && session.priceTnj !== null && (
                <div className="w-full max-w-2xl">
                    {paidSignature ? (
                        <div className="space-y-1.5">
                            <p className="text-[#8B8F98] text-xs text-center">
                                {t("g.trade.paymentSentRetry")}
                            </p>
                            <button
                                onClick={() => onSubmitPayment(session.tradeId, paidSignature)}
                                className="w-full bg-[#4FD1FF] text-[rgba(12,12,14,0.9)] font-bold px-4 py-2.5 rounded-[8px] transition-all"
                            >
                                {t("g.trade.retryVerification")}
                            </button>
                            <CopyableText
                                value={paidSignature}
                                display={`${paidSignature.slice(0, 8)}...${paidSignature.slice(-8)}`}
                                className="text-[10px] text-[#6B7280] block text-center"
                            />
                        </div>
                    ) : (
                        <PayButton
                            tradeId={session.tradeId}
                            sellerWallet={them?.wallet ?? ""}
                            priceTnj={session.priceTnj}
                            onSubmitPayment={onSubmitPayment}
                            onPaid={setPaidSignature}
                        />
                    )}
                </div>
            )}
            {session.phase === "awaiting_payment" && isSeller && (
                <p className="text-[#8B8F98] text-xs text-center">{t("g.trade.waitingPayment")}</p>
            )}
            {session.phase === "settling" && (
                <div className="flex items-center gap-2 text-[#8B8F98] text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" /> {t("g.trade.verifying")}
                </div>
            )}
            {session.phase === "pending_accept" && (
                <p className="text-[#8B8F98] text-sm text-center">{t("g.trade.waitingAccept", { name: them?.nickname ?? t("g.trade.otherPlayer") })}</p>
            )}

            <TradeItemPicker
                isOpen={isPickerOpen}
                onClose={() => setIsPickerOpen(false)}
                placeables={placeables}
                onSelect={(itemId) => setPendingItemId(itemId)}
            />
        </div>
    );
}
