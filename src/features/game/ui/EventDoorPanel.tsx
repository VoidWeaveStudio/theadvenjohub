// src/features/game/ui/EventDoorPanel.tsx
"use client";

import { useEffect, useState } from "react";
import { CalendarClock, DoorOpen, Gift, Lock, Medal, Swords, Timer, Trophy, Users, X } from "lucide-react";
import {
    EVENT_DOORS_BY_ID,
    GRINDER_EVENT_ID,
    GRINDER_NAME,
    GRINDER_TEASER,
    eventWindow,
    type EventBoardEntry,
    type EventWindow,
    type ResolvedEvent,
} from "../data/eventDoors";
import { fetchEventDetail } from "../data/eventClient";
import { useLanguage } from "@/core/i18n/LanguageContext";
import type { Translate } from "@/core/i18n/types";

interface EventDoorPanelProps {
    eventId: string | null;
    gameSlug: string;
    localWallet: string | null;
    partySize: number;
    queue: { queued: number; needed: number; minimum: number } | null;
    inQueue: boolean;
    onClose: () => void;
    onEnter: (eventId: string) => void;
    onJoinQueue: () => void;
    onLeaveQueue: () => void;
    onEnterGrinder: () => void;
}

const QUEUED_EVENTS = new Set(["dust2"]);

function shortWallet(wallet: string): string {
    return wallet.length > 10 ? `${wallet.slice(0, 4)}…${wallet.slice(-4)}` : wallet;
}

