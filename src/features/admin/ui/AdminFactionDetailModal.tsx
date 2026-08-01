// src/features/admin/ui/AdminFactionDetailModal.tsx
"use client";

import { useEffect, useState } from "react";

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
}

function truncateWallet(wallet: string): string {
    if (wallet.length <= 10) return wallet;
    return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

function formatDate(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleString();
}

export function AdminFactionDetailModal({ factionId, onClose }: AdminFactionDetailModalProps) {
    const [faction, setFaction] = useState<FactionDetail | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!factionId) {
            setFaction(null);
            return;
        }
        setLoading(true);
        fetch(`/api/admin/factions/${factionId}`, { credentials: "include" })
            .then((r) => r.json())
            .then((data) => setFaction(data.faction || null))
            .finally(() => setLoading(false));
    }, [factionId]);

    if (!factionId) return null;

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
                    </>
                )}
            </div>
        </div>
    );
}
