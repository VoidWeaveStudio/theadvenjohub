// src/features/admin/ui/AdminFactionDetailModal.tsx
"use client";

import { useEffect, useState } from "react";
import { useAdminSignature } from "../lib/useAdminSignature";

interface FactionDetail {
    id: string;
    number: number;
    name: string;
    symbol: string | null;
    image: string | null;
    description: string;
    tokenCa: string | null;
    founderWallet: string;
    verifiedCreatorWallet: string | null;
    createdAt: string;
    promoCode: string | null;
    promoCodePurchaseTx: string | null;
    promoCodePurchasedAt: string | null;
    hasGate: boolean;
    gatePurchaseTx: string | null;
    gatePurchasedAt: string | null;
    level: number;
    levelProgressAsh: number;
    xpForNextLevel: number;
    activeTask: {
        key: string;
        target: number;
        progress: number;
        rewardAsh: number;
        acceptedAt: string | null;
        acceptedByNickname: string | null;
    } | null;
    taskHistory: {
        id: string;
        taskKey: string;
        rewardAsh: number;
        rewardWallet: string;
        rewardNickname: string | null;
        completedAt: string;
    }[];
    roster: {
        userId: string;
        wallet: string;
        role: string;
        nickname: string | null;
        contributionPoints: number;
        tasksContributed: number;
        joinedAt: string;
    }[];
}

interface AdminFactionDetailModalProps {
    factionId: string | null;
    onClose: () => void;
    onDeleted: (factionId: string) => void;
}

