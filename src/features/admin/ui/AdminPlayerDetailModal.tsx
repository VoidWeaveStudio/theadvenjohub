// src/features/admin/ui/AdminPlayerDetailModal.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminSignature } from "../lib/useAdminSignature";
import { PLACEABLE_ITEMS } from "../../game/data/placeableItems";
import { COMPANIONS, COMPANIONS_BY_ID, FRAGMENTS_PER_CRATE } from "../../game/data/companions";
import { COSMETICS, COSMETIC_FRAGMENTS_PER_CRATE } from "../../game/data/cosmetics";
import { useAdminLabel } from "../lib/useAdminLabel";
import { MAX_LEVEL, skillPointsForLevel } from "../../game/data/progression";

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
    progression: {
        level: number;
        totalXp: number;
        branch: string | null;
        respecCount: number;
    };
    skinTextureUrl: string | null;
    cosmetics: {
        equippedSkin: { id: string; name: string } | null;
        equippedAccessory: { id: string; name: string } | null;
        owned: { id: string; name: string; slot: string; purchasedAt: string }[];
    } | null;
    companions: {
        owned: { itemId: string; quantity: number }[];
        equipped: string | null;
        fragments: number;
        crates: number;
    } | null;
    placeables: Record<string, number>;
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
    cosmeticCrates?: { fragments: number; crates: number };
    licenses: {
        id: string;
        gameId: string;
        gameTitle: string;
        isActive: boolean;
        purchasedAt: string;
        price: number;
        txSignature: string | null;
        grantedViaPromoFactionId: string | null;
        promoFactionName: string | null;
    }[];
}

interface AdminPlayerDetailModalProps {
    userId: string | null;
    onClose: () => void;
    onBanChanged: (userId: string, isBanned: boolean, banReason: string | null) => void;
    onLicenseChanged?: (userId: string, ownsGame: boolean) => void;
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

export function AdminPlayerDetailModal({ userId, onClose, onBanChanged, onLicenseChanged }: AdminPlayerDetailModalProps) {
    const [player, setPlayer] = useState<PlayerDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [banReasonInput, setBanReasonInput] = useState("");
    const [actionError, setActionError] = useState<string | null>(null);
    const [ashAmountInput, setAshAmountInput] = useState("100");
    const [levelInput, setLevelInput] = useState("1");
    const [cosmeticIdInput, setCosmeticIdInput] = useState<string>(COSMETICS[0]?.id ?? "");
    const [cosmeticAmountInput, setCosmeticAmountInput] = useState("1");
    const [itemToGrant, setItemToGrant] = useState(PLACEABLE_ITEMS[0]?.id || "");
    const [companionToGrant, setCompanionToGrant] = useState<string>(COMPANIONS[0]?.id ?? "");
    const [companionQuantityInput, setCompanionQuantityInput] = useState("1");
    const [fragmentAmountInput, setFragmentAmountInput] = useState("100");
    const [crateAmountInput, setCrateAmountInput] = useState("1");
    const [itemQuantityInput, setItemQuantityInput] = useState("1");
    const { signedFetch } = useAdminSignature();
    const adminLabel = useAdminLabel();

    const loadPlayer = useCallback(async () => {
        if (!userId) return;
        const res = await fetch(`/api/admin/players/${userId}`, { credentials: "include" });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.player) {
            setPlayer(null);
            setLoadError(`Failed to load player — ${data?.error || `HTTP ${res.status}`}`);
            return;
        }
        setLoadError(null);
        setPlayer(data.player);
    }, [userId]);

    useEffect(() => {
        if (!userId) {
            setPlayer(null);
            return;
        }
        setLoadError(null);
        setLoading(true);
        loadPlayer().finally(() => setLoading(false));
    }, [userId, loadPlayer]);

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

    const adjustAsh = async (sign: 1 | -1) => {
        const amount = Math.floor(Number(ashAmountInput));
        if (!Number.isFinite(amount) || amount <= 0) return;
        const delta = amount * sign;

        setActionError(null);
        try {
            const res = await signedFetch(`/api/admin/players/${userId}/ash`, sign > 0 ? "grantAsh" : "takeAsh", userId, { delta });
            if (res.ok) {
                const data = await res.json();
                setPlayer((prev) => (prev ? { ...prev, ash: data.ash } : prev));
            } else {
                setActionError("Failed to update ash");
            }
        } catch (err: any) {
            setActionError(err.message || "Signature failed");
        }
    };

