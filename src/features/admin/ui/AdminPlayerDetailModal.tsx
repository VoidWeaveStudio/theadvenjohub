// src/features/admin/ui/AdminPlayerDetailModal.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Minus, Plus, X } from "lucide-react";
import { useAdminSignature } from "../lib/useAdminSignature";
import { useAdminLabel } from "../lib/useAdminLabel";
import { PLACEABLE_ITEMS } from "../../game/data/placeableItems";
import { COMPANIONS, COMPANIONS_BY_ID, FRAGMENTS_PER_CRATE } from "../../game/data/companions";
import { COSMETICS, COSMETICS_BY_ID, COSMETIC_FRAGMENTS_PER_CRATE } from "../../game/data/cosmetics";
import { MAX_LEVEL, skillPointsForLevel } from "../../game/data/progression";
import { SHOP_CATALOG } from "@/core/lib/shopCatalog";
import { ACHIEVEMENTS } from "@/core/lib/achievements";
import { GRANT_SCOPES, WIPE_SCOPES, SCOPE_LABELS } from "@/core/lib/adminScopes";
import {
    Alert,
    Badge,
    Empty,
    Modal,
    Tile,
    formatDate,
    formatNumber,
    formatPlaytime,
    truncateWallet,
} from "./AdminKit";

interface PlayerDetail {
    id: string;
    number: number | null;
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
    progression: { level: number; totalXp: number; branch: string | null; respecCount: number };
    skinTextureUrl: string | null;
    cosmetics: {
        equippedSkin: { id: string; name: string } | null;
        equippedAccessory: { id: string; name: string } | null;
        owned: { id: string; name: string; slot: string; purchasedAt: string }[];
    } | null;
    cosmeticCrates?: { fragments: number; crates: number };
    companions: { owned: { itemId: string; quantity: number }[]; equipped: string | null; fragments: number; crates: number } | null;
    placeables: Record<string, number>;
    locationId: string | null;
    storageCount: number;
    buildingCount: number;
    inventory: { slot: number; itemId: string; quantity: number }[];
    factions: {
        id: string;
        number: number;
        name: string;
        symbol: string | null;
        level: number;
        role: string;
        isDisplayed: boolean;
        contributionPoints: number;
        tasksContributed: number;
        joinedAt: string;
    }[];
    achievements: { key: string; label: string; description: string; unlockedAt: string }[];
    licenses: {
        id: string;
        gameTitle: string;
        isActive: boolean;
        purchasedAt: string;
        price: number;
        txSignature: string | null;
        promoFactionName: string | null;
    }[];
    spend: { gameTnj: number; shopTnj: number; tradeSpentTnj: number; tradeEarnedTnj: number };
    shopHistory: { id: string; itemId: string; quantity: number; priceTnj: number; status: string; txSignature: string; createdAt: string }[];
    tradeHistory: { id: string; itemName: string; quantity: number; priceTnj: number; status: string; createdAt: string; buyerId: string; sellerId: string }[];
}

interface AdminPlayerDetailModalProps {
    userId: string | null;
    onClose: () => void;
    onBanChanged: (userId: string, isBanned: boolean, banReason: string | null) => void;
    onLicenseChanged?: (userId: string, ownsGame: boolean) => void;
}

interface FactionOption {
    id: string;
    name: string;
    number: number;
}

type Tab = "overview" | "inventory" | "grants" | "purchases" | "moderation";

const TABS: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "inventory", label: "Inventory" },
    { id: "grants", label: "Grant & revoke" },
    { id: "purchases", label: "Purchases" },
    { id: "moderation", label: "Moderation" },
];

const MUTE_DURATIONS = [
    { label: "10m", minutes: 10 },
    { label: "1h", minutes: 60 },
    { label: "24h", minutes: 60 * 24 },
    { label: "7d", minutes: 60 * 24 * 7 },
];

const KIND_LABEL: Record<string, string> = {
    placeable: "Placeables",
    consumable: "Consumables",
    cosmetic: "Skins & accessories",
    companion: "Companions",
    lootbox: "Crates",
    faction: "Faction perks",
    weapon: "Weapons",
    emote: "Emotes",
};

