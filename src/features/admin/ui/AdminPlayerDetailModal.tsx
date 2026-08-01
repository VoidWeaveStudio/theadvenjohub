// src/features/admin/ui/AdminPlayerDetailModal.tsx
"use client";

import { useEffect, useState } from "react";
import { useAdminSignature } from "../lib/useAdminSignature";

interface PlayerDetail {
    id: string;
    wallet: string;
    isBanned: boolean;
    banReason: string | null;
    bannedAt: string | null;
    isOnline: boolean;
    lastSeenAt: string | null;
    mutedUntil: string | null;
    createdAt: string;
    nicknames: string[];
    stats: {
        kills: number;
        deaths: number;
        shotsFired: number;
        buildingsPlaced: number;
        playtimeSeconds: number;
        lastPlayedAt: string | null;
    };
    ash: number;
    skinTextureUrl: string | null;
    locationId: string | null;
    inventory: { slot: number; itemId: string; quantity: number }[];
    factions: {
        id: string;
        number: number;
        name: string;
        symbol: string | null;
        image: string | null;
        level: number;
        role: string;
        isDisplayed: boolean;
        contributionPoints: number;
        tasksContributed: number;
        joinedAt: string;
    }[];
    achievements: { key: string; label: string; description: string; unlockedAt: string }[];
}

interface AdminPlayerDetailModalProps {
    userId: string | null;
    onClose: () => void;
    onBanChanged: (userId: string, isBanned: boolean, banReason: string | null) => void;
}

const MUTE_DURATIONS: { label: string; minutes: number }[] = [
    { label: "10m", minutes: 10 },
    { label: "1h", minutes: 60 },
    { label: "24h", minutes: 60 * 24 },
    { label: "7d", minutes: 60 * 24 * 7 },
];

function formatDate(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleString();
}

function formatPlaytime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

