// src/features/game/ui/DefusalHUD.tsx
"use client";

import { useEffect, useState } from "react";
import { Bomb, ShieldCheck, Skull, Timer } from "lucide-react";
import type { DefusalSide, DefusalStateData } from "../network/NetworkManager";
import { useLanguage } from "@/core/i18n/LanguageContext";

interface DefusalHUDProps {
    match: DefusalStateData | null;
    localPlayerId: string | null;
}

const SIDE_COLOR: Record<DefusalSide, string> = {
    t: "#E4A13C",
    ct: "#5FA8E8",
};

const SIDE_LABEL_KEY: Record<DefusalSide, string> = {
    t: "g.defusal.attack",
    ct: "g.defusal.defend",
};

function useNow(active: boolean): number {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (!active) return;
        const timer = setInterval(() => setNow(Date.now()), 100);
        return () => clearInterval(timer);
    }, [active]);

    return now;
}

function clock(ms: number): string {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function DefusalHUD({ match, localPlayerId }: DefusalHUDProps) {
    const text = useLanguage().t;
    const now = useNow(match !== null);

    if (!match) return null;

    const me = match.roster.find((entry) => entry.id === localPlayerId) ?? null;
    const mySide = me?.side ?? null;
    const bomb = match.bomb;

    const planted = bomb?.state === "planted";
    const countdown = planted ? bomb!.explodesAt - now : match.phaseUntil - now;

    const teams: DefusalSide[] = ["t", "ct"];
    const channel = bomb?.planting ?? bomb?.defusing ?? null;
    const channelIsMine = channel?.playerId === localPlayerId;
    const channelTotal = bomb?.planting ? 3200 : 5000;
    const channelLeft = channel ? Math.max(0, channel.until - now) : 0;

    return (
        <>
            <div
                className="game-ui-scale-tc absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none select-none font-oxanium z-30"
                style={{ marginTop: "var(--safe-top)" }}
            >
                <div className="flex items-stretch gap-px rounded-[10px] overflow-hidden border border-white/15 bg-[rgba(10,12,16,0.88)] backdrop-blur-md">
                    {teams.map((side) => {
                        const alive = match.roster.filter((entry) => entry.side === side && entry.alive).length;
                        const total = match.roster.filter((entry) => entry.side === side).length;

                        return (
                            <div
                                key={side}
                                className="px-4 py-2 min-w-[104px] text-center"
                                style={{ background: side === mySide ? `${SIDE_COLOR[side]}1f` : "transparent" }}
                            >
                                <div className="text-[9px] font-black tracking-widest" style={{ color: SIDE_COLOR[side] }}>
                                    {text(SIDE_LABEL_KEY[side])}
                                </div>
                                <div className="text-2xl font-black leading-none text-[#E5E7EB]">{match.score[side]}</div>
                                <div className="text-[10px] text-[#8B8F98] mt-0.5">{text("g.defusal.alive", { alive, total })}</div>
                            </div>
                        );
                    })}

                    <div className="px-5 py-2 flex flex-col items-center justify-center bg-[rgba(255,255,255,0.04)]">
                        <div className="flex items-center gap-1.5">
                            {planted ? (
                                <Bomb className="w-4 h-4 text-[#FF5757] animate-pulse" />
                            ) : (
                                <Timer className="w-4 h-4 text-[#8B8F98]" />
                            )}
                            <span
                                className="text-xl font-black tabular-nums"
                                style={{ color: planted ? "#FF5757" : countdown < 20000 ? "#FFD166" : "#E5E7EB" }}
                            >
                                {clock(countdown)}
                            </span>
                        </div>
                        <div className="text-[9px] tracking-widest text-[#6B7280] mt-0.5">
                            {match.phase === "freeze"
                                ? text("g.defusal.freeze")
                                : match.phase === "over"
                                    ? text("g.defusal.roundOver")
                                    : planted
                                        ? text("g.defusal.bombAt", { site: bomb!.site ?? "" })
                                        : text("g.defusal.round", { round: match.round })}
                        </div>
                    </div>
                </div>
            </div>

            {me && !me.alive && match.phase !== "over" && (
                <div className="absolute top-28 left-1/2 -translate-x-1/2 pointer-events-none select-none font-oxanium z-30">
                    <div className="flex items-center gap-2 bg-[rgba(20,8,8,0.8)] border border-[#FF5757]/40 rounded-[10px] px-4 py-2">
                        <Skull className="w-4 h-4 text-[#FF5757]" />
                        <span className="text-[#FF8A8A] text-sm font-bold">{text("g.defusal.downUntilNext")}</span>
                    </div>
                </div>
            )}

            {me?.hasBomb && match.phase === "live" && (
                <div className="absolute bottom-28 left-1/2 -translate-x-1/2 pointer-events-none select-none font-oxanium z-30">
                    <div className="flex items-center gap-2 bg-[rgba(24,16,4,0.85)] border border-[#E4A13C]/50 rounded-[10px] px-4 py-2">
                        <Bomb className="w-4 h-4 text-[#E4A13C]" />
                        <span className="text-[#FFD9A0] text-sm font-bold">
                            {text("g.defusal.carryBomb")}
                        </span>
                    </div>
                </div>
            )}

            {planted && mySide === "ct" && (
                <div className="absolute bottom-28 left-1/2 -translate-x-1/2 pointer-events-none select-none font-oxanium z-30">
                    <div className="flex items-center gap-2 bg-[rgba(6,16,26,0.85)] border border-[#5FA8E8]/50 rounded-[10px] px-4 py-2">
                        <ShieldCheck className="w-4 h-4 text-[#5FA8E8]" />
                        <span className="text-[#BEDCF7] text-sm font-bold">
                            {text("g.defusal.bombDown", { site: bomb!.site ?? "" })}
                        </span>
                    </div>
                </div>
            )}

            {channel && (
                <div className="absolute bottom-44 left-1/2 -translate-x-1/2 pointer-events-none select-none font-oxanium z-30 w-64">
                    <div className="text-center text-[11px] font-bold tracking-widest mb-1 text-[#E5E7EB]">
                        {bomb?.planting ? text("g.defusal.planting") : text("g.defusal.defusing")}
                        {!channelIsMine && <span className="text-[#8B8F98]"> — {text("g.defusal.teammate")}</span>}
                    </div>
                    <div className="h-2 bg-[rgba(255,255,255,0.1)] rounded-full overflow-hidden">
                        <div
                            className="h-full transition-none"
                            style={{
                                width: `${Math.max(0, Math.min(100, (1 - channelLeft / channelTotal) * 100))}%`,
                                background: bomb?.planting ? "#E4A13C" : "#5FA8E8",
                            }}
                        />
                    </div>
                </div>
            )}
        </>
    );
}
