// src/features/game/ui/TournamentPanel.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, Clock, DoorOpen, Heart, Link2, Loader2, Trophy, Users } from "lucide-react";
import { WindowFrame } from "./shell/WindowFrame";
import { InlinePreview } from "./preview/InlinePreview";
import type { TournamentActionPayload, TournamentEntryView, TournamentSummary } from "../network/NetworkManager";
import { formatReward } from "@/core/lib/tournaments";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { SoundManager } from "../core/SoundManager";

interface TournamentPanelProps {
    isOpen: boolean;
    tournaments: TournamentSummary[];
    entriesById: Record<string, TournamentEntryView[]>;
    onClose: () => void;
    onRefresh: () => void;
    onRequestEntries: (tournamentId: string) => void;
    onAction: (payload: TournamentActionPayload) => void;
    onCaptureBuildShot: (tournamentId: string) => Promise<void>;
    onVisitRoom: (ownerUserId: string) => void;
}

const ENTRY_REFRESH_MS = 15_000;

function shortWallet(wallet: string): string {
    return wallet.length > 10 ? `${wallet.slice(0, 4)}…${wallet.slice(-4)}` : wallet;
}

export function TournamentPanel({
    isOpen,
    tournaments,
    entriesById,
    onClose,
    onRefresh,
    onRequestEntries,
    onAction,
    onCaptureBuildShot,
    onVisitRoom,
}: TournamentPanelProps) {
    const { t } = useLanguage();
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [tab, setTab] = useState<"live" | "history">("live");
    const [postDraft, setPostDraft] = useState("");
    const [busy, setBusy] = useState(false);
    const wasOpenRef = useRef(false);

    const live = useMemo(() => tournaments.filter((entry) => entry.phase !== "ended"), [tournaments]);
    const history = useMemo(() => tournaments.filter((entry) => entry.phase === "ended"), [tournaments]);
    const visible = tab === "live" ? live : history;

    const selected = useMemo(
        () => tournaments.find((entry) => entry.id === selectedId) ?? null,
        [tournaments, selectedId]
    );

    // GameClient passes fresh closures every render, so the polling effects below
    // read them through a ref instead of listing them as dependencies — otherwise
    // every render would tear down and re-arm the interval and fire a request.
    const callbacksRef = useRef({ onRefresh, onRequestEntries });
    callbacksRef.current = { onRefresh, onRequestEntries };

    useEffect(() => {
        if (isOpen && !wasOpenRef.current) {
            callbacksRef.current.onRefresh();
            setTab("live");
        }
        wasOpenRef.current = isOpen;
    }, [isOpen]);

    // Keep a contest selected whenever the current tab has any, so the detail
    // pane is never blank while the list on the left is full.
    useEffect(() => {
        if (!isOpen) return;
        if (visible.some((entry) => entry.id === selectedId)) return;
        setSelectedId(visible[0]?.id ?? null);
    }, [isOpen, visible, selectedId]);

    useEffect(() => {
        setPostDraft(selected?.myXPostUrl ?? "");
    }, [selected?.id, selected?.myXPostUrl]);

    // The roster changes as other players vote, so it is polled while the detail
    // pane is on screen rather than only when it opens.
    useEffect(() => {
        if (!isOpen || !selectedId) return;
        callbacksRef.current.onRequestEntries(selectedId);
        const timer = setInterval(() => callbacksRef.current.onRequestEntries(selectedId), ENTRY_REFRESH_MS);
        return () => clearInterval(timer);
    }, [isOpen, selectedId]);

    const entries = selected ? entriesById[selected.id] ?? [] : [];

    const phaseLabel = (tournament: TournamentSummary) =>
        tournament.phase === "upcoming"
            ? t("g.tournament.phase.upcoming")
            : tournament.phase === "ended"
                ? t("g.tournament.phase.ended")
                : t("g.tournament.phase.active");

    const windowLabel = (tournament: TournamentSummary) => {
        const start = new Date(tournament.startsAt).toLocaleString();
        const end = new Date(tournament.endsAt).toLocaleString();
        return `${start} → ${end}`;
    };

    const act = (payload: TournamentActionPayload) => {
        SoundManager.getInstance().play("ui-click", { volume: 0.4 });
        onAction(payload);
    };

    const captureShot = async () => {
        if (!selected || busy) return;
        setBusy(true);
        try {
            await onCaptureBuildShot(selected.id);
        } finally {
            setBusy(false);
        }
    };

    const renderActions = () => {
        if (!selected) return null;

        if (selected.phase === "upcoming") {
            return <p className="text-xs text-[#8B8F98]">{t("g.tournament.notStarted")}</p>;
        }

        if (selected.phase === "ended") {
            return <p className="text-xs text-[#8B8F98]">{t("g.tournament.closed")}</p>;
        }

        if (!selected.joined) {
            const full = selected.maxEntries > 0 && selected.entryCount >= selected.maxEntries;
            return (
                <button
                    onClick={() => act({ action: "join", tournamentId: selected.id })}
                    disabled={full}
                    className="btn-primary px-4 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {full ? t("g.tournament.full") : t("g.tournament.join")}
                </button>
            );
        }

        return (
            <div className="flex flex-wrap items-center gap-2">
                {selected.submission === "skin" && (
                    <button
                        onClick={() => act({ action: "submitSkin", tournamentId: selected.id, kind: selected.kind })}
                        className="btn-primary flex items-center gap-1.5 px-4 py-2 text-xs"
                    >
                        <Check className="h-3.5 w-3.5" />
                        {selected.submitted ? t("g.tournament.showSkinAgain") : t("g.tournament.showSkin")}
                    </button>
                )}

                {selected.submission === "shot" && (
                    <button
                        onClick={captureShot}
                        disabled={busy}
                        className="btn-primary flex items-center gap-1.5 px-4 py-2 text-xs disabled:opacity-50"
                    >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                        {selected.submitted ? t("g.tournament.showBuildAgain") : t("g.tournament.showBuild")}
                    </button>
                )}

                {selected.submission === "none" && (
                    <span className="text-xs text-[#8B8F98]">{t("g.tournament.autoTracked")}</span>
                )}

                <span className="flex items-center gap-1 text-[11px] text-[#5FD39A]">
                    <Check className="h-3.5 w-3.5" />
                    {t("g.tournament.joined")}
                </span>
            </div>
        );
    };

    const renderPostField = () => {
        if (!selected || !selected.joined || selected.phase !== "active") return null;

        const dirty = postDraft.trim() !== (selected.myXPostUrl ?? "");

        return (
            <div className="flex flex-wrap items-center gap-2">
                <Link2 className="h-3.5 w-3.5 flex-shrink-0 text-[#8B8F98]" />
                <input
                    value={postDraft}
                    onChange={(e) => setPostDraft(e.target.value)}
                    placeholder={t("g.tournament.postPlaceholder")}
                    className="min-w-0 flex-1 rounded border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white outline-none"
                />
                <button
                    onClick={() => act({ action: "setPost", tournamentId: selected.id, postUrl: postDraft.trim() })}
                    disabled={!dirty}
                    className="btn-secondary px-3 py-1.5 text-[11px] disabled:opacity-40"
                >
                    {postDraft.trim().length === 0 ? t("g.tournament.postClear") : t("g.tournament.postAttach")}
                </button>
            </div>
        );
    };

    const renderEntryMedia = (entry: TournamentEntryView) => {
        if (!selected) return null;

        if (selected.submission === "skin") {
            if (!entry.skinUrl) {
                return (
                    <div className="flex h-32 w-28 flex-shrink-0 items-center justify-center rounded-lg border border-dashed border-white/10 text-[10px] text-[#6B7280]">
                        {t("g.tournament.noSkinYet")}
                    </div>
                );
            }
            return (
                <InlinePreview
                    subject={{ kind: "character", skinId: null, accessoryId: null, skinTextureUrl: entry.skinUrl }}
                    accent={selected.accent}
                    size="md"
                />
            );
        }

        if (selected.submission === "shot") {
            if (!entry.shotUrl) {
                return (
                    <div className="flex h-32 w-44 flex-shrink-0 items-center justify-center rounded-lg border border-dashed border-white/10 text-[10px] text-[#6B7280]">
                        {t("g.tournament.noShotYet")}
                    </div>
                );
            }
            return (
                <div className="h-32 w-44 flex-shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/40">
                    {/* Blob-hosted upload, same as every other player-supplied
                        image in the game UI — plain img, no optimizer host list. */}
                    <img src={entry.shotUrl} alt="" className="h-full w-full object-cover" />
                </div>
            );
        }

        return null;
    };

    const renderEntry = (entry: TournamentEntryView, rank: number) => {
        if (!selected) return null;

        const canLike =
            selected.phase === "active" &&
            selected.submission !== "none" &&
            !entry.isMe &&
            entry.submittedAt !== null;

        return (
            <div
                key={entry.id}
                className={`flex gap-3 rounded-xl border p-3 ${entry.isWinner
                    ? "border-[#FFD166]/50 bg-[rgba(255,209,102,0.07)]"
                    : "border-white/10 bg-[rgba(255,255,255,0.03)]"
                    }`}
            >
                <div className="flex w-7 flex-shrink-0 flex-col items-center pt-1">
                    <span className="text-sm font-black text-[#8B8F98]">#{rank}</span>
                    {entry.isWinner && <Trophy className="mt-1 h-4 w-4 text-[#FFD166]" />}
                </div>

                {renderEntryMedia(entry)}

                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-bold text-[#E5E7EB]">
                            {entry.nickname || shortWallet(entry.wallet)}
                        </span>
                        {entry.isMe && (
                            <span className="flex-shrink-0 rounded-full bg-white/10 px-1.5 text-[10px] font-bold text-[#C9CDD3]">
                                {t("g.tournament.you")}
                            </span>
                        )}
                    </div>

                    <span className="truncate font-mono text-[11px] text-[#6B7280]">{entry.wallet}</span>

                    {selected.submission === "none" && (
                        <span className="text-xs text-[#4FD1FF]">
                            {t("g.tournament.xpGained", { amount: entry.xpGained.toLocaleString("en-US") })}
                        </span>
                    )}

                    {entry.xPostUrl && (
                        <a
                            href={entry.xPostUrl}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="flex w-fit items-center gap-1 text-[11px] text-[#4FD1FF] hover:underline"
                        >
                            <Link2 className="h-3 w-3" />
                            {t("g.tournament.viewPost")}
                        </a>
                    )}

                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                        {selected.submission !== "none" && (
                            <button
                                onClick={() => canLike && act({ action: "like", tournamentId: selected.id, entryId: entry.id })}
                                disabled={!canLike}
                                title={entry.isMe ? t("g.tournament.noSelfLike") : undefined}
                                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors disabled:cursor-not-allowed ${entry.likedByMe
                                    ? "border-[#E2666E]/50 bg-[rgba(226,102,110,0.15)] text-[#E2666E]"
                                    : "border-white/10 text-[#8B8F98] hover:text-[#E5E7EB] disabled:opacity-40"
                                    }`}
                            >
                                <Heart className={`h-3 w-3 ${entry.likedByMe ? "fill-current" : ""}`} />
                                {entry.likeCount}
                            </button>
                        )}

                        {selected.submission === "shot" && (
                            <button
                                onClick={() => onVisitRoom(entry.userId)}
                                className="btn-secondary flex items-center gap-1.5 px-2.5 py-1 text-[11px]"
                            >
                                <DoorOpen className="h-3 w-3" />
                                {t("g.tournament.visitRoom")}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <WindowFrame
            isOpen={isOpen}
            onClose={onClose}
            title={t("g.tournament.title")}
            icon={<Trophy className="h-6 w-6 text-[#FFD166]" />}
            size="xl"
            tabs={[
                { id: "live", label: t("g.tournament.tab.live") },
                { id: "history", label: t("g.tournament.tab.history") },
            ]}
            activeTab={tab}
            onTabChange={(id) => setTab(id as "live" | "history")}
        >
            {visible.length === 0 ? (
                <div className="py-16 text-center text-sm text-[#6B7280]">
                    {tab === "live" ? t("g.tournament.emptyLive") : t("g.tournament.emptyHistory")}
                </div>
            ) : (
                <div className="flex h-full min-h-0 gap-4">
                    <div className="flex w-64 flex-shrink-0 flex-col gap-2 overflow-y-auto pr-1">
                        {visible.map((tournament) => {
                            const active = tournament.id === selectedId;
                            return (
                                <button
                                    key={tournament.id}
                                    onClick={() => setSelectedId(tournament.id)}
                                    className={`rounded-xl border p-3 text-left transition-colors ${active
                                        ? "border-[#FFD166]/50 bg-[rgba(255,209,102,0.08)]"
                                        : "border-white/10 bg-[rgba(255,255,255,0.03)] hover:border-white/20"
                                        }`}
                                >
                                    <div className="truncate text-sm font-bold text-[#E5E7EB]">{tournament.title}</div>
                                    <div
                                        className="text-[10px] font-black uppercase tracking-widest"
                                        style={{ color: tournament.accent }}
                                    >
                                        {phaseLabel(tournament)}
                                    </div>
                                    <div className="mt-1.5 flex items-center justify-between text-[11px]">
                                        <span className="font-bold text-[#FFD166]">
                                            {formatReward(tournament.rewardAmount, tournament.rewardCurrency)}
                                        </span>
                                        <span className="flex items-center gap-1 text-[#6B7280]">
                                            <Users className="h-3 w-3" />
                                            {tournament.entryCount}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {selected && (
                        <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
                            <div
                                className="rounded-xl border p-4"
                                style={{
                                    borderColor: `${selected.accent}55`,
                                    background: `linear-gradient(150deg, ${selected.accent}1a -40%, rgba(255,255,255,0.02) 60%)`,
                                }}
                            >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <h3 className="text-lg font-black text-[#E5E7EB]">{selected.title}</h3>
                                        <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: selected.accent }}>
                                            {t(`g.tournament.kind.${selected.kind}.label`)}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xl font-black text-[#FFD166]">
                                            {formatReward(selected.rewardAmount, selected.rewardCurrency)}
                                        </div>
                                        {selected.rewardNote && (
                                            <div className="text-[11px] text-[#8B8F98]">{selected.rewardNote}</div>
                                        )}
                                    </div>
                                </div>

                                {selected.description && (
                                    <p className="mt-3 whitespace-pre-line text-xs leading-relaxed text-[#C9CDD3]">
                                        {selected.description}
                                    </p>
                                )}

                                {selected.rulesText && (
                                    <div className="mt-3 rounded-lg border border-white/10 bg-black/25 p-3">
                                        <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-[#6B7280]">
                                            {t("g.tournament.rules")}
                                        </div>
                                        <p className="whitespace-pre-line text-xs leading-relaxed text-[#C9CDD3]">
                                            {selected.rulesText}
                                        </p>
                                    </div>
                                )}

                                <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-[#8B8F98]">
                                    <span className="flex items-center gap-1.5">
                                        <Clock className="h-3.5 w-3.5" />
                                        {windowLabel(selected)}
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <Users className="h-3.5 w-3.5" />
                                        {selected.maxEntries > 0
                                            ? t("g.tournament.entriesCapped", {
                                                count: selected.entryCount,
                                                max: selected.maxEntries,
                                            })
                                            : t("g.tournament.entries", { count: selected.entryCount })}
                                    </span>
                                </div>

                                <div className="mt-3 flex flex-col gap-2">
                                    {renderActions()}
                                    {renderPostField()}
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <div className="text-[10px] font-black uppercase tracking-widest text-[#6B7280]">
                                    {t("g.tournament.participants")}
                                </div>
                                {entries.length === 0 ? (
                                    <div className="py-8 text-center text-xs text-[#6B7280]">
                                        {t("g.tournament.noEntries")}
                                    </div>
                                ) : (
                                    entries.map((entry, index) => renderEntry(entry, index + 1))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </WindowFrame>
    );
}