    const setLevel = async () => {
        const level = Math.floor(Number(levelInput));
        if (!Number.isFinite(level) || level < 1 || level > MAX_LEVEL) {
            setActionError(`Level must be between 1 and ${MAX_LEVEL}`);
            return;
        }

        setActionError(null);
        try {
            const res = await signedFetch(`/api/admin/players/${userId}/level`, "setLevel", userId, { level });
            if (res.ok) {
                const data = await res.json();
                setPlayer((prev) =>
                    prev ? { ...prev, progression: { ...prev.progression, level: data.level, totalXp: data.totalXp } } : prev
                );
            } else {
                setActionError("Failed to set level");
            }
        } catch (err: any) {
            setActionError(err.message || "Signature failed");
        }
    };

    const adjustPlaceable = async (itemId: string, sign: 1 | -1) => {
        const amount = Math.floor(Number(itemQuantityInput));
        if (!itemId || !Number.isFinite(amount) || amount <= 0) return;
        const delta = amount * sign;

        setActionError(null);
        try {
            const res = await signedFetch(
                `/api/admin/players/${userId}/placeables`,
                sign > 0 ? "grantItem" : "takeItem",
                `${userId}:${itemId}`,
                { itemId, delta }
            );
            if (res.ok) {
                const data = await res.json();
                setPlayer((prev) => (prev ? { ...prev, placeables: data.placeables } : prev));
            } else {
                setActionError("Failed to update inventory");
            }
        } catch (err: any) {
            setActionError(err.message || "Signature failed");
        }
    };

    const adjustCompanionScope = async (
        scope: "companion" | "fragments" | "crates",
        itemId: string,
        amount: number,
        sign: 1 | -1
    ) => {
        if (!Number.isFinite(amount) || amount <= 0) return;
        const delta = Math.floor(amount) * sign;
        const action =
            scope === "companion"
                ? (sign > 0 ? "grantCompanion" : "takeCompanion")
                : scope === "fragments"
                    ? (sign > 0 ? "grantFragments" : "takeFragments")
                    : (sign > 0 ? "grantCrates" : "takeCrates");

        setActionError(null);
        try {
            const res = await signedFetch(
                `/api/admin/players/${userId}/companions`,
                action,
                `${userId}:${scope}:${itemId}`,
                { scope, itemId, delta }
            );
            if (res.ok) {
                const data = await res.json();
                setPlayer((prev) => (prev ? { ...prev, companions: data.companions } : prev));
            } else {
                const data = await res.json().catch(() => ({}));
                setActionError(data?.error === "not_enough" ? "Player does not have that much" : "Failed to update companions");
            }
        } catch (err: any) {
            setActionError(err.message || "Signature failed");
        }
    };

    const toggleLicense = async (grant: boolean) => {
        if (!userId) return;
        setActionError(null);
        try {
            const res = await signedFetch(
                `/api/admin/players/${userId}/license`,
                grant ? "grantLicense" : "revokeLicense",
                userId,
                { grant }
            );
            if (res.ok) {
                const data = await res.json();
                onLicenseChanged?.(userId, !!data.ownsGame);
                await loadPlayer();
            } else {
                setActionError(grant ? "Failed to grant the game license" : "Failed to revoke the game license");
            }
        } catch (err: any) {
            setActionError(err.message || "Signature failed");
        }
    };

    const adjustCosmetics = async (scope: "cosmetic" | "fragments" | "crates", sign: 1 | -1) => {
        if (!userId) return;

        const itemId = scope === "cosmetic" ? cosmeticIdInput : "";
        const amount = scope === "cosmetic" ? 1 : Math.floor(Number(cosmeticAmountInput));
        if (!Number.isFinite(amount) || amount <= 0) return;

        const delta = amount * sign;
        const action =
            scope === "cosmetic"
                ? (sign > 0 ? "grantCosmetic" : "takeCosmetic")
                : scope === "fragments"
                    ? (sign > 0 ? "grantCosmeticFragments" : "takeCosmeticFragments")
                    : (sign > 0 ? "grantCosmeticCrates" : "takeCosmeticCrates");

        setActionError(null);
        try {
            const res = await signedFetch(
                `/api/admin/players/${userId}/cosmetics`,
                action,
                `${userId}:${scope}:${itemId}`,
                { scope, itemId, delta }
            );
            if (res.ok) {
                const data = await res.json();
                setPlayer((prev) => (prev ? { ...prev, cosmeticCrates: data.cosmeticCrates } : prev));
                if (scope === "cosmetic") await loadPlayer();
            } else {
                const data = await res.json().catch(() => ({}));
                setActionError(data?.error === "not_applied" ? "Nothing changed — already in that state" : "Failed to update cosmetics");
            }
        } catch (err: any) {
            setActionError(err.message || "Signature failed");
        }
    };

