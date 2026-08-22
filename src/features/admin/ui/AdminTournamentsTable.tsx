// src/features/admin/ui/AdminTournamentsTable.tsx
"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Save, Trash2, Trophy } from "lucide-react";
import { useAdminSignature } from "../lib/useAdminSignature";
import { AdminTableRef } from "./AdminTableRef";
import { AdminTournamentEntries } from "./AdminTournamentEntries";
import {
    TOURNAMENT_CURRENCIES,
    TOURNAMENT_KINDS,
    formatReward,
    type TournamentCurrency,
    type TournamentKind,
    type TournamentPhase,
    type TournamentStatus,
} from "@/core/lib/tournaments";

export interface AdminTournament {
    id: string;
    kind: TournamentKind;
    title: string;
    description: string;
    rulesText: string;
    rewardAmount: string;
    rewardCurrency: TournamentCurrency;
    rewardNote: string;
    accent: string;
    maxEntries: number;
    startsAt: string;
    endsAt: string;
    status: TournamentStatus;
    phase: TournamentPhase;
    submission: "skin" | "shot" | "none";
    winnerEntryId: string | null;
    winnerDecidedAt: string | null;
    paidAt: string | null;
    payoutRef: string | null;
    entryCount: number;
    submittedCount: number;
    likeCount: number;
    createdAt: string;
}

interface Draft {
    kind: TournamentKind;
    title: string;
    description: string;
    rulesText: string;
    rewardAmount: string;
    rewardCurrency: TournamentCurrency;
    rewardNote: string;
    accent: string;
    maxEntries: number;
    startsAt: string;
    endsAt: string;
    status: TournamentStatus;
}

const DRAFT_KEYS: (keyof Draft)[] = [
    "kind",
    "title",
    "description",
    "rulesText",
    "rewardAmount",
    "rewardCurrency",
    "rewardNote",
    "accent",
    "maxEntries",
    "startsAt",
    "endsAt",
    "status",
];

const PHASE_TONE: Record<TournamentPhase, string> = {
    upcoming: "#8B8F98",
    active: "#5FD39A",
    ended: "#E2666E",
};