export function AdminPlayerDetailModal({ userId, onClose, onBanChanged }: AdminPlayerDetailModalProps) {
    const [player, setPlayer] = useState<PlayerDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [banReasonInput, setBanReasonInput] = useState("");
    const [actionError, setActionError] = useState<string | null>(null);
    const { signedFetch } = useAdminSignature();

    useEffect(() => {
        if (!userId) {
            setPlayer(null);
            return;
        }
        setLoading(true);
        fetch(`/api/admin/players/${userId}`, { credentials: "include" })
            .then((r) => r.json())
            .then((data) => setPlayer(data.player || null))
            .finally(() => setLoading(false));
    }, [userId]);

    if (!userId) return null;

    const setMute = async (durationMinutes: number | null) => {
        setActionError(null);
        try {
            const res = await signedFetch(
                `/api/admin/players/${userId}/mute`,
                durationMinutes === null ? "unmute" : "mute",
                userId,
                { durationMinutes }
            );
            if (res.ok) {
                const data = await res.json();
                setPlayer((prev) => (prev ? { ...prev, mutedUntil: data.mutedUntil } : prev));
            } else {
                setActionError("Failed to update mute status");
            }
        } catch (err: any) {
            setActionError(err.message || "Signature failed");
        }
    };

    const setBan = async (isBanned: boolean) => {
        setActionError(null);
        try {
            const res = await signedFetch(
                `/api/admin/players/${userId}`,
                isBanned ? "ban" : "unban",
                userId,
                { isBanned, banReason: banReasonInput.trim() || undefined }
            );
            if (res.ok) {
                const reason = isBanned ? (banReasonInput.trim() || null) : null;
                setPlayer((prev) => (prev ? { ...prev, isBanned, banReason: reason } : prev));
                onBanChanged(userId, isBanned, reason);
                setBanReasonInput("");
            } else {
                setActionError("Failed to update ban status");
            }
        } catch (err: any) {
            setActionError(err.message || "Signature failed");
        }
    };

    const resetSkin = async () => {
        setActionError(null);
        try {
            const res = await signedFetch(`/api/admin/players/${userId}/skin`, "resetSkin", userId, {});
            if (res.ok) {
                setPlayer((prev) => (prev ? { ...prev, skinTextureUrl: null } : prev));
            } else {
                setActionError("Failed to reset skin");
            }
        } catch (err: any) {
            setActionError(err.message || "Signature failed");
        }
    };

    const isMuted = !!player?.mutedUntil && new Date(player.mutedUntil).getTime() > Date.now();

    return (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="w-full max-w-lg max-h-[85vh] overflow-y-auto bg-[#0a0a0c] border border-[rgba(255,255,255,0.1)] rounded-xl p-6 space-y-5"
                onClick={(e) => e.stopPropagation()}
            >
                {loading || !player ? (
                    <p className="text-[#8B8F98] text-sm text-center py-10">Loading...</p>
                ) : (
                    <>
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-white text-lg font-bold">{player.nicknames[0] || "Unnamed"}</h2>
                                <p className="text-[#8B8F98] text-xs font-mono break-all mt-1">{player.wallet}</p>
                            </div>
                            <button onClick={onClose} className="text-[#8B8F98] hover:text-white text-sm">✕</button>
                        </div>

                        <div className="flex flex-wrap gap-2 text-xs">
                            <span className={`px-2 py-1 rounded-full font-bold ${player.isOnline ? "bg-green-500/15 text-green-400" : "bg-white/5 text-[#6B7280]"}`}>
                                {player.isOnline ? "Online" : "Offline"}
                            </span>
                            {player.isBanned && (
                                <span className="px-2 py-1 rounded-full font-bold bg-red-500/15 text-red-400">
                                    Banned{player.banReason ? `: ${player.banReason}` : ""}
                                </span>
                            )}
                            {isMuted && (
                                <span className="px-2 py-1 rounded-full font-bold bg-orange-500/15 text-orange-400">
                                    Muted until {formatDate(player.mutedUntil)}
                                </span>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="bg-white/5 rounded-lg p-2.5"><div className="text-[#8B8F98] text-xs">Kills</div><div className="text-white font-bold">{player.stats.kills}</div></div>
                            <div className="bg-white/5 rounded-lg p-2.5"><div className="text-[#8B8F98] text-xs">Deaths</div><div className="text-white font-bold">{player.stats.deaths}</div></div>
                            <div className="bg-white/5 rounded-lg p-2.5"><div className="text-[#8B8F98] text-xs">Shots Fired</div><div className="text-white font-bold">{player.stats.shotsFired}</div></div>
                            <div className="bg-white/5 rounded-lg p-2.5"><div className="text-[#8B8F98] text-xs">Buildings</div><div className="text-white font-bold">{player.stats.buildingsPlaced}</div></div>
                            <div className="bg-white/5 rounded-lg p-2.5"><div className="text-[#8B8F98] text-xs">Playtime</div><div className="text-white font-bold">{formatPlaytime(player.stats.playtimeSeconds)}</div></div>
                            <div className="bg-white/5 rounded-lg p-2.5"><div className="text-[#8B8F98] text-xs">Ash</div><div className="text-[#FFD166] font-bold">{player.ash}</div></div>
                        </div>

                        <div className="text-xs text-[#8B8F98] space-y-1">
                            <div>Joined: {formatDate(player.createdAt)}</div>
                            <div>Last seen: {formatDate(player.lastSeenAt)}</div>
                            <div>Location: {player.locationId || "—"}</div>
                        </div>

                        <div>
                            <div className="text-[#8B8F98] text-xs font-bold tracking-wider mb-2">FACTIONS ({player.factions.length})</div>
                            {player.factions.length === 0 ? (
                                <p className="text-[#6B7280] text-xs">Not in any faction.</p>
                            ) : (
                                <div className="space-y-1.5">
                                    {player.factions.map((f) => (
                                        <div key={f.id} className="bg-white/5 rounded-lg px-3 py-2 flex items-center justify-between text-xs">
                                            <span className="text-white">{f.name} #{f.number} <span className="text-[#4FD1FF]">Lv.{f.level}</span> ({f.role})</span>
                                            <span className="text-[#FFD166]">{f.contributionPoints} pts / {f.tasksContributed} tasks</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <div className="text-[#8B8F98] text-xs font-bold tracking-wider mb-2">ACHIEVEMENTS ({player.achievements.length})</div>
                            {player.achievements.length === 0 ? (
                                <p className="text-[#6B7280] text-xs">None unlocked.</p>
                            ) : (
                                <div className="grid grid-cols-2 gap-1.5">
                                    {player.achievements.map((a) => (
                                        <div key={a.key} title={a.description} className="bg-[rgba(255,209,102,0.08)] border border-[rgba(255,209,102,0.2)] rounded-lg px-2 py-1.5 text-xs text-[#FFD166] font-bold truncate">
                                            {a.label}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <div className="text-[#8B8F98] text-xs font-bold tracking-wider mb-2">INVENTORY ({player.inventory.length})</div>
                            {player.inventory.length === 0 ? (
                                <p className="text-[#6B7280] text-xs">Empty.</p>
                            ) : (
                                <div className="grid grid-cols-2 gap-1.5">
                                    {player.inventory.map((i) => (
                                        <div key={i.slot} className="bg-white/5 rounded-lg px-2 py-1.5 text-xs text-white">
                                            {i.itemId} × {i.quantity}
                                        </div>
                                    ))}
                                </div>
                            )}
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
                                <div className="text-[#8B8F98] text-xs font-bold tracking-wider mb-2">MUTE (CHAT + VOICE)</div>
                                <div className="flex flex-wrap gap-1.5">
                                    {MUTE_DURATIONS.map((d) => (
                                        <button
                                            key={d.minutes}
                                            onClick={() => setMute(d.minutes)}
                                            className="btn-secondary px-3 py-1.5 text-xs"
                                        >
                                            {d.label}
                                        </button>
                                    ))}
                                    {isMuted && (
                                        <button onClick={() => setMute(null)} className="btn-secondary px-3 py-1.5 text-xs text-[#4ADE80]">
                                            Unmute
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div>
                                <div className="text-[#8B8F98] text-xs font-bold tracking-wider mb-2">BAN</div>
                                {player.isBanned ? (
                                    <button onClick={() => setBan(false)} className="btn-secondary px-3 py-1.5 text-xs">
                                        Unban
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-1.5">
                                        <input
                                            type="text"
                                            value={banReasonInput}
                                            onChange={(e) => setBanReasonInput(e.target.value)}
                                            placeholder="Reason..."
                                            className="flex-1 bg-zinc-900 text-white px-2 py-1.5 rounded text-xs border border-zinc-700 outline-none"
                                        />
                                        <button onClick={() => setBan(true)} className="btn-primary px-3 py-1.5 text-xs text-red-400 flex-shrink-0">
                                            Ban
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div>
                                <div className="text-[#8B8F98] text-xs font-bold tracking-wider mb-2">PERSONALIZATION</div>
                                <button
                                    onClick={resetSkin}
                                    disabled={!player.skinTextureUrl}
                                    className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Reset Skin
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
