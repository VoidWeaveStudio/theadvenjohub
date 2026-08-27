// src/features/admin/ui/AdminFactionQuestsTable.tsx
"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { ExternalLink, Trash2 } from "lucide-react";
import { useAdminSignature } from "../lib/useAdminSignature";
import { AdminTableRef } from "./AdminTableRef";
import { Alert, Badge, Chips, Empty, SearchInput, Tile, formatDate, formatNumber, truncateWallet } from "./AdminKit";

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

type StatusFilter = "all" | "active" | "finished";

const STATUS_OPTIONS: { id: StatusFilter; label: string }[] = [
    { id: "all", label: "All quests" },
    { id: "active", label: "Active" },
    { id: "finished", label: "Finished" },
];

export const AdminFactionQuestsTable = forwardRef<AdminTableRef>(function AdminFactionQuestsTable(_props, ref) {
    const [quests, setQuests] = useState<AdminFactionQuest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState<StatusFilter>("all");
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

    const visible = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return quests.filter((quest) => {
            if (status === "active" && quest.status !== "active") return false;
            if (status === "finished" && quest.status === "active") return false;
            if (!needle) return true;
            return `${quest.factionName} ${quest.factionSymbol || ""} ${quest.createdByNickname || ""} ${quest.createdByWallet} ${quest.targetUrl}`
                .toLowerCase()
                .includes(needle);
        });
    }, [quests, query, status]);

    const remove = async (quest: AdminFactionQuest) => {
        const confirmed = window.confirm(
            `Delete this quest from ${quest.factionName}?\n\n` +
            `${quest.slotsClaimed}/${quest.slotsTotal} players already rewarded.\n` +
            `${quest.bankRemainingAsh} Ash still sits in the quest bank and will NOT be refunded.`
        );
        if (!confirmed) return;

        setError(null);
        setBusyId(quest.id);
        try {
            const res = await signedFetch(`/api/admin/faction-quests/${quest.id}`, "faction_quest_delete", quest.id, {}, "DELETE");
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data.error || "Delete failed");
                return;
            }
            setQuests((prev) => prev.filter((q) => q.id !== quest.id));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Delete failed");
        } finally {
            setBusyId(null);
        }
    };

    const activeCount = quests.filter((q) => q.status === "active").length;
    const bankLeft = quests.reduce((sum, q) => sum + q.bankRemainingAsh, 0);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="a-row">
                <SearchInput value={query} onChange={setQuery} placeholder="Search faction, author or target URL…" />
                <Chips value={status} options={STATUS_OPTIONS} onChange={setStatus} />
                <span className="a-hint a-spacer">
                    {activeCount} active · {formatNumber(bankLeft)} Ash unspent
                </span>
            </div>

            {error && <Alert tone="bad">{error}</Alert>}

            {loading && quests.length === 0 ? (
                <Empty>Loading…</Empty>
            ) : visible.length === 0 ? (
                <Empty>No faction quests match.</Empty>
            ) : (
                <div className="a-list">
                    {visible.map((quest) => (
                        <article key={quest.id} className="a-item" style={{ flexDirection: "column", alignItems: "stretch", gap: 9, padding: 12 }}>
                            <div className="a-row" style={{ flexWrap: "nowrap" }}>
                                {quest.factionImage ? (
                                    <img src={quest.factionImage} alt="" style={{ width: 32, height: 32, borderRadius: 999, objectFit: "cover" }} />
                                ) : (
                                    <div style={{ width: 32, height: 32, borderRadius: 999, background: "var(--a-panel-3)" }} />
                                )}
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div className="a-row" style={{ gap: 7 }}>
                                        <span style={{ fontWeight: 700 }}>{quest.factionName}</span>
                                        {quest.factionSymbol && <span className="a-hint">${quest.factionSymbol}</span>}
                                        <Badge tone={quest.status === "active" ? "good" : "neutral"}>{quest.status.toUpperCase()}</Badge>
                                    </div>
                                    <div className="a-hint">
                                        by {quest.createdByNickname || truncateWallet(quest.createdByWallet)} · {formatDate(quest.createdAt)}
                                    </div>
                                </div>
                                <button type="button" className="a-btn a-btn-sm a-btn-danger" disabled={busyId === quest.id} onClick={() => remove(quest)}>
                                    <Trash2 />
                                    {busyId === quest.id ? "Deleting…" : "Delete"}
                                </button>
                            </div>

                            <a
                                href={quest.targetUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="a-row"
                                style={{ gap: 6, color: "var(--a-accent)", fontSize: 12, flexWrap: "nowrap", minWidth: 0 }}
                            >
                                <ExternalLink className="w-3 h-3" />
                                <span className="a-item-title">{quest.targetUrl}</span>
                            </a>

                            <div className="a-grid a-grid-3">
                                <Tile label="Rewarded" value={`${quest.slotsClaimed} / ${quest.slotsTotal}`} />
                                <Tile label="Slots left" value={formatNumber(quest.slotsRemaining)} />
                                <Tile label="Reward each" value={`${formatNumber(quest.rewardAsh)} Ash`} />
                                <Tile label="Bank" value={`${formatNumber(quest.bankAsh)} Ash`} />
                                <Tile label="Paid out" value={`${formatNumber(quest.paidOutAsh)} Ash`} />
                                <Tile label="Bank left" value={`${formatNumber(quest.bankRemainingAsh)} Ash`} />
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
});