export function AdminPlayerDetailModal({ userId, onClose, onBanChanged, onLicenseChanged }: AdminPlayerDetailModalProps) {
    const [player, setPlayer] = useState<PlayerDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [tab, setTab] = useState<Tab>("overview");
    const [busy, setBusy] = useState(false);

    const [banReasonInput, setBanReasonInput] = useState("");
    const [ashAmountInput, setAshAmountInput] = useState("1000");
    const [levelInput, setLevelInput] = useState("1");
    const [catalogItem, setCatalogItem] = useState(SHOP_CATALOG[0]?.itemId ?? "");
    const [catalogQuantity, setCatalogQuantity] = useState("1");
    const [memeFragments, setMemeFragments] = useState("100");
    const [memeCrates, setMemeCrates] = useState("1");
    const [skinFragments, setSkinFragments] = useState("100");
    const [skinCrates, setSkinCrates] = useState("1");
    const [grantScopes, setGrantScopes] = useState<string[]>([...GRANT_SCOPES]);
    const [wipeScopes, setWipeScopes] = useState<string[]>([...WIPE_SCOPES]);
    const [grantAsh, setGrantAsh] = useState("1000000");
    const [grantLevel, setGrantLevel] = useState(String(MAX_LEVEL));
    const [grantCrateCount, setGrantCrateCount] = useState("25");
    const [wipeConfirm, setWipeConfirm] = useState("");
    const [factionOptions, setFactionOptions] = useState<FactionOption[]>([]);
    const [factionToJoin, setFactionToJoin] = useState("");

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
        setLevelInput(String(data.player.progression?.level ?? 1));
    }, [userId]);

    useEffect(() => {
        if (!userId) {
            setPlayer(null);
            return;
        }
        setTab("overview");
        setActionError(null);
        setNotice(null);
        setWipeConfirm("");
        setLoadError(null);
        setLoading(true);
        loadPlayer().finally(() => setLoading(false));
    }, [userId, loadPlayer]);

    useEffect(() => {
        if (!userId) return;
        fetch("/api/admin/factions", { credentials: "include" })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                const list: FactionOption[] = (data?.factions || []).map((f: FactionOption) => ({ id: f.id, name: f.name, number: f.number }));
                setFactionOptions(list);
                setFactionToJoin(list[0]?.id ?? "");
            })
            .catch(() => setFactionOptions([]));
    }, [userId]);

    const catalogByKind = useMemo(() => {
        const groups: Record<string, { itemId: string; name: string; maxOwned: number | null }[]> = {};
        const seen = new Set<string>();

        for (const entry of SHOP_CATALOG) {
            seen.add(entry.itemId);
            (groups[entry.kind] ||= []).push({ itemId: entry.itemId, name: entry.name, maxOwned: entry.maxOwned });
        }
        for (const companion of COMPANIONS) {
            if (seen.has(companion.id)) continue;
            (groups.companion ||= []).push({ itemId: companion.id, name: adminLabel(companion.nameKey), maxOwned: null });
        }
        for (const cosmetic of COSMETICS) {
            if (seen.has(cosmetic.id)) continue;
            (groups.cosmetic ||= []).push({ itemId: cosmetic.id, name: adminLabel(cosmetic.name), maxOwned: 1 });
        }

        return groups;
    }, [adminLabel]);

    const run = useCallback(
        async (
            label: string,
            url: string,
            action: string,
            target: string,
            body: Record<string, unknown>,
            method: string = "PATCH"
        ): Promise<Record<string, unknown> | null> => {
            setActionError(null);
            setNotice(null);
            setBusy(true);
            try {
                const res = await signedFetch(url, action, target, body, method);
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    setActionError(`${label} failed — ${data?.error || `HTTP ${res.status}`}`);
                    return null;
                }

                if (data?.mode === "live") {
                    setNotice(`${label} pushed to the live session — the numbers here refresh once the game server saves.`);
                    window.setTimeout(() => {
                        loadPlayer().catch(() => undefined);
                    }, 6000);
                } else {
                    setNotice(`${label} done.`);
                }

                return data ?? {};
            } catch (err) {
                setActionError(err instanceof Error ? err.message : "Signature failed");
                return null;
            } finally {
                setBusy(false);
            }
        },
        [signedFetch, loadPlayer]
    );

    if (!userId) return null;

    const isMuted = !!player?.mutedUntil && new Date(player.mutedUntil).getTime() > Date.now();
    const ownsGame = !!player?.licenses.some((l) => l.isActive);

    const setBan = async (isBanned: boolean) => {
        const reason = isBanned ? banReasonInput.trim() || null : null;
        const ok = await run(isBanned ? "Ban" : "Unban", `/api/admin/players/${userId}`, isBanned ? "ban" : "unban", userId, {
            isBanned,
            banReason: reason || undefined,
        });
        if (!ok) return;
        setPlayer((prev) => (prev ? { ...prev, isBanned, banReason: reason } : prev));
        onBanChanged(userId, isBanned, reason);
        setBanReasonInput("");
    };

    const setMute = async (durationMinutes: number | null) => {
        const ok = await run(
            durationMinutes === null ? "Unmute" : "Mute",
            `/api/admin/players/${userId}/mute`,
            durationMinutes === null ? "unmute" : "mute",
            userId,
            { durationMinutes }
        );
        if (ok) await loadPlayer();
    };

    const resetSkin = async () => {
        const ok = await run("Skin reset", `/api/admin/players/${userId}/skin`, "resetSkin", userId, {});
        if (ok) setPlayer((prev) => (prev ? { ...prev, skinTextureUrl: null } : prev));
    };

    const adjustAsh = async (sign: 1 | -1) => {
        const amount = Math.floor(Number(ashAmountInput));
        if (!Number.isFinite(amount) || amount <= 0) return;
        const ok = await run(
            sign > 0 ? "Ash grant" : "Ash removal",
            `/api/admin/players/${userId}/ash`,
            sign > 0 ? "grantAsh" : "takeAsh",
            userId,
            { delta: amount * sign }
        );
        if (ok) await loadPlayer();
    };

    const setLevel = async () => {
        const level = Math.floor(Number(levelInput));
        if (!Number.isFinite(level) || level < 1 || level > MAX_LEVEL) {
            setActionError(`Level must be between 1 and ${MAX_LEVEL}`);
            return;
        }
        const ok = await run("Level change", `/api/admin/players/${userId}/level`, "setLevel", userId, { level });
        if (ok) await loadPlayer();
    };

    const toggleLicense = async (grant: boolean) => {
        const ok = await run(
            grant ? "Licence grant" : "Licence revoke",
            `/api/admin/players/${userId}/license`,
            grant ? "grantLicense" : "revokeLicense",
            userId,
            { grant }
        );
        if (!ok) return;
        onLicenseChanged?.(userId, grant);
        await loadPlayer();
    };

    const adjustCatalog = async (itemId: string, sign: 1 | -1, quantity: number) => {
        if (!itemId || !Number.isFinite(quantity) || quantity <= 0) return;
        const ok = await run(
            sign > 0 ? "Item grant" : "Item removal",
            `/api/admin/players/${userId}/grant`,
            sign > 0 ? "grantCatalogItem" : "takeCatalogItem",
            `${userId}:${itemId}`,
            { itemId, delta: Math.floor(quantity) * sign }
        );
        if (ok) await loadPlayer();
    };

    const adjustPlaceable = async (itemId: string, sign: 1 | -1, quantity: number) => {
        if (!itemId || !Number.isFinite(quantity) || quantity <= 0) return;
        const ok = await run(
            sign > 0 ? "Item grant" : "Item removal",
            `/api/admin/players/${userId}/placeables`,
            sign > 0 ? "grantItem" : "takeItem",
            `${userId}:${itemId}`,
            { itemId, delta: Math.floor(quantity) * sign }
        );
        if (ok) await loadPlayer();
    };

    const adjustCompanionWallet = async (scope: "fragments" | "crates", sign: 1 | -1, amount: number) => {
        if (!Number.isFinite(amount) || amount <= 0) return;
        const action = scope === "fragments" ? (sign > 0 ? "grantFragments" : "takeFragments") : sign > 0 ? "grantCrates" : "takeCrates";
        const ok = await run("Companion wallet", `/api/admin/players/${userId}/companions`, action, `${userId}:${scope}:`, {
            scope,
            itemId: "",
            delta: Math.floor(amount) * sign,
        });
        if (ok) await loadPlayer();
    };

    const adjustCosmeticWallet = async (scope: "fragments" | "crates", sign: 1 | -1, amount: number) => {
        if (!Number.isFinite(amount) || amount <= 0) return;
        const action =
            scope === "fragments"
                ? sign > 0
                    ? "grantCosmeticFragments"
                    : "takeCosmeticFragments"
                : sign > 0
                    ? "grantCosmeticCrates"
                    : "takeCosmeticCrates";
        const ok = await run("Skin wallet", `/api/admin/players/${userId}/cosmetics`, action, `${userId}:${scope}:`, {
            scope,
            itemId: "",
            delta: Math.floor(amount) * sign,
        });
        if (ok) await loadPlayer();
    };

    const setEquippedCompanion = async (itemId: string) => {
        const ok = await run("Companion equip", `/api/admin/players/${userId}/companions`, "setCompanion", `${userId}:equip:${itemId}`, {
            scope: "equip",
            itemId,
        });
        if (ok) await loadPlayer();
    };

    const removeInventoryItem = async (slot: number) => {
        if (!confirm("Remove this stack from the player's inventory?")) return;
        const ok = await run("Inventory removal", `/api/admin/players/${userId}/inventory`, "removeInventoryItem", `${userId}:${slot}`, { slot });
        if (ok) setPlayer((prev) => (prev ? { ...prev, inventory: prev.inventory.filter((i) => i.slot !== slot) } : prev));
    };

    const toggleAchievement = async (key: string, grant: boolean) => {
        const ok = await run(
            grant ? "Achievement grant" : "Achievement revoke",
            `/api/admin/players/${userId}/achievements`,
            grant ? "grantAchievement" : "revokeAchievement",
            `${userId}:${key}`,
            { key, grant }
        );
        if (ok) await loadPlayer();
    };

    const allAchievements = async (grant: boolean) => {
        const ok = await run(
            grant ? "All achievements" : "Achievement wipe",
            `/api/admin/players/${userId}/achievements`,
            grant ? "grantAchievement" : "revokeAchievement",
            `${userId}:*`,
            { all: true, grant }
        );
        if (ok) await loadPlayer();
    };

    const factionAction = async (action: "join" | "leave" | "setRole", factionId: string, role?: string) => {
        const ok = await run(
            action === "join" ? "Faction join" : action === "leave" ? "Faction leave" : "Role change",
            `/api/admin/players/${userId}/faction`,
            `faction_${action}`,
            `${userId}:${factionId}`,
            { action, factionId, role }
        );
        if (ok) await loadPlayer();
    };

    const runBulk = async (mode: "grant" | "wipe") => {
        const scopes = mode === "grant" ? grantScopes : wipeScopes;
        if (scopes.length === 0) {
            setActionError("Pick at least one scope first.");
            return;
        }
        if (mode === "wipe" && wipeConfirm.trim().toUpperCase() !== "WIPE") {
            setActionError('Type WIPE in the confirmation box to strip this account.');
            return;
        }

        const ok = await run(
            mode === "grant" ? "Grant everything" : "Wipe everything",
            `/api/admin/players/${userId}/bulk`,
            mode === "grant" ? "bulkGrant" : "bulkWipe",
            userId,
            {
                mode,
                scopes,
                ash: Math.max(0, Math.floor(Number(grantAsh) || 0)),
                level: Math.max(1, Math.floor(Number(grantLevel) || MAX_LEVEL)),
                crates: Math.max(0, Math.floor(Number(grantCrateCount) || 0)),
                fragments: Math.max(0, Math.floor(Number(grantCrateCount) || 0)) * 10,
                stackQuantity: 10,
            }
        );

        if (ok) {
            setWipeConfirm("");
            await loadPlayer();
            if (scopes.includes("license")) onLicenseChanged?.(userId, mode === "grant");
        }
    };

    const toggleScope = (mode: "grant" | "wipe", scope: string) => {
        const setter = mode === "grant" ? setGrantScopes : setWipeScopes;
        setter((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));
    };

    return (
        <Modal onClose={onClose}>
            {loading ? (
                <div className="a-modal-body">
                    <Empty>Loading player…</Empty>
                </div>
            ) : !player ? (
                <div className="a-modal-body">
                    <Alert tone="bad">{loadError || "Failed to load player"}</Alert>
                    <button type="button" className="a-btn" onClick={onClose}>
                        Close
                    </button>
                </div>
            ) : (
                <>
                    <header className="a-modal-head">
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <div className="a-row" style={{ gap: 8 }}>
                                <span className="a-top-title">{player.nicknames[0] || "Unnamed"}</span>
                                {player.number !== null && <span className="a-hint">#{player.number}</span>}
                            </div>
                            <div className="a-hint a-mono" style={{ wordBreak: "break-all" }}>{player.wallet}</div>
                            <div className="a-pills" style={{ marginTop: 6 }}>
                                <Badge tone={player.isOnline ? "good" : "neutral"} dot>
                                    {player.isOnline ? "Online" : "Offline"}
                                </Badge>
                                <Badge tone={ownsGame ? "violet" : "neutral"}>{ownsGame ? "Owns the game" : "No licence"}</Badge>
                                {player.isBanned && <Badge tone="bad">Banned{player.banReason ? `: ${player.banReason}` : ""}</Badge>}
                                {isMuted && <Badge tone="warn">Muted until {formatDate(player.mutedUntil)}</Badge>}
                                {player.licenses.some((l) => l.isActive && l.promoFactionName) && (
                                    <Badge tone="warn">
                                        Promo via {player.licenses.find((l) => l.isActive && l.promoFactionName)?.promoFactionName}
                                    </Badge>
                                )}
                            </div>
                        </div>
                        <button type="button" className="a-icon-btn" onClick={onClose} aria-label="Close">
                            <X className="w-4 h-4" />
                        </button>
                    </header>

                    <div className="a-tabs">
                        {TABS.map((entry) => (
                            <button key={entry.id} type="button" className="a-tab" data-active={tab === entry.id} onClick={() => setTab(entry.id)}>
                                {entry.label}
                            </button>
                        ))}
                    </div>

                    <div className="a-modal-body">
                        {actionError && <Alert tone="bad">{actionError}</Alert>}
                        {notice && !actionError && <Alert tone="good">{notice}</Alert>}

                        {tab === "overview" && (
                            <>
                                <div className="a-grid a-grid-4">
                                    <Tile label="Level" value={`${player.progression.level} · ${skillPointsForLevel(player.progression.level)} sp`} />
                                    <Tile label="Total XP" value={formatNumber(player.progression.totalXp)} />
                                    <Tile label="Ash" value={formatNumber(player.ash)} />
                                    <Tile label="Branch" value={player.progression.branch || "—"} />
                                    <Tile label="Kills / deaths" value={`${formatNumber(player.stats.kills)} / ${formatNumber(player.stats.deaths)}`} />
                                    <Tile label="Shots fired" value={formatNumber(player.stats.shotsFired)} />
                                    <Tile label="Buildings" value={`${formatNumber(player.stats.buildingsPlaced)} placed · ${player.buildingCount} live`} />
                                    <Tile label="Playtime" value={formatPlaytime(player.stats.playtimeSeconds)} />
                                    <Tile label="Joined" value={formatDate(player.createdAt)} />
                                    <Tile label="Last seen" value={formatDate(player.lastSeenAt)} />
                                    <Tile label="Location" value={player.locationId || "—"} />
                                    <Tile label="Respecs" value={formatNumber(player.progression.respecCount)} />
                                </div>

                                <section>
                                    <span className="a-label">Factions ({player.factions.length})</span>
                                    {player.factions.length === 0 ? (
                                        <p className="a-hint">Not in any faction.</p>
                                    ) : (
                                        <div className="a-list">
                                            {player.factions.map((faction) => (
                                                <div key={faction.id} className="a-item">
                                                    <span className="a-item-title">
                                                        {faction.name} #{faction.number}
                                                    </span>
                                                    <Badge tone="info">Lv.{faction.level}</Badge>
                                                    <select
                                                        value={faction.role}
                                                        disabled={busy}
                                                        onChange={(e) => factionAction("setRole", faction.id, e.target.value)}
                                                    >
                                                        <option value="member">member</option>
                                                        <option value="officer">officer</option>
                                                        <option value="founder">founder</option>
                                                    </select>
                                                    <span className="a-hint">
                                                        {formatNumber(faction.contributionPoints)} pts · {faction.tasksContributed} tasks
                                                    </span>
                                                    <button
                                                        type="button"
                                                        className="a-btn a-btn-sm a-btn-danger a-spacer"
                                                        disabled={busy}
                                                        onClick={() => factionAction("leave", faction.id)}
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="a-row" style={{ marginTop: 8 }}>
                                        <select value={factionToJoin} onChange={(e) => setFactionToJoin(e.target.value)} style={{ flex: "1 1 220px" }}>
                                            {factionOptions.length === 0 && <option value="">No factions</option>}
                                            {factionOptions.map((faction) => (
                                                <option key={faction.id} value={faction.id}>
                                                    {faction.name} #{faction.number}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            className="a-btn a-btn-good"
                                            disabled={busy || !factionToJoin}
                                            onClick={() => factionAction("join", factionToJoin)}
                                        >
                                            Add to faction
                                        </button>
                                    </div>
                                </section>

                                <section>
                                    <div className="a-row" style={{ marginBottom: 6 }}>
                                        <span className="a-label" style={{ marginBottom: 0 }}>
                                            Achievements ({player.achievements.length}/{ACHIEVEMENTS.length})
                                        </span>
                                        <span className="a-spacer" />
                                        <button type="button" className="a-btn a-btn-sm a-btn-good" disabled={busy} onClick={() => allAchievements(true)}>
                                            Unlock all
                                        </button>
                                        <button type="button" className="a-btn a-btn-sm a-btn-danger" disabled={busy} onClick={() => allAchievements(false)}>
                                            Clear all
                                        </button>
                                    </div>
                                    <div className="a-grid a-grid-2">
                                        {ACHIEVEMENTS.map((achievement) => {
                                            const unlocked = player.achievements.some((a) => a.key === achievement.key);
                                            return (
                                                <div key={achievement.key} className="a-item">
                                                    <span className="a-item-title" title={achievement.description}>
                                                        {achievement.label}
                                                    </span>
                                                    <span className="a-spacer" />
                                                    <button
                                                        type="button"
                                                        className={`a-btn a-btn-sm ${unlocked ? "a-btn-danger" : "a-btn-good"}`}
                                                        disabled={busy}
                                                        onClick={() => toggleAchievement(achievement.key, !unlocked)}
                                                    >
                                                        {unlocked ? "Revoke" : "Unlock"}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            </>
                        )}

                        {tab === "inventory" && (
                            <>
                                <section>
                                    <div className="a-row" style={{ marginBottom: 6 }}>
                                        <span className="a-label" style={{ marginBottom: 0 }}>Game licence</span>
                                        <span className="a-spacer" />
                                        <button type="button" className="a-btn a-btn-sm a-btn-good" disabled={busy} onClick={() => toggleLicense(true)}>
                                            Grant access
                                        </button>
                                        <button type="button" className="a-btn a-btn-sm a-btn-danger" disabled={busy} onClick={() => toggleLicense(false)}>
                                            Revoke access
                                        </button>
                                    </div>
                                    {player.licenses.length === 0 ? (
                                        <p className="a-hint">No licences.</p>
                                    ) : (
                                        <div className="a-list">
                                            {player.licenses.map((licence) => (
                                                <div key={licence.id} className="a-item">
                                                    <span className="a-item-title" style={{ textDecoration: licence.isActive ? "none" : "line-through" }}>
                                                        {licence.gameTitle}
                                                    </span>
                                                    {licence.promoFactionName && <Badge tone="warn">promo · {licence.promoFactionName}</Badge>}
                                                    <Badge tone={licence.txSignature ? "good" : "info"}>
                                                        {licence.txSignature ? `${formatNumber(licence.price)} TNJ` : "granted"}
                                                    </Badge>
                                                    <span className="a-hint a-spacer">{formatDate(licence.purchasedAt)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>

                                <section>
                                    <span className="a-label">Placeables & consumables</span>
                                    {Object.keys(player.placeables).length === 0 ? (
                                        <p className="a-hint">Nothing owned.</p>
                                    ) : (
                                        <div className="a-grid a-grid-3">
                                            {Object.entries(player.placeables).map(([itemId, quantity]) => (
                                                <div key={itemId} className="a-item">
                                                    <span className="a-item-title">
                                                        {adminLabel(PLACEABLE_ITEMS.find((p) => p.id === itemId)?.name || itemId)} × {quantity}
                                                    </span>
                                                    <span className="a-spacer" />
                                                    <button
                                                        type="button"
                                                        className="a-icon-btn"
                                                        data-tone="bad"
                                                        disabled={busy}
                                                        title="Take one"
                                                        onClick={() => adjustPlaceable(itemId, -1, 1)}
                                                    >
                                                        <Minus className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="a-icon-btn"
                                                        disabled={busy}
                                                        title="Give one"
                                                        onClick={() => adjustPlaceable(itemId, 1, 1)}
                                                    >
                                                        <Plus className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>

                                <section>
                                    <span className="a-label">Companions</span>
                                    <div className="a-grid a-grid-3" style={{ marginBottom: 8 }}>
                                        <Tile
                                            label="Equipped"
                                            value={
                                                player.companions?.equipped
                                                    ? adminLabel(COMPANIONS_BY_ID.get(player.companions.equipped as never)?.nameKey || player.companions.equipped)
                                                    : "—"
                                            }
                                        />
                                        <Tile label="Fragments" value={`${player.companions?.fragments ?? 0} / ${FRAGMENTS_PER_CRATE}`} />
                                        <Tile label="Crates" value={formatNumber(player.companions?.crates ?? 0)} />
                                    </div>
                                    {!player.companions || player.companions.owned.length === 0 ? (
                                        <p className="a-hint">None owned.</p>
                                    ) : (
                                        <div className="a-grid a-grid-2">
                                            {player.companions.owned.map((entry) => {
                                                const definition = COMPANIONS_BY_ID.get(entry.itemId as never);
                                                const equipped = player.companions?.equipped === entry.itemId;
                                                return (
                                                    <div key={entry.itemId} className="a-item">
                                                        <span className="a-item-title">
                                                            {definition?.icon || ""} {adminLabel(definition?.nameKey || entry.itemId)} × {entry.quantity}
                                                        </span>
                                                        <Badge>{definition?.rarity || "?"}</Badge>
                                                        <span className="a-spacer" />
                                                        <button
                                                            type="button"
                                                            className="a-btn a-btn-sm"
                                                            disabled={busy}
                                                            onClick={() => setEquippedCompanion(equipped ? "" : entry.itemId)}
                                                        >
                                                            {equipped ? "Unequip" : "Equip"}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="a-icon-btn"
                                                            data-tone="bad"
                                                            disabled={busy}
                                                            title="Take one"
                                                            onClick={() => adjustCatalog(entry.itemId, -1, 1)}
                                                        >
                                                            <Minus className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </section>

                                <section>
                                    <span className="a-label">Skins & accessories</span>
                                    <div className="a-grid a-grid-4" style={{ marginBottom: 8 }}>
                                        <Tile
                                            label="Equipped skin"
                                            value={player.cosmetics?.equippedSkin ? adminLabel(player.cosmetics.equippedSkin.name) : "—"}
                                        />
                                        <Tile
                                            label="Equipped accessory"
                                            value={player.cosmetics?.equippedAccessory ? adminLabel(player.cosmetics.equippedAccessory.name) : "—"}
                                        />
                                        <Tile label="Fragments" value={`${player.cosmeticCrates?.fragments ?? 0} / ${COSMETIC_FRAGMENTS_PER_CRATE}`} />
                                        <Tile label="Crates" value={formatNumber(player.cosmeticCrates?.crates ?? 0)} />
                                    </div>
                                    {!player.cosmetics || player.cosmetics.owned.length === 0 ? (
                                        <p className="a-hint">None owned.</p>
                                    ) : (
                                        <div className="a-grid a-grid-2">
                                            {player.cosmetics.owned.map((item) => (
                                                <div key={item.id} className="a-item">
                                                    <span className="a-item-title">{adminLabel(item.name)}</span>
                                                    <Badge>{COSMETICS_BY_ID.get(item.id as never)?.rarity || item.slot}</Badge>
                                                    <span className="a-spacer" />
                                                    <button
                                                        type="button"
                                                        className="a-btn a-btn-sm a-btn-danger"
                                                        disabled={busy}
                                                        onClick={() => adjustCatalog(item.id, -1, 1)}
                                                    >
                                                        Take
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>

                                <section>
                                    <span className="a-label">
                                        Token inventory ({player.inventory.length}) · storage stacks {player.storageCount}
                                    </span>
                                    {player.inventory.length === 0 ? (
                                        <p className="a-hint">Empty.</p>
                                    ) : (
                                        <div className="a-grid a-grid-2">
                                            {player.inventory.map((item) => (
                                                <div key={item.slot} className="a-item">
                                                    <span className="a-item-title a-mono">{item.itemId}</span>
                                                    <span className="a-hint">× {formatNumber(item.quantity)}</span>
                                                    <span className="a-spacer" />
                                                    <button
                                                        type="button"
                                                        className="a-icon-btn"
                                                        data-tone="bad"
                                                        disabled={busy}
                                                        title="Remove stack"
                                                        onClick={() => removeInventoryItem(item.slot)}
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>
                            </>
                        )}

                        {tab === "grants" && (
                            <>
                                {player.isOnline && (
                                    <Alert tone="info">
                                        This player is in a live session. Ash, items, level and wipes are handed to the game server
                                        as changes rather than written here, so they land in-game within about five seconds without
                                        touching anything the player earned meanwhile. The figures on this page catch up once the
                                        session saves.
                                    </Alert>
                                )}

                                <section>
                                    <span className="a-label">Give or take any item in the game</span>
                                    <div className="a-row">
                                        <select value={catalogItem} onChange={(e) => setCatalogItem(e.target.value)} style={{ flex: "1 1 260px" }}>
                                            {Object.entries(catalogByKind).map(([kind, entries]) => (
                                                <optgroup key={kind} label={KIND_LABEL[kind] || kind}>
                                                    {entries.map((entry) => (
                                                        <option key={entry.itemId} value={entry.itemId}>
                                                            {entry.name}
                                                            {entry.maxOwned !== null ? ` (max ${entry.maxOwned})` : ""}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            ))}
                                        </select>
                                        <input
                                            type="number"
                                            min={1}
                                            value={catalogQuantity}
                                            onChange={(e) => setCatalogQuantity(e.target.value)}
                                            style={{ width: 90 }}
                                        />
                                        <button
                                            type="button"
                                            className="a-btn a-btn-good"
                                            disabled={busy}
                                            onClick={() => adjustCatalog(catalogItem, 1, Number(catalogQuantity))}
                                        >
                                            <Plus />
                                            Give
                                        </button>
                                        <button
                                            type="button"
                                            className="a-btn a-btn-danger"
                                            disabled={busy}
                                            onClick={() => adjustCatalog(catalogItem, -1, Number(catalogQuantity))}
                                        >
                                            <Minus />
                                            Take
                                        </button>
                                    </div>
                                    <p className="a-hint" style={{ marginTop: 6 }}>
                                        Covers everything the in-game shop sells: placeables, consumables, pets, crates, skins and accessories.
                                        Skins are owned once, so quantity is ignored for them.
                                    </p>
                                </section>

                                <div className="a-grid a-grid-2">
                                    <section>
                                        <span className="a-label">Ash — currently {formatNumber(player.ash)}</span>
                                        <div className="a-row">
                                            <input type="number" min={1} value={ashAmountInput} onChange={(e) => setAshAmountInput(e.target.value)} style={{ width: 130 }} />
                                            <button type="button" className="a-btn a-btn-good" disabled={busy} onClick={() => adjustAsh(1)}>
                                                Give
                                            </button>
                                            <button type="button" className="a-btn a-btn-danger" disabled={busy} onClick={() => adjustAsh(-1)}>
                                                Take
                                            </button>
                                        </div>
                                    </section>

                                    <section>
                                        <span className="a-label">
                                            Character level — {player.progression.level} ({skillPointsForLevel(player.progression.level)} skill points)
                                        </span>
                                        <div className="a-row">
                                            <input type="number" min={1} max={MAX_LEVEL} value={levelInput} onChange={(e) => setLevelInput(e.target.value)} style={{ width: 110 }} />
                                            <button type="button" className="a-btn a-btn-primary" disabled={busy} onClick={setLevel}>
                                                Set level
                                            </button>
                                            <span className="a-hint">
                                                {player.isOnline ? "applies in-game within ~5s" : "applies on next login"}
                                            </span>
                                        </div>
                                    </section>

                                    <section>
                                        <span className="a-label">Meme fragments & crates</span>
                                        <div className="a-row">
                                            <input type="number" min={1} value={memeFragments} onChange={(e) => setMemeFragments(e.target.value)} style={{ width: 90 }} />
                                            <button type="button" className="a-btn a-btn-sm a-btn-good" disabled={busy} onClick={() => adjustCompanionWallet("fragments", 1, Number(memeFragments))}>
                                                + frags
                                            </button>
                                            <button type="button" className="a-btn a-btn-sm a-btn-danger" disabled={busy} onClick={() => adjustCompanionWallet("fragments", -1, Number(memeFragments))}>
                                                − frags
                                            </button>
                                            <input type="number" min={1} value={memeCrates} onChange={(e) => setMemeCrates(e.target.value)} style={{ width: 70 }} />
                                            <button type="button" className="a-btn a-btn-sm a-btn-good" disabled={busy} onClick={() => adjustCompanionWallet("crates", 1, Number(memeCrates))}>
                                                + crates
                                            </button>
                                            <button type="button" className="a-btn a-btn-sm a-btn-danger" disabled={busy} onClick={() => adjustCompanionWallet("crates", -1, Number(memeCrates))}>
                                                − crates
                                            </button>
                                        </div>
                                    </section>

                                    <section>
                                        <span className="a-label">Skin fragments & crates</span>
                                        <div className="a-row">
                                            <input type="number" min={1} value={skinFragments} onChange={(e) => setSkinFragments(e.target.value)} style={{ width: 90 }} />
                                            <button type="button" className="a-btn a-btn-sm a-btn-good" disabled={busy} onClick={() => adjustCosmeticWallet("fragments", 1, Number(skinFragments))}>
                                                + frags
                                            </button>
                                            <button type="button" className="a-btn a-btn-sm a-btn-danger" disabled={busy} onClick={() => adjustCosmeticWallet("fragments", -1, Number(skinFragments))}>
                                                − frags
                                            </button>
                                            <input type="number" min={1} value={skinCrates} onChange={(e) => setSkinCrates(e.target.value)} style={{ width: 70 }} />
                                            <button type="button" className="a-btn a-btn-sm a-btn-good" disabled={busy} onClick={() => adjustCosmeticWallet("crates", 1, Number(skinCrates))}>
                                                + crates
                                            </button>
                                            <button type="button" className="a-btn a-btn-sm a-btn-danger" disabled={busy} onClick={() => adjustCosmeticWallet("crates", -1, Number(skinCrates))}>
                                                − crates
                                            </button>
                                        </div>
                                    </section>
                                </div>

                                <div className="a-sep" />

                                <section>
                                    <span className="a-label">Grant everything</span>
                                    <div className="a-pills" style={{ marginBottom: 8 }}>
                                        {GRANT_SCOPES.map((scope) => (
                                            <label key={scope} className="a-item" style={{ cursor: "pointer" }}>
                                                <input type="checkbox" checked={grantScopes.includes(scope)} onChange={() => toggleScope("grant", scope)} />
                                                {SCOPE_LABELS[scope] || scope}
                                            </label>
                                        ))}
                                    </div>
                                    <div className="a-row">
                                        <label className="a-row" style={{ gap: 6 }}>
                                            <span className="a-hint">Ash</span>
                                            <input type="number" min={0} value={grantAsh} onChange={(e) => setGrantAsh(e.target.value)} style={{ width: 130 }} />
                                        </label>
                                        <label className="a-row" style={{ gap: 6 }}>
                                            <span className="a-hint">Level</span>
                                            <input type="number" min={1} max={MAX_LEVEL} value={grantLevel} onChange={(e) => setGrantLevel(e.target.value)} style={{ width: 90 }} />
                                        </label>
                                        <label className="a-row" style={{ gap: 6 }}>
                                            <span className="a-hint">Crates</span>
                                            <input type="number" min={0} value={grantCrateCount} onChange={(e) => setGrantCrateCount(e.target.value)} style={{ width: 90 }} />
                                        </label>
                                        <button type="button" className="a-btn a-btn-primary a-spacer" disabled={busy} onClick={() => runBulk("grant")}>
                                            Grant selected scopes
                                        </button>
                                    </div>
                                    <p className="a-hint" style={{ marginTop: 6 }}>
                                        Unlocks the licence, every placeable up to its cap, every pet, every skin, the chosen ash and level,
                                        crates plus ten fragments each, and all achievements.
                                    </p>
                                </section>

                                <section>
                                    <span className="a-label" style={{ color: "var(--a-bad)" }}>Strip the account</span>
                                    <div className="a-pills" style={{ marginBottom: 8 }}>
                                        {WIPE_SCOPES.map((scope) => (
                                            <label key={scope} className="a-item" style={{ cursor: "pointer" }}>
                                                <input type="checkbox" checked={wipeScopes.includes(scope)} onChange={() => toggleScope("wipe", scope)} />
                                                {SCOPE_LABELS[scope] || scope}
                                            </label>
                                        ))}
                                    </div>
                                    <div className="a-row">
                                        <input
                                            type="text"
                                            value={wipeConfirm}
                                            onChange={(e) => setWipeConfirm(e.target.value)}
                                            placeholder="Type WIPE to confirm"
                                            style={{ width: 200 }}
                                        />
                                        <button type="button" className="a-btn a-btn-danger" disabled={busy} onClick={() => runBulk("wipe")}>
                                            Take everything selected
                                        </button>
                                        <span className="a-hint">This cannot be undone.</span>
                                    </div>
                                </section>
                            </>
                        )}

                        {tab === "purchases" && (
                            <>
                                <div className="a-grid a-grid-4">
                                    <Tile label="Spent on games" value={`${formatNumber(player.spend.gameTnj)} TNJ`} />
                                    <Tile label="Spent in shop" value={`${formatNumber(player.spend.shopTnj)} TNJ`} />
                                    <Tile label="Spent on trades" value={`${formatNumber(player.spend.tradeSpentTnj)} TNJ`} />
                                    <Tile label="Earned from trades" value={`${formatNumber(player.spend.tradeEarnedTnj)} TNJ`} />
                                </div>

                                <section>
                                    <span className="a-label">Game licences</span>
                                    {player.licenses.length === 0 ? (
                                        <p className="a-hint">Never bought or granted a licence.</p>
                                    ) : (
                                        <div className="a-list">
                                            {player.licenses.map((licence) => (
                                                <div key={licence.id} className="a-item">
                                                    <span className="a-item-title">{licence.gameTitle}</span>
                                                    <Badge tone={licence.isActive ? "good" : "neutral"}>{licence.isActive ? "active" : "revoked"}</Badge>
                                                    <span className="a-hint">
                                                        {licence.txSignature ? `${formatNumber(licence.price)} TNJ` : licence.promoFactionName ? `promo · ${licence.promoFactionName}` : "granted"}
                                                    </span>
                                                    <span className="a-hint a-spacer">{formatDate(licence.purchasedAt)}</span>
                                                    {licence.txSignature && (
                                                        <a
                                                            href={`https://solscan.io/tx/${licence.txSignature}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            style={{ color: "var(--a-accent)" }}
                                                        >
                                                            <ExternalLink className="w-3 h-3" />
                                                        </a>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>

                                <section>
                                    <span className="a-label">In-game purchases ({player.shopHistory.length})</span>
                                    {player.shopHistory.length === 0 ? (
                                        <p className="a-hint">No shop purchases.</p>
                                    ) : (
                                        <div className="a-list a-scroll-sm">
                                            {player.shopHistory.map((purchase) => (
                                                <div key={purchase.id} className="a-item">
                                                    <span className="a-item-title">
                                                        {SHOP_CATALOG.find((e) => e.itemId === purchase.itemId)?.name || purchase.itemId}
                                                        {purchase.quantity > 1 ? ` ×${purchase.quantity}` : ""}
                                                    </span>
                                                    <Badge tone={purchase.status === "completed" ? "good" : "bad"}>{purchase.status}</Badge>
                                                    <span style={{ color: "var(--a-warn)", fontWeight: 700 }}>{formatNumber(purchase.priceTnj)} TNJ</span>
                                                    <span className="a-hint a-spacer">{formatDate(purchase.createdAt)}</span>
                                                    <a
                                                        href={`https://solscan.io/tx/${purchase.txSignature}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{ color: "var(--a-accent)" }}
                                                    >
                                                        <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>

                                <section>
                                    <span className="a-label">Trades ({player.tradeHistory.length})</span>
                                    {player.tradeHistory.length === 0 ? (
                                        <p className="a-hint">No trades.</p>
                                    ) : (
                                        <div className="a-list a-scroll-sm">
                                            {player.tradeHistory.map((trade) => (
                                                <div key={trade.id} className="a-item">
                                                    <Badge tone={trade.buyerId === player.id ? "info" : "violet"}>
                                                        {trade.buyerId === player.id ? "bought" : "sold"}
                                                    </Badge>
                                                    <span className="a-item-title">
                                                        {adminLabel(trade.itemName)}
                                                        {trade.quantity > 1 ? ` ×${trade.quantity}` : ""}
                                                    </span>
                                                    <Badge tone={trade.status === "completed" ? "good" : "bad"}>{trade.status}</Badge>
                                                    <span style={{ color: "var(--a-warn)", fontWeight: 700 }}>{formatNumber(trade.priceTnj)} TNJ</span>
                                                    <span className="a-hint a-spacer">{formatDate(trade.createdAt)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>
                            </>
                        )}

                        {tab === "moderation" && (
                            <>
                                <p className="a-hint">Every action here is signed with your admin wallet.</p>

                                <section>
                                    <span className="a-label">Ban</span>
                                    {player.isBanned ? (
                                        <div className="a-row">
                                            <Badge tone="bad">Banned {player.bannedAt ? formatDate(player.bannedAt) : ""}</Badge>
                                            <button type="button" className="a-btn a-btn-good" disabled={busy} onClick={() => setBan(false)}>
                                                Unban
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="a-row">
                                            <input
                                                type="text"
                                                value={banReasonInput}
                                                onChange={(e) => setBanReasonInput(e.target.value)}
                                                placeholder="Reason shown to the player…"
                                                style={{ flex: "1 1 240px" }}
                                            />
                                            <button type="button" className="a-btn a-btn-danger" disabled={busy} onClick={() => setBan(true)}>
                                                Ban account
                                            </button>
                                        </div>
                                    )}
                                </section>

                                <section>
                                    <span className="a-label">Mute (chat + voice)</span>
                                    <div className="a-row">
                                        {MUTE_DURATIONS.map((duration) => (
                                            <button key={duration.minutes} type="button" className="a-btn a-btn-sm" disabled={busy} onClick={() => setMute(duration.minutes)}>
                                                {duration.label}
                                            </button>
                                        ))}
                                        {isMuted && (
                                            <button type="button" className="a-btn a-btn-sm a-btn-good" disabled={busy} onClick={() => setMute(null)}>
                                                Unmute
                                            </button>
                                        )}
                                        {isMuted && <span className="a-hint">until {formatDate(player.mutedUntil)}</span>}
                                    </div>
                                </section>

                                <section>
                                    <span className="a-label">Personalisation</span>
                                    <div className="a-row">
                                        {player.skinTextureUrl ? (
                                            <a href={player.skinTextureUrl} target="_blank" rel="noopener noreferrer" className="a-hint" style={{ color: "var(--a-accent)" }}>
                                                View painted skin
                                            </a>
                                        ) : (
                                            <span className="a-hint">No custom skin painted.</span>
                                        )}
                                        <button type="button" className="a-btn a-btn-danger" disabled={busy || !player.skinTextureUrl} onClick={resetSkin}>
                                            Reset skin
                                        </button>
                                    </div>
                                </section>

                                <section>
                                    <span className="a-label">Identity</span>
                                    <div className="a-grid a-grid-2">
                                        <Tile label="Nicknames" value={player.nicknames.join(", ") || "—"} />
                                        <Tile label="Wallet" value={truncateWallet(player.wallet)} />
                                    </div>
                                </section>
                            </>
                        )}
                    </div>
                </>
            )}
        </Modal>
    );
}
