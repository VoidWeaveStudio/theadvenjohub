// src/features/admin/ui/AdminFactionDetailModal.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { useAdminSignature } from "../lib/useAdminSignature";
import { Alert, Badge, Empty, Modal, Tile, formatDate, formatNumber, truncateWallet } from "./AdminKit";

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
    tokenCreatorWallet: string | null;
    roomAccess: string;
    createdAt: string;
    creationTx: string | null;
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
    onChanged?: () => void;
}

type Tab = "overview" | "perks" | "roster";

export function AdminFactionDetailModal({ factionId, onClose, onDeleted, onChanged }: AdminFactionDetailModalProps) {
    const [faction, setFaction] = useState<FactionDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [tab, setTab] = useState<Tab>("overview");
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [levelInput, setLevelInput] = useState("1");
    const [progressInput, setProgressInput] = useState("0");
    const [rosterQuery, setRosterQuery] = useState("");
    const { signedFetch } = useAdminSignature();

    const load = useCallback(async () => {
        if (!factionId) return;
        const res = await fetch(`/api/admin/factions/${factionId}`, { credentials: "include" });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.faction) {
            setFaction(null);
            setError(data?.error || `HTTP ${res.status}`);
            return;
        }
        setFaction(data.faction);
        setLevelInput(String(data.faction.level ?? 1));
        setProgressInput(String(data.faction.levelProgressAsh ?? 0));
    }, [factionId]);

    useEffect(() => {
        if (!factionId) {
            setFaction(null);
            return;
        }
        setTab("overview");
        setError(null);
        setNotice(null);
        setRosterQuery("");
        setLoading(true);
        load().finally(() => setLoading(false));
    }, [factionId, load]);

    if (!factionId) return null;

    const perk = async (action: string, body: Record<string, unknown> = {}, label = "Action") => {
        setError(null);
        setNotice(null);
        setBusy(true);
        try {
            const res = await signedFetch(`/api/admin/factions/${factionId}/perks`, `faction_${action}`, factionId, { action, ...body });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(`${label} failed — ${data?.error || `HTTP ${res.status}`}`);
                return;
            }
            setNotice(`${label} done.`);
            await load();
            onChanged?.();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Signature failed");
        } finally {
            setBusy(false);
        }
    };

    const deleteFaction = async () => {
        if (!faction) return;
        if (!confirm(`Delete "${faction.name}" #${faction.number} and remove all ${faction.roster.length} members? This cannot be undone.`)) return;

        setError(null);
        setBusy(true);
        try {
            const res = await signedFetch(`/api/admin/factions/${factionId}`, "deleteFaction", factionId, {}, "DELETE");
            if (!res.ok) {
                setError("Failed to delete faction");
                return;
            }
            onDeleted(factionId);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Signature failed");
        } finally {
            setBusy(false);
        }
    };

    const roster = faction
        ? faction.roster.filter((member) => {
            const needle = rosterQuery.trim().toLowerCase();
            if (!needle) return true;
            return `${member.nickname || ""} ${member.wallet} ${member.role}`.toLowerCase().includes(needle);
        })
        : [];

    return (
        <Modal onClose={onClose}>
            {loading || !faction ? (
                <div className="a-modal-body">
                    {error ? <Alert tone="bad">{error}</Alert> : <Empty>Loading faction…</Empty>}
                </div>
            ) : (
                <>
                    <header className="a-modal-head">
                        {faction.image ? (
                            <img src={faction.image} alt="" style={{ width: 44, height: 44, borderRadius: 11, objectFit: "cover" }} />
                        ) : (
                            <div style={{ width: 44, height: 44, borderRadius: 11, background: "var(--a-panel-3)" }} />
                        )}
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <div className="a-row" style={{ gap: 8 }}>
                                <span className="a-top-title">
                                    {faction.name} <span className="a-hint">#{faction.number}</span>
                                </span>
                                {faction.symbol && <Badge tone="info">${faction.symbol}</Badge>}
                                <Badge tone="violet">Lv. {faction.level}</Badge>
                            </div>
                            <div className="a-pills" style={{ marginTop: 6 }}>
                                {faction.hasGate && <Badge tone={faction.gatePurchaseTx ? "good" : "info"}>Gate room</Badge>}
                                {faction.promoCode && <Badge tone={faction.promoCodePurchaseTx ? "good" : "info"}>Promo {faction.promoCode}</Badge>}
                                {faction.creationTx && <Badge tone="warn">Founded on-chain</Badge>}
                            </div>
                        </div>
                        <button type="button" className="a-icon-btn" onClick={onClose} aria-label="Close">
                            <X className="w-4 h-4" />
                        </button>
                    </header>

                    <div className="a-tabs">
                        {(["overview", "perks", "roster"] as Tab[]).map((entry) => (
                            <button key={entry} type="button" className="a-tab" data-active={tab === entry} onClick={() => setTab(entry)}>
                                {entry === "overview" ? "Overview" : entry === "perks" ? "Paid perks" : `Roster (${faction.roster.length})`}
                            </button>
                        ))}
                    </div>

                    <div className="a-modal-body">
                        {error && <Alert tone="bad">{error}</Alert>}
                        {notice && !error && <Alert tone="good">{notice}</Alert>}

                        {tab === "overview" && (
                            <>
                                <section>
                                    <div className="a-row" style={{ justifyContent: "space-between", marginBottom: 5 }}>
                                        <span className="a-hint">Level progress</span>
                                        <span className="a-hint">
                                            {formatNumber(faction.levelProgressAsh)} / {formatNumber(faction.xpForNextLevel)} Ash
                                        </span>
                                    </div>
                                    <div className="a-bar">
                                        <span style={{ width: `${Math.min(100, (faction.levelProgressAsh / Math.max(1, faction.xpForNextLevel)) * 100)}%` }} />
                                    </div>
                                </section>

                                <div className="a-grid a-grid-2">
                                    <Tile label="Founder" value={truncateWallet(faction.founderWallet)} />
                                    <Tile label="Verified creator" value={faction.verifiedCreatorWallet ? truncateWallet(faction.verifiedCreatorWallet) : "—"} />
                                    <Tile label="Token CA" value={faction.tokenCa || "—"} />
                                    <Tile label="Created" value={formatDate(faction.createdAt)} />
                                </div>

                                {faction.description && <p className="a-hint">{faction.description}</p>}

                                <section>
                                    <span className="a-label">Active task</span>
                                    {!faction.activeTask ? (
                                        <p className="a-hint">No active task.</p>
                                    ) : (
                                        <div className="a-item" style={{ alignItems: "flex-start", flexDirection: "column", gap: 4 }}>
                                            <span style={{ fontWeight: 700 }}>{faction.activeTask.key}</span>
                                            <span className="a-hint">
                                                Progress {faction.activeTask.progress}/{faction.activeTask.target} · reward {formatNumber(faction.activeTask.rewardAsh)} Ash
                                            </span>
                                            <span className="a-hint">
                                                Accepted by {faction.activeTask.acceptedByNickname || "—"} at {formatDate(faction.activeTask.acceptedAt)}
                                            </span>
                                            <button type="button" className="a-btn a-btn-sm a-btn-danger" disabled={busy} onClick={() => perk("clearTask", {}, "Task reset")}>
                                                Clear active task
                                            </button>
                                        </div>
                                    )}
                                </section>

                                <section>
                                    <span className="a-label">Recent task history ({faction.taskHistory.length})</span>
                                    {faction.taskHistory.length === 0 ? (
                                        <p className="a-hint">None yet.</p>
                                    ) : (
                                        <div className="a-list">
                                            {faction.taskHistory.map((entry) => (
                                                <div key={entry.id} className="a-item">
                                                    <span className="a-item-title">{entry.taskKey}</span>
                                                    <span className="a-hint a-spacer">{formatDate(entry.completedAt)}</span>
                                                    <span style={{ color: "var(--a-warn)", fontWeight: 700 }}>
                                                        +{formatNumber(entry.rewardAsh)} → {entry.rewardNickname || truncateWallet(entry.rewardWallet)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>
                            </>
                        )}

                        {tab === "perks" && (
                            <>
                                <p className="a-hint">Every perk below is normally bought with TNJ. Granting one here hands it over for free.</p>

                                <section>
                                    <span className="a-label">Promo code — grants the game to whoever redeems it</span>
                                    {faction.promoCode ? (
                                        <div className="a-item">
                                            <span style={{ color: "var(--a-warn)", fontWeight: 800, letterSpacing: "0.16em" }}>{faction.promoCode}</span>
                                            <Badge tone={faction.promoCodePurchaseTx ? "good" : "info"}>
                                                {faction.promoCodePurchaseTx ? "purchased" : "granted by admin"}
                                            </Badge>
                                            <span className="a-hint a-spacer">{formatDate(faction.promoCodePurchasedAt)}</span>
                                            <button type="button" className="a-btn a-btn-sm a-btn-danger" disabled={busy} onClick={() => perk("revokePromo", {}, "Promo revoke")}>
                                                Revoke
                                            </button>
                                        </div>
                                    ) : (
                                        <button type="button" className="a-btn a-btn-good" disabled={busy} onClick={() => perk("grantPromo", {}, "Promo grant")}>
                                            Grant promo code
                                        </button>
                                    )}
                                </section>

                                <section>
                                    <span className="a-label">Token gate room — private room in Token Gates</span>
                                    {faction.hasGate ? (
                                        <div className="a-item">
                                            <span className="a-item-title">Private room active</span>
                                            <Badge tone={faction.gatePurchaseTx ? "good" : "info"}>
                                                {faction.gatePurchaseTx ? "purchased" : "granted by admin"}
                                            </Badge>
                                            <span className="a-hint a-spacer">{formatDate(faction.gatePurchasedAt)}</span>
                                            <button type="button" className="a-btn a-btn-sm a-btn-danger" disabled={busy} onClick={() => perk("revokeGate", {}, "Gate revoke")}>
                                                Revoke
                                            </button>
                                        </div>
                                    ) : (
                                        <button type="button" className="a-btn a-btn-good" disabled={busy} onClick={() => perk("grantGate", {}, "Gate grant")}>
                                            Grant gate room
                                        </button>
                                    )}
                                </section>


                                <section>
                                    <span className="a-label">Faction level</span>
                                    <div className="a-row">
                                        <label className="a-row" style={{ gap: 6 }}>
                                            <span className="a-hint">Level</span>
                                            <input type="number" min={1} max={100} value={levelInput} onChange={(e) => setLevelInput(e.target.value)} style={{ width: 90 }} />
                                        </label>
                                        <label className="a-row" style={{ gap: 6 }}>
                                            <span className="a-hint">Progress (Ash)</span>
                                            <input type="number" min={0} value={progressInput} onChange={(e) => setProgressInput(e.target.value)} style={{ width: 120 }} />
                                        </label>
                                        <button
                                            type="button"
                                            className="a-btn a-btn-primary"
                                            disabled={busy}
                                            onClick={() => perk("setLevel", { level: Number(levelInput), levelProgressAsh: Number(progressInput) }, "Level change")}
                                        >
                                            Apply
                                        </button>
                                    </div>
                                </section>

                                <div className="a-sep" />

                                <section>
                                    <span className="a-label" style={{ color: "var(--a-bad)" }}>Danger zone</span>
                                    <button type="button" className="a-btn a-btn-danger" disabled={busy} onClick={deleteFaction}>
                                        Delete faction
                                    </button>
                                </section>
                            </>
                        )}

                        {tab === "roster" && (
                            <>
                                <input
                                    type="text"
                                    value={rosterQuery}
                                    onChange={(e) => setRosterQuery(e.target.value)}
                                    placeholder="Filter members by nickname, wallet or role…"
                                />
                                {roster.length === 0 ? (
                                    <Empty>No members match.</Empty>
                                ) : (
                                    <div className="a-list">
                                        {roster.map((member) => (
                                            <div key={member.userId} className="a-item">
                                                <span className="a-item-title">{member.nickname || truncateWallet(member.wallet)}</span>
                                                <Badge tone={member.role === "founder" ? "warn" : member.role === "officer" ? "info" : "neutral"}>{member.role}</Badge>
                                                <span className="a-hint a-mono">{truncateWallet(member.wallet)}</span>
                                                <span className="a-hint a-spacer">joined {formatDate(member.joinedAt)}</span>
                                                <span style={{ color: "var(--a-warn)", fontWeight: 700 }}>
                                                    {formatNumber(member.contributionPoints)} pts / {member.tasksContributed} tasks
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </>
            )}
        </Modal>
    );
}