function toLocalInput(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function fromLocalInput(value: string): string | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toDraft(tournament: AdminTournament): Draft {
    return {
        kind: tournament.kind,
        title: tournament.title,
        description: tournament.description,
        rulesText: tournament.rulesText,
        // The API hands back a fixed-scale numeric; trimming the tail keeps the
        // input from reading "500.000000" every time the page loads.
        rewardAmount: String(Number(tournament.rewardAmount)),
        rewardCurrency: tournament.rewardCurrency,
        rewardNote: tournament.rewardNote,
        accent: tournament.accent,
        maxEntries: tournament.maxEntries,
        startsAt: toLocalInput(tournament.startsAt),
        endsAt: toLocalInput(tournament.endsAt),
        status: tournament.status,
    };
}

function blankDraft(): Draft {
    const start = new Date();
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    return {
        kind: "costume",
        title: "",
        description: "",
        rulesText: "",
        rewardAmount: "0",
        rewardCurrency: "USDC",
        rewardNote: "",
        accent: "#f0b95c",
        maxEntries: 0,
        startsAt: toLocalInput(start.toISOString()),
        endsAt: toLocalInput(end.toISOString()),
        status: "draft",
    };
}

function isDirty(draft: Draft, tournament: AdminTournament): boolean {
    const current = toDraft(tournament);
    return DRAFT_KEYS.some((key) => draft[key] !== current[key]);
}

export const AdminTournamentsTable = forwardRef<AdminTableRef>(function AdminTournamentsTable(_props, ref) {
    const [tournaments, setTournaments] = useState<AdminTournament[]>([]);
    const [gameSlug, setGameSlug] = useState<string | null>(null);
    const [gameName, setGameName] = useState<string | null>(null);
    const [drafts, setDrafts] = useState<Record<string, Draft>>({});
    const [newDraft, setNewDraft] = useState<Draft | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { signedFetch } = useAdminSignature();

    const load = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/tournaments", { credentials: "include" });
            if (res.ok) {
                const data = await res.json();
                const list: AdminTournament[] = data.tournaments || [];
                setTournaments(list);
                setGameSlug(data.gameSlug || null);
                setGameName(data.gameName || null);
                setDrafts(Object.fromEntries(list.map((entry) => [entry.id, toDraft(entry)])));
            }
        } finally {
            setLoading(false);
        }
    };

    useImperativeHandle(ref, () => ({ refresh: load }));

    useEffect(() => {
        load();
    }, []);

    const patch = (id: string, changes: Partial<Draft>) =>
        setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...changes } }));

    const bodyOf = (draft: Draft) => ({
        gameSlug,
        kind: draft.kind,
        title: draft.title,
        description: draft.description,
        rulesText: draft.rulesText,
        rewardAmount: Number(draft.rewardAmount) || 0,
        rewardCurrency: draft.rewardCurrency,
        rewardNote: draft.rewardNote,
        accent: draft.accent,
        maxEntries: draft.maxEntries,
        startsAt: fromLocalInput(draft.startsAt),
        endsAt: fromLocalInput(draft.endsAt),
        status: draft.status,
    });

    const create = async () => {
        if (!newDraft) return;
        setError(null);
        setBusyId("new");
        try {
            const res = await signedFetch(
                "/api/admin/tournaments",
                "tournament_create",
                "tournament:new",
                bodyOf(newDraft),
                "POST"
            );
            if (res.ok) {
                setNewDraft(null);
                await load();
            } else {
                const data = await res.json().catch(() => ({}));
                setError(data.error || "Create failed");
            }
        } catch (err: any) {
            setError(err.message || "Create failed");
        } finally {
            setBusyId(null);
        }
    };

    const save = async (tournament: AdminTournament) => {
        const draft = drafts[tournament.id];
        if (!draft) return;

        setError(null);
        setBusyId(tournament.id);
        try {
            const res = await signedFetch(
                "/api/admin/tournaments",
                "tournament_update",
                `tournament:${tournament.id}`,
                { id: tournament.id, ...bodyOf(draft) }
            );
            if (res.ok) {
                await load();
            } else {
                const data = await res.json().catch(() => ({}));
                setError(data.error || "Save failed");
            }
        } catch (err: any) {
            setError(err.message || "Save failed");
        } finally {
            setBusyId(null);
        }
    };

    const remove = async (tournament: AdminTournament) => {
        if (!window.confirm(`Delete "${tournament.title}"? Every entry, screenshot record and vote goes with it.`)) return;

        setError(null);
        setBusyId(tournament.id);
        try {
            const res = await signedFetch(
                "/api/admin/tournaments",
                "tournament_delete",
                `tournament:${tournament.id}`,
                { id: tournament.id },
                "DELETE"
            );
            if (res.ok) await load();
            else {
                const data = await res.json().catch(() => ({}));
                setError(data.error || "Delete failed");
            }
        } catch (err: any) {
            setError(err.message || "Delete failed");
        } finally {
            setBusyId(null);
        }
    };

    const savePayout = async (tournament: AdminTournament, paid: boolean, payoutRef: string, winnerEntryId: string | null) => {
        setError(null);
        setBusyId(tournament.id);
        try {
            const res = await signedFetch(
                "/api/admin/tournaments",
                "tournament_update",
                `tournament:${tournament.id}`,
                { id: tournament.id, mode: "payout", paid, payoutRef, winnerEntryId }
            );
            if (res.ok) await load();
            else {
                const data = await res.json().catch(() => ({}));
                setError(data.error || "Save failed");
            }
        } catch (err: any) {
            setError(err.message || "Save failed");
        } finally {
            setBusyId(null);
        }
    };

    const renderForm = (draft: Draft, apply: (changes: Partial<Draft>) => void, kindLocked: boolean) => (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
                <select
                    value={draft.kind}
                    onChange={(e) => apply({ kind: e.target.value as TournamentKind })}
                    disabled={kindLocked}
                    title={kindLocked ? "Locked — players have already entered" : undefined}
                    className="bg-black/40 text-white px-2 py-1.5 rounded text-xs border border-white/10 outline-none disabled:opacity-40"
                >
                    {TOURNAMENT_KINDS.map((kind) => (
                        <option key={kind.key} value={kind.key}>
                            {kind.adminLabel}
                        </option>
                    ))}
                </select>

                <input
                    value={draft.title}
                    onChange={(e) => apply({ title: e.target.value })}
                    placeholder="Title shown on the billboard"
                    className="flex-1 min-w-[220px] bg-black/40 text-white px-2 py-1.5 rounded text-xs border border-white/10 outline-none"
                />

                <select
                    value={draft.status}
                    onChange={(e) => apply({ status: e.target.value as TournamentStatus })}
                    className="bg-black/40 text-white px-2 py-1.5 rounded text-xs border border-white/10 outline-none"
                >
                    <option value="draft">Draft (hidden in game)</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                </select>
            </div>

            <textarea
                value={draft.description}
                onChange={(e) => apply({ description: e.target.value })}
                placeholder="Description — what the contest is about"
                rows={2}
                className="w-full bg-black/40 text-white px-2 py-1.5 rounded text-xs border border-white/10 outline-none"
            />

            <textarea
                value={draft.rulesText}
                onChange={(e) => apply({ rulesText: e.target.value })}
                placeholder="Conditions — how a submission qualifies, how the winner is picked"
                rows={2}
                className="w-full bg-black/40 text-white px-2 py-1.5 rounded text-xs border border-white/10 outline-none"
            />

            <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-[#8B8F98]">
                    Reward
                    <input
                        type="number"
                        min={0}
                        step="0.000001"
                        value={draft.rewardAmount}
                        onChange={(e) => apply({ rewardAmount: e.target.value })}
                        className="w-32 bg-black/40 text-white px-2 py-1.5 rounded border border-white/10 outline-none"
                    />
                </label>

                <select
                    value={draft.rewardCurrency}
                    onChange={(e) => apply({ rewardCurrency: e.target.value as TournamentCurrency })}
                    className="bg-black/40 text-white px-2 py-1.5 rounded text-xs border border-white/10 outline-none"
                >
                    {TOURNAMENT_CURRENCIES.map((currency) => (
                        <option key={currency} value={currency}>
                            {currency}
                        </option>
                    ))}
                </select>

                <input
                    value={draft.rewardNote}
                    onChange={(e) => apply({ rewardNote: e.target.value })}
                    placeholder="Reward note (e.g. split across top 3)"
                    className="flex-1 min-w-[180px] bg-black/40 text-white px-2 py-1.5 rounded text-xs border border-white/10 outline-none"
                />
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-[#8B8F98]">
                    Starts
                    <input
                        type="datetime-local"
                        value={draft.startsAt}
                        onChange={(e) => apply({ startsAt: e.target.value })}
                        className="bg-black/40 text-white px-2 py-1.5 rounded border border-white/10 outline-none"
                    />
                </label>

                <label className="flex items-center gap-1.5 text-xs text-[#8B8F98]">
                    Ends
                    <input
                        type="datetime-local"
                        value={draft.endsAt}
                        onChange={(e) => apply({ endsAt: e.target.value })}
                        className="bg-black/40 text-white px-2 py-1.5 rounded border border-white/10 outline-none"
                    />
                </label>

                <label className="flex items-center gap-1.5 text-xs text-[#8B8F98]">
                    Max entries (0 = unlimited)
                    <input
                        type="number"
                        min={0}
                        value={draft.maxEntries}
                        onChange={(e) => apply({ maxEntries: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                        className="w-24 bg-black/40 text-white px-2 py-1.5 rounded border border-white/10 outline-none"
                    />
                </label>

                <label className="flex items-center gap-1.5 text-xs text-[#8B8F98]">
                    Accent
                    <input
                        type="color"
                        value={draft.accent}
                        onChange={(e) => apply({ accent: e.target.value })}
                        className="h-8 w-12 rounded border border-white/10 bg-black/40"
                    />
                </label>
            </div>
        </div>
    );

    if (loading) return <div className="text-[#8B8F98] text-sm">Loading tournaments...</div>;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
                <span className="text-[#8B8F98]">
                    Billboard contests in the main hall of{" "}
                    <span className="text-[#E5E7EB] font-bold">{gameName ?? "—"}</span>
                    {gameSlug ? <span className="text-[#6B7280] font-mono"> ({gameSlug})</span> : null}. Published ones
                    appear on the board within a minute; drafts stay here.
                </span>
                <button
                    onClick={() => setNewDraft((prev) => (prev ? null : blankDraft()))}
                    className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 text-sm font-bold px-2 py-1"
                >
                    <Plus className="w-4 h-4" />
                    New tournament
                </button>
            </div>

            {error && (
                <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>
            )}

            {newDraft && (
                <div className="bg-cyan-500/5 border border-cyan-500/25 rounded-lg p-3 space-y-2">
                    <div className="text-white font-bold text-sm">New tournament</div>
                    {renderForm(newDraft, (changes) => setNewDraft((prev) => ({ ...prev!, ...changes })), false)}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={create}
                            disabled={newDraft.title.trim().length === 0 || busyId === "new"}
                            className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 text-xs font-bold px-2 py-1 disabled:opacity-30"
                        >
                            <Save className="w-3.5 h-3.5" />
                            {busyId === "new" ? "Creating..." : "Create"}
                        </button>
                        <button
                            onClick={() => setNewDraft(null)}
                            className="text-[#8B8F98] hover:text-white text-xs px-2 py-1"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            <div className="space-y-2">
                {tournaments.length === 0 && !newDraft && (
                    <div className="text-[#6B7280] text-sm py-6 text-center">No tournaments yet.</div>
                )}

                {tournaments.map((tournament) => {
                    const draft = drafts[tournament.id];
                    if (!draft) return null;

                    const open = expanded === tournament.id;
                    const dirty = isDirty(draft, tournament);

                    return (
                        <div key={tournament.id} className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setExpanded(open ? null : tournament.id)}
                                    className="text-[#8B8F98] hover:text-white p-0 bg-transparent border-0"
                                >
                                    {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </button>

                                <Trophy className="w-4 h-4" style={{ color: tournament.accent }} />
                                <span className="text-white font-bold text-sm">{tournament.title}</span>

                                <span
                                    className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10"
                                    style={{ color: PHASE_TONE[tournament.phase] }}
                                >
                                    {tournament.status === "published" ? tournament.phase : tournament.status}
                                </span>

                                <span className="text-[#FFD166] text-xs font-bold">
                                    {formatReward(tournament.rewardAmount, tournament.rewardCurrency)}
                                </span>

                                <span className="text-[#6B7280] text-xs ml-auto">
                                    {tournament.entryCount} entries · {tournament.submittedCount} submitted ·{" "}
                                    {tournament.likeCount} votes
                                </span>

                                {tournament.paidAt && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                                        paid
                                    </span>
                                )}

                                <button
                                    onClick={() => remove(tournament)}
                                    disabled={busyId === tournament.id}
                                    className="text-red-400 hover:text-red-300 p-1 bg-transparent border-0 disabled:opacity-30"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            {open && (
                                <>
                                    {renderForm(draft, (changes) => patch(tournament.id, changes), tournament.entryCount > 0)}

                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => save(tournament)}
                                            disabled={!dirty || busyId === tournament.id}
                                            className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 text-xs font-bold px-2 py-1 disabled:opacity-30"
                                        >
                                            <Save className="w-3.5 h-3.5" />
                                            {busyId === tournament.id ? "Saving..." : "Save settings"}
                                        </button>
                                        <span className="text-[#6B7280] text-xs">
                                            Created {new Date(tournament.createdAt).toLocaleString()}
                                        </span>
                                    </div>

                                    <AdminTournamentEntries
                                        tournament={tournament}
                                        busy={busyId === tournament.id}
                                        onSavePayout={(paid, payoutRef, winnerEntryId) =>
                                            savePayout(tournament, paid, payoutRef, winnerEntryId)
                                        }
                                        onError={setError}
                                    />
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
});
