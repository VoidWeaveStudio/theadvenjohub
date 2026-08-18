// src/features/game/ui/GrinderHUD.tsx
"use client";

import { useEffect, useState } from "react";
import { Crosshair, Flame, Skull, Timer, Trophy } from "lucide-react";
import type { GrinderRosterEntry, GrinderStateData } from "../network/NetworkManager";

interface GrinderHUDProps {
    match: GrinderStateData | null;
    localPlayerId: string | null;
}

const BOARD_SIZE = 5;

function useNow(active: boolean): number {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (!active) return;
        const timer = setInterval(() => setNow(Date.now()), 200);
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

function ranked(roster: GrinderRosterEntry[]): GrinderRosterEntry[] {
    return roster.slice().sort((a, b) => {
        if (b.kills !== a.kills) return b.kills - a.kills;
        return a.deaths - b.deaths;
    });
}

export function GrinderHUD({ match, localPlayerId }: GrinderHUDProps) {
    const now = useNow(match !== null);

    if (!match) return null;

    const board = ranked(match.roster);
    const myIndex = board.findIndex((entry) => entry.id === localPlayerId);
    const me = myIndex === -1 ? null : board[myIndex];
    const leader = board[0] ?? null;
    const over = match.phase === "over";
    const countdown = match.phaseUntil - now;

    const shown = board.slice(0, over ? BOARD_SIZE * 2 : BOARD_SIZE);
    const trailing = me && myIndex >= shown.length ? me : null;

    return (
        <>
            <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none select-none font-oxanium z-30">
                <div className="flex items-stretch gap-px rounded-[10px] overflow-hidden border border-white/15 bg-[rgba(10,12,16,0.88)] backdrop-blur-md">
                    <div className="px-4 py-2 min-w-[104px] text-center">
                        <div className="text-[9px] font-black tracking-widest text-[#FF5757]">YOUR KILLS</div>
                        <div className="text-2xl font-black leading-none text-[#E5E7EB]">{me?.kills ?? 0}</div>
                        <div className="text-[10px] text-[#8B8F98] mt-0.5">
                            {myIndex === -1 ? "—" : `#${myIndex + 1} of ${board.length}`}
                        </div>
                    </div>

                    <div className="px-5 py-2 flex flex-col items-center justify-center bg-[rgba(255,255,255,0.04)]">
                        <div className="flex items-center gap-1.5">
                            <Timer className="w-4 h-4 text-[#8B8F98]" />
                            <span
                                className="text-xl font-black tabular-nums"
                                style={{ color: over ? "#8B8F98" : countdown < 60000 ? "#FFD166" : "#E5E7EB" }}
                            >
                                {clock(countdown)}
                            </span>
                        </div>
                        <div className="text-[9px] tracking-widest text-[#6B7280] mt-0.5">
                            {over ? "NEXT ROUND" : "MEAT GRINDER"}
                        </div>
                    </div>

                    <div className="px-4 py-2 min-w-[112px] text-center">
                        <div className="text-[9px] font-black tracking-widest text-[#FFD166]">LEADER</div>
                        <div className="text-2xl font-black leading-none text-[#E5E7EB]">{leader?.kills ?? 0}</div>
                        <div className="text-[10px] text-[#8B8F98] mt-0.5 truncate max-w-[104px]">
                            {leader?.nickname ?? "nobody yet"}
                        </div>
                    </div>
                </div>
            </div>

            <div className="absolute top-4 right-4 pointer-events-none select-none font-oxanium z-30 w-56">
                <div className="rounded-[10px] overflow-hidden border border-white/15 bg-[rgba(10,12,16,0.82)] backdrop-blur-md">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-white/10">
                        {over ? (
                            <Trophy className="w-3.5 h-3.5 text-[#FFD166]" />
                        ) : (
                            <Crosshair className="w-3.5 h-3.5 text-[#8B8F98]" />
                        )}
                        <span className="text-[10px] font-black tracking-widest text-[#8B8F98]">
                            {over ? "FINAL STANDINGS" : "STANDINGS"}
                        </span>
                    </div>

                    <div className="divide-y divide-white/5">
                        {shown.map((entry, index) => {
                            const isMe = entry.id === localPlayerId;
                            return (
                                <div
                                    key={entry.id}
                                    className={`flex items-center gap-2 px-3 py-1.5 text-xs ${isMe ? "bg-white/[0.07]" : ""}`}
                                >
                                    <span
                                        className="w-4 font-black text-center flex-shrink-0"
                                        style={{ color: index === 0 ? "#FFD166" : "#6B7280" }}
                                    >
                                        {index + 1}
                                    </span>
                                    <span className={`flex-1 truncate ${isMe ? "text-white font-bold" : "text-[#C9CDD3]"}`}>
                                        {entry.nickname}
                                    </span>
                                    {entry.streak >= 3 && !over && (
                                        <Flame className="w-3 h-3 text-[#FF8A3C] flex-shrink-0" />
                                    )}
                                    {!entry.alive && !over && (
                                        <Skull className="w-3 h-3 text-[#6B7280] flex-shrink-0" />
                                    )}
                                    <span className="font-black tabular-nums text-[#E5E7EB] w-6 text-right flex-shrink-0">
                                        {entry.kills}
                                    </span>
                                    <span className="tabular-nums text-[#6B7280] w-6 text-right flex-shrink-0">
                                        {entry.deaths}
                                    </span>
                                </div>
                            );
                        })}

                        {trailing && (
                            <div className="flex items-center gap-2 px-3 py-1.5 text-xs bg-white/[0.07]">
                                <span className="w-4 font-black text-center flex-shrink-0 text-[#6B7280]">
                                    {myIndex + 1}
                                </span>
                                <span className="flex-1 truncate text-white font-bold">{trailing.nickname}</span>
                                <span className="font-black tabular-nums text-[#E5E7EB] w-6 text-right flex-shrink-0">
                                    {trailing.kills}
                                </span>
                                <span className="tabular-nums text-[#6B7280] w-6 text-right flex-shrink-0">
                                    {trailing.deaths}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {over && (
                <div className="absolute top-28 left-1/2 -translate-x-1/2 pointer-events-none select-none font-oxanium z-30">
                    <div className="flex items-center gap-2 bg-[rgba(24,20,4,0.85)] border border-[#FFD166]/50 rounded-[10px] px-4 py-2">
                        <Trophy className="w-4 h-4 text-[#FFD166]" />
                        <span className="text-[#FFE9A8] text-sm font-bold">
                            {leader && leader.kills > 0
                                ? `${leader.nickname} takes it with ${leader.kills} kills`
                                : "Nobody scored"}
                        </span>
                    </div>
                </div>
            )}
        </>
    );
}