    const setEquippedCompanion = async (itemId: string) => {
        setActionError(null);
        try {
            const res = await signedFetch(
                `/api/admin/players/${userId}/companions`,
                "setCompanion",
                `${userId}:equip:${itemId}`,
                { scope: "equip", itemId }
            );
            if (res.ok) {
                const data = await res.json();
                setPlayer((prev) => (prev ? { ...prev, companions: data.companions } : prev));
            } else {
                setActionError("Failed to change the equipped companion");
            }
        } catch (err: any) {
            setActionError(err.message || "Signature failed");
        }
    };

    const removeInventoryItem = async (slot: number) => {
        if (!confirm("Remove this item from the player's inventory?")) return;

        setActionError(null);
        try {
            const res = await signedFetch(`/api/admin/players/${userId}/inventory`, "removeInventoryItem", `${userId}:${slot}`, { slot });
            if (res.ok) {
                setPlayer((prev) => (prev ? { ...prev, inventory: prev.inventory.filter((i) => i.slot !== slot) } : prev));
            } else {
                setActionError("Failed to remove item");
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
                {loading ? (
                    <p className="text-[#8B8F98] text-sm text-center py-10">Loading...</p>
                ) : !player ? (
                    <div className="py-10 text-center space-y-3">
                        <p className="text-red-400 text-sm">{loadError || "Failed to load player"}</p>
                        <button onClick={onClose} className="btn-secondary px-3 py-1.5 text-xs">Close</button>
                    </div>
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
                            {player.licenses.some((l) => l.isActive && l.promoFactionName) && (
                                <span className="px-2 py-1 rounded-full font-bold bg-[rgba(255,209,102,0.15)] text-[#FFD166]">
                                    🎟 Promo: {player.licenses.find((l) => l.isActive && l.promoFactionName)?.promoFactionName}
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
                            <div className="text-[#8B8F98] text-xs font-bold tracking-wider mb-2">GAME LICENSES ({player.licenses.length})</div>
                            <div className="mb-2 flex items-center gap-2">
                                <button onClick={() => toggleLicense(true)} className="btn-secondary px-3 py-1.5 text-xs">
                                    Grant game access
                                </button>
                                <button onClick={() => toggleLicense(false)} className="btn-secondary px-3 py-1.5 text-xs">
                                    Revoke access
                                </button>
                            </div>
                            {player.licenses.length === 0 ? (
                                <p className="text-[#6B7280] text-xs">No licenses.</p>
                            ) : (
                                <div className="space-y-1.5">
                                    {player.licenses.map((l) => (
                                        <div key={l.id} className="bg-white/5 rounded-lg px-3 py-2 flex items-center justify-between text-xs">
                                            <span className={l.isActive ? "text-white" : "text-[#6B7280] line-through"}>
                                                {l.gameTitle} {l.promoFactionName ? `— 🎟 via ${l.promoFactionName}` : ""}
                                            </span>
                                            <span className="text-[#6B7280]">{formatDate(l.purchasedAt)}</span>
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
                                        <div key={i.slot} className="flex items-center justify-between gap-1.5 bg-white/5 rounded-lg px-2 py-1.5 text-xs text-white">
                                            <span className="truncate">{i.itemId} × {i.quantity}</span>
                                            <button
                                                onClick={() => removeInventoryItem(i.slot)}
                                                className="text-[#6B7280] hover:text-red-400 transition-colors flex-shrink-0"
                                                title="Remove"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <div className="text-[#8B8F98] text-xs font-bold tracking-wider mb-2">SKINS &amp; ACCESSORIES</div>
                            <div className="grid grid-cols-2 gap-1.5 mb-2">
                                <div className="bg-white/5 rounded-lg px-2 py-1.5 text-xs">
                                    <div className="text-[#6B7280]">Equipped skin</div>
                                    <div className="text-white font-bold">{player.cosmetics?.equippedSkin ? adminLabel(player.cosmetics.equippedSkin.name) : "—"}</div>
                                </div>
                                <div className="bg-white/5 rounded-lg px-2 py-1.5 text-xs">
                                    <div className="text-[#6B7280]">Equipped accessory</div>
                                    <div className="text-white font-bold">{player.cosmetics?.equippedAccessory ? adminLabel(player.cosmetics.equippedAccessory.name) : "—"}</div>
                                </div>
                            </div>
                            <div className="mb-2 flex flex-wrap items-center gap-1.5">
                                <select
                                    value={cosmeticIdInput}
                                    onChange={(e) => setCosmeticIdInput(e.target.value)}
                                    className="bg-zinc-900 text-white px-2 py-1.5 rounded text-xs border border-zinc-700 outline-none"
                                >
                                    {COSMETICS.map((entry) => (
                                        <option key={entry.id} value={entry.id}>
                                            {adminLabel(entry.name)}
                                        </option>
                                    ))}
                                </select>
                                <button onClick={() => adjustCosmetics("cosmetic", 1)} className="btn-secondary px-3 py-1.5 text-xs">Grant</button>
                                <button onClick={() => adjustCosmetics("cosmetic", -1)} className="btn-secondary px-3 py-1.5 text-xs">Take</button>
                            </div>

                            <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-[#8B8F98]">
                                <span>Fragments {player.cosmeticCrates?.fragments ?? 0} / {COSMETIC_FRAGMENTS_PER_CRATE}</span>
                                <span className="text-[#FFD166]">Crates {player.cosmeticCrates?.crates ?? 0}</span>
                                <input
                                    type="number"
                                    value={cosmeticAmountInput}
                                    onChange={(e) => setCosmeticAmountInput(e.target.value)}
                                    className="w-16 bg-zinc-900 text-white px-2 py-1 rounded text-xs border border-zinc-700 outline-none"
                                />
                                <button onClick={() => adjustCosmetics("fragments", 1)} className="btn-secondary px-2 py-1 text-xs">+ frag</button>
                                <button onClick={() => adjustCosmetics("fragments", -1)} className="btn-secondary px-2 py-1 text-xs">− frag</button>
                                <button onClick={() => adjustCosmetics("crates", 1)} className="btn-secondary px-2 py-1 text-xs">+ crate</button>
                                <button onClick={() => adjustCosmetics("crates", -1)} className="btn-secondary px-2 py-1 text-xs">− crate</button>
                            </div>

                            {!player.cosmetics || player.cosmetics.owned.length === 0 ? (
                                <p className="text-[#6B7280] text-xs">None owned.</p>
                            ) : (
                                <div className="grid grid-cols-2 gap-1.5">
                                    {player.cosmetics.owned.map((item) => (
                                        <div key={item.id} className="bg-white/5 rounded-lg px-2 py-1.5 text-xs text-white flex items-center justify-between gap-2">
                                            <span className="truncate">{adminLabel(item.name)}</span>
                                            <span className="text-[#6B7280] text-[10px] uppercase flex-shrink-0">{item.slot}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <div className="text-[#8B8F98] text-xs font-bold tracking-wider mb-2">COMPANIONS</div>
                            <div className="grid grid-cols-3 gap-1.5 mb-2">
                                <div className="bg-white/5 rounded-lg px-2 py-1.5 text-xs">
                                    <div className="text-[#6B7280]">Equipped</div>
                                    <div className="text-white font-bold truncate">
                                        {player.companions?.equipped
                                            ? adminLabel(COMPANIONS_BY_ID.get(player.companions.equipped as any)?.nameKey || player.companions.equipped)
                                            : "—"}
                                    </div>
                                </div>
                                <div className="bg-white/5 rounded-lg px-2 py-1.5 text-xs">
                                    <div className="text-[#6B7280]">Fragments</div>
                                    <div className="text-[#C084FC] font-bold">
                                        {player.companions?.fragments ?? 0} / {FRAGMENTS_PER_CRATE}
                                    </div>
                                </div>
                                <div className="bg-white/5 rounded-lg px-2 py-1.5 text-xs">
                                    <div className="text-[#6B7280]">Crates</div>
                                    <div className="text-[#FFD166] font-bold">{player.companions?.crates ?? 0}</div>
                                </div>
                            </div>
                            {!player.companions || player.companions.owned.length === 0 ? (
                                <p className="text-[#6B7280] text-xs">None owned.</p>
                            ) : (
                                <div className="grid grid-cols-2 gap-1.5">
                                    {player.companions.owned.map((entry) => {
                                        const definition = COMPANIONS_BY_ID.get(entry.itemId as any);
                                        return (
                                            <div key={entry.itemId} className="bg-white/5 rounded-lg px-2 py-1.5 text-xs text-white flex items-center justify-between gap-2">
                                                <span className="truncate">
                                                    {definition?.icon || ""} {adminLabel(definition?.nameKey || entry.itemId)} × {entry.quantity}
                                                </span>
                                                <span className="text-[#6B7280] text-[10px] uppercase flex-shrink-0">{definition?.rarity || "?"}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div>
                            <div className="text-[#8B8F98] text-xs font-bold tracking-wider mb-2">PLACEABLES</div>
                            {Object.keys(player.placeables).length === 0 ? (
                                <p className="text-[#6B7280] text-xs">None owned.</p>
                            ) : (
                                <div className="grid grid-cols-2 gap-1.5">
                                    {Object.entries(player.placeables).map(([itemId, qty]) => (
                                        <div key={itemId} className="bg-white/5 rounded-lg px-2 py-1.5 text-xs text-white">
                                            {adminLabel(PLACEABLE_ITEMS.find((p) => p.id === itemId)?.name || itemId)} × {qty}
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

                            <div>
                                <div className="text-[#8B8F98] text-xs font-bold tracking-wider mb-2">ASH</div>
                                <div className="flex items-center gap-1.5">
                                    <input
                                        type="number"
                                        min={1}
                                        value={ashAmountInput}
                                        onChange={(e) => setAshAmountInput(e.target.value)}
                                        className="w-24 bg-zinc-900 text-white px-2 py-1.5 rounded text-xs border border-zinc-700 outline-none"
                                    />
                                    <button onClick={() => adjustAsh(1)} className="btn-secondary px-3 py-1.5 text-xs text-[#4ADE80]">
                                        Grant
                                    </button>
                                    <button onClick={() => adjustAsh(-1)} className="btn-secondary px-3 py-1.5 text-xs text-red-400">
                                        Take
                                    </button>
                                </div>
                            </div>

                            <div>
                                <div className="text-[#8B8F98] text-xs font-bold tracking-wider mb-2">
                                    CHARACTER LEVEL — {player.progression.level} ({skillPointsForLevel(player.progression.level)} skill points)
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <input
                                        type="number"
                                        min={1}
                                        max={MAX_LEVEL}
                                        value={levelInput}
                                        onChange={(e) => setLevelInput(e.target.value)}
                                        className="w-24 bg-zinc-900 text-white px-2 py-1.5 rounded text-xs border border-zinc-700 outline-none"
                                    />
                                    <button onClick={setLevel} className="btn-secondary px-3 py-1.5 text-xs text-[#4FD1FF]">
                                        Set Level
                                    </button>
                                    <span className="text-[#6B7280] text-[11px]">
                                        {player.isOnline ? "applies in the running game within ~5s" : "applies on the player's next login"}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <div className="text-[#8B8F98] text-xs font-bold tracking-wider mb-2">GRANT / TAKE ITEM</div>
                                <div className="flex items-center gap-1.5">
                                    <select
                                        value={itemToGrant}
                                        onChange={(e) => setItemToGrant(e.target.value)}
                                        className="flex-1 bg-zinc-900 text-white px-2 py-1.5 rounded text-xs border border-zinc-700 outline-none"
                                    >
                                        {PLACEABLE_ITEMS.map((item) => (
                                            <option key={item.id} value={item.id}>{adminLabel(item.name)}</option>
                                        ))}
                                    </select>
                                    <input
                                        type="number"
                                        min={1}
                                        value={itemQuantityInput}
                                        onChange={(e) => setItemQuantityInput(e.target.value)}
                                        className="w-16 bg-zinc-900 text-white px-2 py-1.5 rounded text-xs border border-zinc-700 outline-none flex-shrink-0"
                                    />
                                    <button onClick={() => adjustPlaceable(itemToGrant, 1)} className="btn-secondary px-3 py-1.5 text-xs text-[#4ADE80] flex-shrink-0">
                                        Grant
                                    </button>
                                    <button onClick={() => adjustPlaceable(itemToGrant, -1)} className="btn-secondary px-3 py-1.5 text-xs text-red-400 flex-shrink-0">
                                        Take
                                    </button>
                                </div>
                            </div>
                            <div>
                                <div className="text-[#8B8F98] text-xs font-bold tracking-wider mb-2">GRANT / TAKE COMPANION</div>
                                <div className="flex items-center gap-1.5">
                                    <select
                                        value={companionToGrant}
                                        onChange={(e) => setCompanionToGrant(e.target.value)}
                                        className="flex-1 bg-zinc-900 text-white px-2 py-1.5 rounded text-xs border border-zinc-700 outline-none"
                                    >
                                        {COMPANIONS.map((companion) => (
                                            <option key={companion.id} value={companion.id}>
                                                {adminLabel(companion.nameKey)} — {companion.rarity}
                                            </option>
                                        ))}
                                    </select>
                                    <input
                                        type="number"
                                        min={1}
                                        value={companionQuantityInput}
                                        onChange={(e) => setCompanionQuantityInput(e.target.value)}
                                        className="w-16 bg-zinc-900 text-white px-2 py-1.5 rounded text-xs border border-zinc-700 outline-none flex-shrink-0"
                                    />
                                    <button
                                        onClick={() => adjustCompanionScope("companion", companionToGrant, Number(companionQuantityInput), 1)}
                                        className="btn-secondary px-3 py-1.5 text-xs text-[#4ADE80] flex-shrink-0"
                                    >
                                        Grant
                                    </button>
                                    <button
                                        onClick={() => adjustCompanionScope("companion", companionToGrant, Number(companionQuantityInput), -1)}
                                        className="btn-secondary px-3 py-1.5 text-xs text-red-400 flex-shrink-0"
                                    >
                                        Take
                                    </button>
                                </div>
                                <div className="flex items-center gap-1.5 mt-1.5">
                                    <button
                                        onClick={() => setEquippedCompanion(companionToGrant)}
                                        className="btn-secondary px-3 py-1.5 text-xs text-[#4FD1FF]"
                                    >
                                        Equip selected
                                    </button>
                                    <button
                                        onClick={() => setEquippedCompanion("")}
                                        className="btn-secondary px-3 py-1.5 text-xs"
                                    >
                                        Unequip
                                    </button>
                                </div>
                            </div>

                            <div>
                                <div className="text-[#8B8F98] text-xs font-bold tracking-wider mb-2">MEME FRAGMENTS</div>
                                <div className="flex items-center gap-1.5">
                                    <input
                                        type="number"
                                        min={1}
                                        value={fragmentAmountInput}
                                        onChange={(e) => setFragmentAmountInput(e.target.value)}
                                        className="w-24 bg-zinc-900 text-white px-2 py-1.5 rounded text-xs border border-zinc-700 outline-none"
                                    />
                                    <button
                                        onClick={() => adjustCompanionScope("fragments", "", Number(fragmentAmountInput), 1)}
                                        className="btn-secondary px-3 py-1.5 text-xs text-[#4ADE80]"
                                    >
                                        Grant
                                    </button>
                                    <button
                                        onClick={() => adjustCompanionScope("fragments", "", Number(fragmentAmountInput), -1)}
                                        className="btn-secondary px-3 py-1.5 text-xs text-red-400"
                                    >
                                        Take
                                    </button>
                                </div>
                            </div>

                            <div>
                                <div className="text-[#8B8F98] text-xs font-bold tracking-wider mb-2">MEME CRATES</div>
                                <div className="flex items-center gap-1.5">
                                    <input
                                        type="number"
                                        min={1}
                                        value={crateAmountInput}
                                        onChange={(e) => setCrateAmountInput(e.target.value)}
                                        className="w-24 bg-zinc-900 text-white px-2 py-1.5 rounded text-xs border border-zinc-700 outline-none"
                                    />
                                    <button
                                        onClick={() => adjustCompanionScope("crates", "", Number(crateAmountInput), 1)}
                                        className="btn-secondary px-3 py-1.5 text-xs text-[#4ADE80]"
                                    >
                                        Grant
                                    </button>
                                    <button
                                        onClick={() => adjustCompanionScope("crates", "", Number(crateAmountInput), -1)}
                                        className="btn-secondary px-3 py-1.5 text-xs text-red-400"
                                    >
                                        Take
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