function truncateWallet(wallet: string): string {
    if (wallet.length <= 10) return wallet;
    return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

function formatDate(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleString();
}

export function AdminFactionDetailModal({ factionId, onClose, onDeleted }: AdminFactionDetailModalProps) {
    const [faction, setFaction] = useState<FactionDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [granting, setGranting] = useState(false);
    const [grantingGate, setGrantingGate] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const { signedFetch } = useAdminSignature();

    useEffect(() => {
        if (!factionId) {
            setFaction(null);
            return;
        }
        setLoading(true);
        setActionError(null);
        fetch(`/api/admin/factions/${factionId}`, { credentials: "include" })
            .then((r) => r.json())
            .then((data) => setFaction(data.faction || null))
            .finally(() => setLoading(false));
    }, [factionId]);

    if (!factionId) return null;

    const grantPromoCode = async () => {
        setActionError(null);
        setGranting(true);
        try {
            const res = await signedFetch(`/api/admin/factions/${factionId}/promo-code`, "grantPromoCode", factionId, {});
            const data = await res.json();
            if (res.ok) {
                setFaction((prev) => (prev ? { ...prev, promoCode: data.promoCode, promoCodePurchaseTx: null, promoCodePurchasedAt: new Date().toISOString() } : prev));
            } else {
                setActionError(data.error === "already_granted" ? "This faction already has a promo code" : "Failed to grant promo code");
            }
        } catch (err: any) {
            setActionError(err.message || "Signature failed");
        } finally {
            setGranting(false);
        }
    };

    const grantGate = async () => {
        setActionError(null);
        setGrantingGate(true);
        try {
            const res = await signedFetch(`/api/admin/factions/${factionId}/grant-gate`, "grantFactionGate", factionId, {});
            const data = await res.json();
            if (res.ok) {
                setFaction((prev) => (prev ? { ...prev, hasGate: true, gatePurchaseTx: null, gatePurchasedAt: data.gate?.purchasedAt ?? new Date().toISOString() } : prev));
            } else {
                setActionError(data.error === "already_granted" ? "This faction already has a Token Gate" : "Failed to grant gate access");
            }
        } catch (err: any) {
            setActionError(err.message || "Signature failed");
        } finally {
            setGrantingGate(false);
        }
    };

    const deleteFaction = async () => {
        if (!faction) return;
        if (!confirm(`Delete faction "${faction.name}" #${faction.number} and remove all ${faction.roster.length} members? This cannot be undone.`)) return;

        setActionError(null);
        setDeleting(true);
        try {
            const res = await signedFetch(`/api/admin/factions/${factionId}`, "deleteFaction", factionId, {}, "DELETE");
            if (res.ok) {
                onDeleted(factionId);
                onClose();
            } else {
                setActionError("Failed to delete faction");
            }
        } catch (err: any) {
            setActionError(err.message || "Signature failed");
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="w-full max-w-lg max-h-[85vh] overflow-y-auto bg-[#0a0a0c] border border-[rgba(255,255,255,0.1)] rounded-xl p-6 space-y-5"
                onClick={(e) => e.stopPropagation()}
            >
                {loading || !faction ? (
                    <p className="text-[#8B8F98] text-sm text-center py-10">Loading...</p>
                ) : (
                    <>
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                {faction.image ? (
                                    <img src={faction.image} alt="" className="w-10 h-10 rounded-lg object-cover" />
                                ) : (
                                    <div className="w-10 h-10 rounded-lg bg-white/5" />
                                )}
                                <div>
                                    <h2 className="text-white text-lg font-bold">
                                        {faction.name} #{faction.number}
                                        {faction.symbol && <span className="text-[#8B8F98] text-sm ml-1">${faction.symbol}</span>}
                                    </h2>
                                    <span className="bg-[rgba(79,209,255,0.15)] text-[#4FD1FF] text-xs font-bold px-2 py-0.5 rounded-full">
                                        Lv. {faction.level}
                                    </span>
                                </div>
                            </div>
                            <button onClick={onClose} className="text-[#8B8F98] hover:text-white text-sm">✕</button>
                        </div>

                        <div>
                            <div className="flex items-center justify-between text-xs text-[#8B8F98] mb-1">
                                <span>Level progress</span>
                                <span>{faction.levelProgressAsh} / {faction.xpForNextLevel} Ash</span>
                            </div>
                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-[#4FD1FF] rounded-full"
                                    style={{ width: `${Math.min(100, (faction.levelProgressAsh / faction.xpForNextLevel) * 100)}%` }}
                                />
                            </div>
                        </div>

                        <div className="text-xs text-[#8B8F98] space-y-1">
                            <div>Founder: <span className="font-mono">{truncateWallet(faction.founderWallet)}</span></div>
                            {faction.verifiedCreatorWallet && (
                                <div>Verified creator: <span className="font-mono">{truncateWallet(faction.verifiedCreatorWallet)}</span></div>
                            )}
                            {faction.tokenCa && <div>Token CA: <span className="font-mono break-all">{faction.tokenCa}</span></div>}
                            <div>Created: {formatDate(faction.createdAt)}</div>
                        </div>

                        {faction.description && <p className="text-[#8B8F98] text-sm">{faction.description}</p>}

                        <div>
                            <div className="text-[#8B8F98] text-xs font-bold tracking-wider mb-2">ACTIVE TASK</div>
                            {!faction.activeTask ? (
                                <p className="text-[#6B7280] text-xs">No active task.</p>
                            ) : (
                                <div className="bg-white/5 rounded-lg p-3 text-xs space-y-1">
                                    <div className="text-white font-bold">{faction.activeTask.key}</div>
                                    <div className="text-[#8B8F98]">Progress: {faction.activeTask.progress}/{faction.activeTask.target}</div>
                                    <div className="text-[#FFD166]">Reward: {faction.activeTask.rewardAsh} Ash</div>
                                    <div className="text-[#6B7280]">Accepted by {faction.activeTask.acceptedByNickname || "—"} at {formatDate(faction.activeTask.acceptedAt)}</div>
                                </div>
                            )}
                        </div>

                        <div>
                            <div className="text-[#8B8F98] text-xs font-bold tracking-wider mb-2">RECENT TASK HISTORY ({faction.taskHistory.length})</div>
                            {faction.taskHistory.length === 0 ? (
                                <p className="text-[#6B7280] text-xs">None yet.</p>
                            ) : (
                                <div className="space-y-1">
                                    {faction.taskHistory.map((h) => (
                                        <div key={h.id} className="flex items-center justify-between text-xs bg-white/5 rounded-lg px-3 py-1.5">
                                            <span className="text-white">{h.taskKey}</span>
                                            <span className="text-[#FFD166]">+{h.rewardAsh} → {h.rewardNickname || truncateWallet(h.rewardWallet)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <div className="text-[#8B8F98] text-xs font-bold tracking-wider mb-2">ROSTER ({faction.roster.length})</div>
                            <div className="space-y-1 max-h-52 overflow-y-auto">
                                {faction.roster.map((m) => (
                                    <div key={m.userId} className="flex items-center justify-between text-xs bg-white/5 rounded-lg px-3 py-1.5">
                                        <span className="text-white">{m.nickname || truncateWallet(m.wallet)} <span className="text-[#6B7280]">({m.role})</span></span>
                                        <span className="text-[#FFD166]">{m.contributionPoints} pts / {m.tasksContributed} tasks</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="border-t border-white/10 pt-4 space-y-3">
                            {actionError && (
                                <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                                    {actionError}
                                </p>
                            )}
                            <p className="text-[#6B7280] text-[11px]">
                                Actions below require signing with your admin wallet.
                            </p>

                            <div>
                                <div className="text-[#8B8F98] text-xs font-bold tracking-wider mb-2">PROMO CODE UPGRADE</div>
                                {faction.promoCode ? (
                                    <div className="bg-[rgba(255,209,102,0.08)] border border-[rgba(255,209,102,0.25)] rounded-lg px-3 py-2 text-xs space-y-1">
                                        <div className="text-[#FFD166] font-bold tracking-widest">{faction.promoCode}</div>
                                        <div className="text-[#6B7280]">
                                            {faction.promoCodePurchaseTx ? "Purchased" : "Granted by admin"} — {formatDate(faction.promoCodePurchasedAt)}
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={grantPromoCode}
                                        disabled={granting}
                                        className="btn-secondary px-3 py-1.5 text-xs text-[#4ADE80] disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {granting ? "Granting..." : "Grant Promo Code Upgrade"}
                                    </button>
                                )}
                            </div>

                            <div>
                                <div className="text-[#8B8F98] text-xs font-bold tracking-wider mb-2">TOKEN GATE ACCESS</div>
                                {faction.hasGate ? (
                                    <div className="bg-[rgba(79,209,255,0.08)] border border-[rgba(79,209,255,0.25)] rounded-lg px-3 py-2 text-xs space-y-1">
                                        <div className="text-[#4FD1FF] font-bold">Has private room</div>
                                        <div className="text-[#6B7280]">
                                            {faction.gatePurchaseTx ? "Purchased" : "Granted by admin"} — {formatDate(faction.gatePurchasedAt)}
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={grantGate}
                                        disabled={grantingGate}
                                        className="btn-secondary px-3 py-1.5 text-xs text-[#4ADE80] disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {grantingGate ? "Granting..." : "Grant Free Gate Access"}
                                    </button>
                                )}
                            </div>

                            <div>
                                <div className="text-red-400 text-xs font-bold tracking-wider mb-2">DANGER ZONE</div>
                                <button
                                    onClick={deleteFaction}
                                    disabled={deleting}
                                    className="btn-secondary px-3 py-1.5 text-xs text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {deleting ? "Deleting..." : "Delete Faction"}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
