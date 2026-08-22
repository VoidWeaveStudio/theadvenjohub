// src/features/admin/ui/AdminTournamentEntries.tsx
"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, ExternalLink, Heart, RotateCcw, Save, Trophy } from "lucide-react";
import { useAdminSignature } from "../lib/useAdminSignature";
import type { AdminTournament } from "./AdminTournamentsTable";
import type { TournamentEntryView } from "@/core/lib/tournaments";

interface AdminTournamentEntriesProps {
    tournament: AdminTournament;
    busy: boolean;
    onSavePayout: (paid: boolean, payoutRef: string, winnerEntryId: string | null) => void;
    onError: (message: string | null) => void;
}

function shortWallet(wallet: string): string {
    return wallet.length > 12 ? `${wallet.slice(0, 6)}…${wallet.slice(-6)}` : wallet;
}

export function AdminTournamentEntries({ tournament, busy, onSavePayout, onError }: AdminTournamentEntriesProps) {
    const [entries, setEntries] = useState<TournamentEntryView[]>([]);
    const [loading, setLoading] = useState(true);
    const [paid, setPaid] = useState(!!tournament.paidAt);
    const [payoutRef, setPayoutRef] = useState(tournament.payoutRef ?? "");
    const [winnerEntryId, setWinnerEntryId] = useState(tournament.winnerEntryId);
    const [moderatingId, setModeratingId] = useState<string | null>(null);
    const { signedFetch } = useAdminSignature();

    const load = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/tournaments/entries?tournamentId=${tournament.id}`, {
                credentials: "include",
            });
            if (res.ok) {
                const data = await res.json();
                setEntries(data.entries || []);
                setWinnerEntryId(data.winnerEntryId ?? null);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [tournament.id]);

    useEffect(() => {
        setPaid(!!tournament.paidAt);
        setPayoutRef(tournament.payoutRef ?? "");
        setWinnerEntryId(tournament.winnerEntryId);
    }, [tournament.paidAt, tournament.payoutRef, tournament.winnerEntryId]);

    const moderate = async (entry: TournamentEntryView, remove: boolean) => {
        if (remove && !window.confirm(`Hide the entry by ${entry.nickname || entry.wallet}? Votes already cast stay counted.`)) {
            return;
        }

        onError(null);
        setModeratingId(entry.id);
        try {
            const res = await signedFetch(
                "/api/admin/tournaments/entries",
                "tournament_entry_moderate",
                `entry:${entry.id}`,
                { entryId: entry.id, remove }
            );
            if (res.ok) await load();
            else {
                const data = await res.json().catch(() => ({}));
                onError(data.error || "Moderation failed");
            }
        } catch (err: any) {
            onError(err.message || "Moderation failed");
        } finally {
            setModeratingId(null);
        }
    };

    const payoutDirty =
        paid !== !!tournament.paidAt ||
        payoutRef !== (tournament.payoutRef ?? "") ||
        winnerEntryId !== tournament.winnerEntryId;

    return (
        <div className="space-y-2 border-t border-white/10 pt-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#6B7280]">Payout</span>

                <label className="flex items-center gap-1.5 text-[#8B8F98]">
                    <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
                    Prize paid out
                </label>

                <input
                    value={payoutRef}
                    onChange={(e) => setPayoutRef(e.target.value)}
                    placeholder="Payout reference (tx signature, transfer id…)"
                    className="flex-1 min-w-[220px] bg-black/40 text-white px-2 py-1.5 rounded border border-white/10 outline-none"
                />

                <button
                    onClick={() => onSavePayout(paid, payoutRef, winnerEntryId)}
                    disabled={!payoutDirty || busy}
                    className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 font-bold px-2 py-1 disabled:opacity-30"
                >
                    <Save className="w-3.5 h-3.5" />
                    Save payout
                </button>
            </div>

            <div className="text-[10px] text-[#6B7280]">
                {tournament.winnerDecidedAt
                    ? `Winner picked automatically from the vote count on ${new Date(tournament.winnerDecidedAt).toLocaleString()}. You can override it below.`
                    : "The winner is picked automatically once the window closes — whoever holds the most votes."}
            </div>

            {loading ? (
                <div className="text-[#8B8F98] text-xs">Loading entries...</div>
            ) : entries.length === 0 ? (
                <div className="text-[#6B7280] text-xs py-3">No entries yet.</div>
            ) : (
                <div className="space-y-2">
                    {entries.map((entry, index) => {
                        const isWinner = entry.id === winnerEntryId;
                        const media = entry.skinUrl ?? entry.shotUrl;
                        const hidden = entry.status === "removed";

                        return (
                            <div
                                key={entry.id}
                                className={`flex gap-3 rounded-lg border p-2 ${hidden
                                    ? "border-white/10 bg-black/40 opacity-50"
                                    : isWinner
                                        ? "border-[#FFD166]/50 bg-[rgba(255,209,102,0.06)]"
                                        : "border-white/10 bg-black/20"
                                    }`}
                            >
                                <span className="w-6 flex-shrink-0 pt-1 text-xs font-black text-[#6B7280]">#{index + 1}</span>

                                {media ? (
                                    <a
                                        href={media}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="h-20 w-20 flex-shrink-0 overflow-hidden rounded border border-white/10 bg-black/40"
                                    >
                                        {/* The raw submitted asset: a painted UV texture for costume
                                            contests, a framed screenshot for build ones. */}
                                        <img src={media} alt="" className="h-full w-full object-cover" />
                                    </a>
                                ) : (
                                    <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded border border-dashed border-white/10 text-[10px] text-[#6B7280]">
                                        no entry
                                    </div>
                                )}

                                <div className="min-w-0 flex-1 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-white">
                                            {entry.nickname || "—"}
                                        </span>
                                        {isWinner && <Trophy className="h-3.5 w-3.5 text-[#FFD166]" />}
                                        {hidden && (
                                            <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-400">
                                                hidden
                                            </span>
                                        )}
                                    </div>

                                    <div className="font-mono text-[11px] text-[#8B8F98]">{shortWallet(entry.wallet)}</div>

                                    {entry.xPostUrl && (
                                        <a
                                            href={entry.xPostUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex w-fit items-center gap-1 text-[11px] text-cyan-400 hover:underline"
                                        >
                                            <ExternalLink className="h-3 w-3" />
                                            {entry.xPostUrl}
                                        </a>
                                    )}

                                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#8B8F98]">
                                        <span className="flex items-center gap-1">
                                            <Heart className="h-3 w-3 text-[#E2666E]" />
                                            {entry.likeCount}
                                        </span>
                                        {tournament.submission === "none" && (
                                            <span>{entry.xpGained.toLocaleString("en-US")} XP</span>
                                        )}
                                        <span>
                                            {entry.submittedAt
                                                ? `submitted ${new Date(entry.submittedAt).toLocaleString()}`
                                                : "joined, nothing submitted"}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex flex-shrink-0 flex-col items-end gap-1">
                                    <button
                                        onClick={() => setWinnerEntryId(isWinner ? null : entry.id)}
                                        disabled={hidden}
                                        className={`text-[11px] font-bold px-2 py-1 bg-transparent border-0 disabled:opacity-30 ${isWinner ? "text-[#FFD166]" : "text-[#8B8F98] hover:text-white"
                                            }`}
                                    >
                                        {isWinner ? "Winner" : "Mark winner"}
                                    </button>
                                    <button
                                        onClick={() => moderate(entry, !hidden)}
                                        disabled={moderatingId === entry.id}
                                        className={`flex items-center gap-1 text-[11px] px-2 py-1 bg-transparent border-0 disabled:opacity-30 ${hidden ? "text-emerald-400 hover:text-emerald-300" : "text-red-400 hover:text-red-300"
                                            }`}
                                    >
                                        {hidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                                        {hidden ? "Restore" : "Hide"}
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    <button
                        onClick={load}
                        className="flex items-center gap-1.5 text-[#8B8F98] hover:text-white text-xs px-2 py-1 bg-transparent border-0"
                    >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Reload entries
                    </button>
                </div>
            )}
        </div>
    );
}
