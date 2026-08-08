// src/features/admin/ui/AdminFactionQuestsTable.tsx
"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { ExternalLink, Trash2 } from "lucide-react";
import { useAdminSignature } from "../lib/useAdminSignature";
import { AdminTableRef } from "./AdminTableRef";

interface AdminFactionQuest {
    id: string;
    factionId: string;
    factionName: string;
    factionSymbol: string | null;
    factionImage: string | null;
    createdByWallet: string;
    createdByNickname: string | null;
    questType: string;
    targetUrl: string;
    rewardAsh: number;
    slotsTotal: number;
    slotsClaimed: number;
    slotsRemaining: number;
    bankAsh: number;
    paidOutAsh: number;
    bankRemainingAsh: number;
    listingFeeAsh: number;
    status: string;
    createdAt: string;
    completedAt: string | null;
}

function truncateWallet(wallet: string): string {
    if (wallet.length <= 10) return wallet;
    return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

export const AdminFactionQuestsTable = forwardRef<AdminTableRef>(function AdminFactionQuestsTable(_props, ref) {
    const [quests, setQuests] = useState<AdminFactionQuest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const { signedFetch } = useAdminSignature();

    const load = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/faction-quests", { credentials: "include" });
            if (res.ok) {
                const data = await res.json();
                setQuests(data.quests || []);
            }
        } finally {
            setLoading(false);
        }
    };

    useImperativeHandle(ref, () => ({ refresh: load }));

    useEffect(() => {
        load();
    }, []);

    const remove = async (quest: AdminFactionQuest) => {
        const remaining = quest.bankRemainingAsh;
        const confirmed = window.confirm(
            `Delete this quest from ${quest.factionName}?\n\n` +
            `${quest.slotsClaimed}/${quest.slotsTotal} players already rewarded.\n` +
            `${remaining} Ash still sits in the quest bank and will NOT be refunded.`
        );
        if (!confirmed) return;

        setError(null);
        setBusyId(quest.id);
        try {
            const res = await signedFetch(
                `/api/admin/faction-quests/${quest.id}`,
                "faction_quest_delete",
                quest.id,
                {},
                "DELETE"
            );
            if (res.ok) {
                setQuests((prev) => prev.filter((q) => q.id !== quest.id));
            } else {
                const data = await res.json().catch(() => ({}));
                setError(data.error || "Delete failed");
            }
        } catch (err: any) {
            setError(err.message || "Delete failed");
        } finally {
            setBusyId(null);
        }
    };

    if (loading) return <div className="text-[#8B8F98] text-sm">Loading quests...</div>;

    return (
        <div className="space-y-3">
            {error && (
                <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>
            )}

            {quests.length === 0 ? (
                <div className="text-[#8B8F98] text-sm">No faction quests have been published yet.</div>
            ) : (
                <div className="space-y-2">
                    {quests.map((quest) => (
                        <div key={quest.id} className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2">
                            <div className="flex items-center gap-3">
                                {quest.factionImage ? (
                                    <img src={quest.factionImage} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                                ) : (
                                    <div className="w-9 h-9 rounded-full bg-white/10 flex-shrink-0" />
                                )}
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-white font-bold text-sm truncate">{quest.factionName}</span>
                                        {quest.factionSymbol && (
                                            <span className="text-[#8B8F98] text-xs">${quest.factionSymbol}</span>
                                        )}
                                        <span
                                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${quest.status === "active"
                                                ? "bg-green-500/15 text-green-400"
                                                : "bg-white/10 text-[#8B8F98]"
                                                }`}
                                        >
                                            {quest.status.toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="text-[#8B8F98] text-xs">
                                        by {quest.createdByNickname || truncateWallet(quest.createdByWallet)} ·{" "}
                                        {new Date(quest.createdAt).toLocaleString()}
                                    </div>
                                </div>
                                <button
                                    onClick={() => remove(quest)}
                                    disabled={busyId === quest.id}
                                    className="flex items-center gap-1.5 text-red-400 hover:text-red-300 text-xs font-bold px-2 py-1 disabled:opacity-50"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    {busyId === quest.id ? "Deleting..." : "Delete"}
                                </button>
                            </div>

                            <a
                                href={quest.targetUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 text-xs truncate"
                            >
                                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="truncate">{quest.targetUrl}</span>
                            </a>

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-[#8B8F98]">Rewarded</span>
                                    <span className="text-white font-bold">{quest.slotsClaimed} / {quest.slotsTotal}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-[#8B8F98]">Slots left</span>
                                    <span className="text-white font-bold">{quest.slotsRemaining}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-[#8B8F98]">Reward each</span>
                                    <span className="text-white font-bold">{quest.rewardAsh}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-[#8B8F98]">Bank</span>
                                    <span className="text-amber-400 font-bold">{quest.bankAsh}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-[#8B8F98]">Paid out</span>
                                    <span className="text-white font-bold">{quest.paidOutAsh}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-[#8B8F98]">Bank left</span>
                                    <span className="text-white font-bold">{quest.bankRemainingAsh}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});