function formatDate(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatCooldown(minutes: number, t: Translate): string {
    if (minutes <= 0) return t("g.door.noCooldown");
    if (minutes < 60) return t("g.door.cooldownMin", { minutes });
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest === 0 ? t("g.door.cooldownH", { hours }) : t("g.door.cooldownHM", { hours, minutes: rest });
}

const RANK_COLORS = ["#FFD166", "#C9CDD3", "#CD7F32"];

function formatCountdown(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

function scheduleLine(window: EventWindow, now: number, t: Translate): { text: string; urgent: boolean } | null {
    if (window.state === "always") return null;

    if (window.state === "open") {
        if (window.closesAt === null) return { text: t("g.door.runningNow"), urgent: false };
        return { text: t("g.door.closesIn", { time: formatCountdown(window.closesAt - now) }), urgent: window.closesAt - now < 600000 };
    }

    if (window.state === "upcoming" && window.opensAt !== null) {
        return { text: t("g.door.opensIn", { time: formatCountdown(window.opensAt - now) }), urgent: false };
    }

    return { text: t("g.door.finished"), urgent: false };
}

export function EventDoorPanel({
    eventId,
    gameSlug,
    localWallet,
    partySize,
    queue,
    inQueue,
    onClose,
    onEnter,
    onJoinQueue,
    onLeaveQueue,
    onEnterGrinder,
}: EventDoorPanelProps) {
    const { t } = useLanguage();
    const [event, setEvent] = useState<ResolvedEvent | null>(null);
    const [board, setBoard] = useState<EventBoardEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (!eventId) return;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [eventId]);

    useEffect(() => {
        if (!eventId) {
            setEvent(null);
            setBoard([]);
            return;
        }

        let cancelled = false;
        setLoading(true);

        fetchEventDetail(gameSlug, eventId)
            .then((detail) => {
                if (cancelled || !detail) return;
                setEvent(detail.event);
                setBoard(detail.board);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [eventId, gameSlug]);

    if (!eventId) return null;

    const door = EVENT_DOORS_BY_ID.get(eventId);
    if (!door) return null;

    const accent = `#${(event?.accent ?? door.accent).toString(16).padStart(6, "0")}`;
    const localized = (value: string | null | undefined, fallbackKey: string) => {
        const source = value && value.trim().length > 0 ? value : fallbackKey;
        return /^g\.[A-Za-z0-9_.-]+$/.test(source) ? t(source) : source;
    };

    const title = localized(event?.title, door.name);
    const scored = door.scored;
    const partyOk = !event || (partySize >= event.minParty && partySize <= event.maxParty);

    const runWindow = event ? eventWindow(event, now) : null;
    const schedule = runWindow ? scheduleLine(runWindow, now, t) : null;
    const enabled = event ? event.enabled && runWindow!.open : door.live;
    const sealedLabel = !event || event.enabled === false
        ? t("g.door.sealed")
        : runWindow?.state === "upcoming"
            ? t("g.door.opensIn", { time: formatCountdown((runWindow.opensAt ?? now) - now) })
            : t("g.door.finished");

    return (
        <div
            className="absolute inset-0 bg-[rgba(6,6,8,0.85)] backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto p-2 sm:p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                className="w-full max-w-lg bg-[rgba(12,14,16,0.96)] border-2 rounded-[16px] overflow-hidden"
                style={{ borderColor: `${accent}55`, boxShadow: `0 0 40px ${accent}22` }}
            >
                <div
                    className="flex items-start justify-between gap-3 p-5 pb-4"
                    style={{ background: `linear-gradient(180deg, ${accent}18 0%, transparent 100%)` }}
                >
                    <div className="flex items-start gap-3 min-w-0">
                        <span className="text-3xl leading-none flex-shrink-0">{door.glyph}</span>
                        <div className="min-w-0">
                            <h2 className="text-xl font-black text-[#E5E7EB] truncate">{title}</h2>
                            <div className="text-xs font-bold tracking-widest uppercase mt-0.5" style={{ color: accent }}>
                                {localized(event?.tagline, door.tagline)}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="bg-transparent border-0 p-0 text-[#8B8F98] hover:text-[#E5E7EB] transition-colors flex-shrink-0">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="px-5 pb-5 space-y-4">
                    <p className="text-[#C9CDD3] text-sm leading-relaxed">{localized(event?.description, door.teaser)}</p>

                    <div className="space-y-2">
                        <div className="flex items-start gap-2.5 text-xs bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2.5">
                            <Gift className="w-4 h-4 flex-shrink-0 mt-px" style={{ color: accent }} />
                            <span className="text-[#C9CDD3]">{localized(event?.rewardText, door.rewardText)}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="flex items-center gap-2 text-xs bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2.5">
                                <Users className="w-4 h-4 text-[#8B8F98] flex-shrink-0" />
                                <span className={partyOk ? "text-[#C9CDD3]" : "text-[#FFD166]"}>
                                    {event && event.minParty === event.maxParty
                                        ? t("g.door.partyExact", { count: event.maxParty })
                                        : t("g.door.partyRange", { min: event?.minParty ?? 1, max: event?.maxParty ?? door.maxParty })}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2.5">
                                <CalendarClock className="w-4 h-4 text-[#8B8F98] flex-shrink-0" />
                                <span className="text-[#C9CDD3]">
                                    {formatCooldown(event?.cooldownMinutes ?? door.cooldownMinutes, t)}
                                </span>
                            </div>
                        </div>

                        {schedule ? (
                            <div
                                className="flex items-center justify-center gap-2 text-sm font-bold rounded-lg px-3 py-2.5 tabular-nums"
                                style={{
                                    background: schedule.urgent ? "rgba(255,87,87,0.12)" : `${accent}14`,
                                    color: schedule.urgent ? "#FF8A8A" : accent,
                                }}
                            >
                                <Timer className="w-4 h-4" />
                                <span>{schedule.text}</span>
                            </div>
                        ) : null}

                        {event?.scheduleNote ? (
                            <div className="text-xs text-center text-[#8B8F98] px-3">{event.scheduleNote}</div>
                        ) : null}
                    </div>

                    {scored && (
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <Trophy className="w-4 h-4" style={{ color: accent }} />
                                <span className="text-[#E5E7EB] text-sm font-bold">{t("g.door.furthestWaves")}</span>
                            </div>

                            {loading ? (
                                <div className="text-[#6B7280] text-xs py-4 text-center">{t("g.door.readingLedger")}</div>
                            ) : board.length === 0 ? (
                                <div className="text-[#6B7280] text-xs py-4 text-center bg-white/[0.03] border border-white/10 rounded-lg">
                                    {t("g.door.noRunsYet")}
                                </div>
                            ) : (
                                <div className="bg-white/[0.03] border border-white/10 rounded-lg divide-y divide-white/5 max-h-60 overflow-y-auto">
                                    {board.map((entry) => {
                                        const isMe = !!localWallet && entry.wallet === localWallet;
                                        return (
                                            <div
                                                key={`${entry.wallet}-${entry.rank}`}
                                                className={`flex items-center gap-3 px-3 py-2 text-xs ${isMe ? "bg-white/[0.06]" : ""}`}
                                            >
                                                <span
                                                    className="w-5 font-black text-center flex-shrink-0"
                                                    style={{ color: RANK_COLORS[entry.rank - 1] ?? "#6B7280" }}
                                                >
                                                    {entry.rank <= 3 ? <Medal className="w-3.5 h-3.5 mx-auto" /> : entry.rank}
                                                </span>
                                                <span className={`flex-1 truncate ${isMe ? "text-white font-bold" : "text-[#C9CDD3]"}`}>
                                                    {entry.nickname || shortWallet(entry.wallet)}
                                                </span>
                                                <span className="text-[#6B7280] flex-shrink-0">
                                                    {entry.partySize > 1 ? `${entry.partySize}p` : "solo"}
                                                </span>
                                                <span className="text-[#6B7280] flex-shrink-0 w-12 text-right">
                                                    {formatDate(entry.achievedAt)}
                                                </span>
                                                <span className="font-black flex-shrink-0 w-14 text-right" style={{ color: accent }}>
                                                    wave {entry.wavesCleared}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {enabled && QUEUED_EVENTS.has(eventId) ? (
                        <div className="space-y-2">
                            <div className="flex items-center justify-center gap-2 text-xs text-[#8B8F98]">
                                <Users className="w-3.5 h-3.5" />
                                <span>
                                    {queue ? t("g.door.inQueue", { queued: queue.queued, needed: queue.needed }) : t("g.door.queueEmpty")}
                                    {queue && queue.queued >= queue.minimum ? t("g.door.startingSoon") : ""}
                                </span>
                            </div>

                            <button
                                onClick={inQueue ? onLeaveQueue : onJoinQueue}
                                className="w-full flex items-center justify-center gap-2 font-black px-4 py-3 rounded-[8px] transition-all hover:brightness-110"
                                style={
                                    inQueue
                                        ? { background: "rgba(255,255,255,0.08)", color: "#C9CDD3" }
                                        : { background: `linear-gradient(90deg, ${accent} 0%, ${accent}cc 100%)`, color: "rgba(12,12,14,0.92)" }
                                }
                            >
                                <DoorOpen className="w-4 h-4" />
                                <span>{inQueue ? t("g.door.leaveQueue") : t("g.door.queueUp")}</span>
                            </button>

                            {eventId === GRINDER_EVENT_ID && (
                                <div className="pt-1 space-y-1.5">
                                    <div className="text-[11px] text-[#8B8F98] text-center px-3">{GRINDER_TEASER}</div>
                                    <button
                                        onClick={onEnterGrinder}
                                        className="w-full flex items-center justify-center gap-2 font-black px-4 py-3 rounded-[8px] border border-[#FF5757]/45 bg-[rgba(255,87,87,0.1)] text-[#FF8A8A] transition-all hover:bg-[rgba(255,87,87,0.18)]"
                                    >
                                        <Swords className="w-4 h-4" />
                                        <span>{t("g.door.walkStraightIn", { name: GRINDER_NAME })}</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : enabled ? (
                        <button
                            onClick={() => onEnter(eventId)}
                            className="w-full flex items-center justify-center gap-2 font-black px-4 py-3 rounded-[8px] transition-all hover:brightness-110 text-[rgba(12,12,14,0.92)]"
                            style={{ background: `linear-gradient(90deg, ${accent} 0%, ${accent}cc 100%)` }}
                        >
                            <DoorOpen className="w-4 h-4" />
                            <span>{t("g.door.stepThrough")}</span>
                        </button>
                    ) : (
                        <button
                            disabled
                            className="w-full flex items-center justify-center gap-2 bg-white/5 text-white/40 border border-white/10 font-bold px-4 py-3 rounded-[8px] cursor-not-allowed"
                        >
                            <Lock className="w-4 h-4" />
                            <span>{sealedLabel}</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
